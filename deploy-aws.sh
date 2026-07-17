#!/bin/bash
# Deploy Prize Roulette Wheel to AWS Lambda + API Gateway
# Costo estimado: ~$0 para unas horas de uso (free tier)
# Prerrequisitos: AWS CLI configurado, Docker instalado

set -e

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="prize-roulette-wheel"
FUNCTION_NAME="prize-roulette-wheel"
API_NAME="prize-roulette-wheel"
S3_BUCKET="prize-roulette-data-${ACCOUNT_ID}"

echo "🎰 Deploying Prize Roulette Wheel to AWS Lambda..."
echo "Region: $REGION"
echo "Account: $ACCOUNT_ID"

# 1. Create ECR repository (if not exists)
echo ""
echo "📦 Creating ECR repository..."
aws ecr create-repository --repository-name $REPO_NAME --region $REGION 2>/dev/null || true

# 2. Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# 3. Build Docker image (siempre sin cache para incluir últimos cambios)
echo "🐳 Building Docker image (linux/amd64, no cache)..."
docker build --platform linux/amd64 --no-cache -t $REPO_NAME .
docker tag $REPO_NAME:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

echo "📤 Pushing to ECR..."
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

# 4. Create S3 bucket for data persistence
echo "🪣 Creating S3 bucket for data persistence..."
aws s3 mb s3://${S3_BUCKET} --region $REGION 2>/dev/null || true
aws s3api put-public-access-block \
  --bucket $S3_BUCKET \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  2>/dev/null || true

# 5. Create IAM role for Lambda (if not exists)
echo "👤 Creating Lambda execution role..."
ROLE_NAME="prize-roulette-lambda-role"
aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  2>/dev/null || true

aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  2>/dev/null || true

aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name prize-roulette-s3 \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::${S3_BUCKET}/roulette.json\"}]}" \
  2>/dev/null || true

# Wait for role propagation
echo "⏳ Waiting for IAM role propagation..."
sleep 10

ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest"

# 6. Create or update Lambda function
echo "⚡ Creating/Updating Lambda function..."

ENV_VARS="{\"Variables\":{\"ADMIN_PASSWORD\":\"${ADMIN_PASSWORD:-admin123}\",\"MEETUP_URL\":\"${MEETUP_URL:-https://www.meetup.com/aws-girls-peru/}\",\"WEB_APP_URL\":\"${WEB_APP_URL:-https://dicaalba.github.io/prize-roulette-wheel/}\",\"S3_BUCKET\":\"${S3_BUCKET}\"}}"

if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
  echo "  → Función existente, actualizando código..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --image-uri $IMAGE_URI \
    --region $REGION
  # Wait for code update before updating config
  aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION 2>/dev/null || sleep 10
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment "$ENV_VARS" \
    --region $REGION > /dev/null
else
  echo "  → Función nueva, creando..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --package-type Image \
    --code ImageUri=$IMAGE_URI \
    --role $ROLE_ARN \
    --timeout 10 \
    --memory-size 128 \
    --architectures x86_64 \
    --environment "$ENV_VARS" \
    --region $REGION
fi

# Wait for function to be active/updated
echo "⏳ Waiting for function to be ready..."
aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION 2>/dev/null || sleep 10

# 7. Create or get API Gateway
echo "🌐 Setting up API Gateway..."

EXISTING_API=$(aws apigatewayv2 get-apis --region $REGION \
  --query "Items[?Name=='$API_NAME'].ApiId" --output text 2>/dev/null)

if [ -z "$EXISTING_API" ] || [ "$EXISTING_API" == "None" ]; then
  echo "  → Creando nuevo API Gateway..."
  LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION \
    --query 'Configuration.FunctionArn' --output text)

  API_ID=$(aws apigatewayv2 create-api \
    --name $API_NAME \
    --protocol-type HTTP \
    --region $REGION \
    --cors-configuration 'AllowOrigins=*,AllowMethods=*,AllowHeaders=*' \
    --query 'ApiId' --output text)

  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id $API_ID \
    --integration-type AWS_PROXY \
    --integration-uri $LAMBDA_ARN \
    --payload-format-version 2.0 \
    --region $REGION \
    --query 'IntegrationId' --output text)

  aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key 'ANY /{proxy+}' \
    --target "integrations/$INTEGRATION_ID" \
    --region $REGION > /dev/null

  aws apigatewayv2 create-stage \
    --api-id $API_ID \
    --stage-name '$default' \
    --auto-deploy \
    --default-route-settings '{"ThrottlingBurstLimit":50,"ThrottlingRateLimit":20}' \
    --region $REGION > /dev/null

  aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --region $REGION > /dev/null 2>&1 || true
else
  API_ID=$EXISTING_API
  echo "  → API Gateway existente: $API_ID"
fi

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"

echo ""
echo "✅ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔌 API Backend: ${API_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📝 Actualiza public/js/config.js con esta URL:"
echo "     API_BASE_URL: '${API_URL}'"
echo ""
echo "  🌐 Frontend (GitHub Pages):"
echo "     🎰 Ruleta:  https://dicaalba.github.io/prize-roulette-wheel/"
echo "     🔐 Admin:   https://dicaalba.github.io/prize-roulette-wheel/admin/"
echo "     📺 Display: https://dicaalba.github.io/prize-roulette-wheel/display/"
echo ""
echo "⚠️  Notas:"
echo "  - WebSocket NO está soportado en Lambda."
echo "    El frontend usa HTTP polling automáticamente (cada 3s)."
echo "  - Los datos se guardan en S3 (bucket: ${S3_BUCKET}) para persistencia entre reinicios."
echo "  - Costo estimado: ~\$0 para unas horas de uso (free tier)."
echo ""
echo "🧹 Para limpiar después del evento:"
echo "  ./cleanup-aws.sh"
