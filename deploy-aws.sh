#!/bin/bash
# Deploy Prize Roulette Wheel to AWS Lambda + Function URL
# The cheapest option: pay only per invocation (~$0 for a few hours of use)
# Prerequisites: AWS CLI configured, Docker installed

set -e

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="prize-roulette-wheel"
FUNCTION_NAME="prize-roulette-wheel"

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

# 3. Build and push Docker image
echo "🐳 Building Docker image..."
docker build -t $REPO_NAME .
docker tag $REPO_NAME:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

echo "📤 Pushing to ECR..."
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

# 4. Create IAM role for Lambda (if not exists)
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

# Wait for role propagation
echo "⏳ Waiting for IAM role propagation..."
sleep 10

ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"

# 5. Create or update Lambda function
echo "⚡ Creating/Updating Lambda function..."
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --package-type Image \
  --code ImageUri=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest \
  --role $ROLE_ARN \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123},MEETUP_URL=${MEETUP_URL:-https://www.meetup.com},WEB_APP_URL=${WEB_APP_URL:-}}" \
  --region $REGION 2>/dev/null || \
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --image-uri $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest \
  --region $REGION

# Wait for function to be active
echo "⏳ Waiting for function to be active..."
aws lambda wait function-active --function-name $FUNCTION_NAME --region $REGION 2>/dev/null || sleep 5

# 6. Create Function URL (simplest + cheapest: no API Gateway needed)
echo "🌐 Creating Function URL..."
aws lambda create-function-url-config \
  --function-name $FUNCTION_NAME \
  --auth-type NONE \
  --region $REGION 2>/dev/null || true

# Get the URL
FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION --query 'FunctionUrl' --output text)

# 7. Add permission for public access
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region $REGION 2>/dev/null || true

echo ""
echo "✅ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎰 Ruleta:  ${FUNCTION_URL}"
echo "  🔐 Admin:   ${FUNCTION_URL}admin"
echo "  📺 Display: ${FUNCTION_URL}display"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Notas:"
echo "  - WebSocket NO está soportado en Lambda."
echo "    El frontend usa HTTP polling automáticamente."
echo "  - Los datos se guardan en /tmp (efímeros por invocación)."
echo "    Para persistencia, configura DynamoDB o S3."
echo "  - Costo estimado: ~\$0 para unas horas de uso."
echo ""
echo "🧹 Para limpiar después del evento:"
echo "  ./cleanup-aws.sh"
