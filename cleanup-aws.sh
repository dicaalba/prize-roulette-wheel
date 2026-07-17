#!/bin/bash
# Cleanup AWS resources after the event
# Run this to avoid any ongoing charges

set -e

REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="prize-roulette-wheel"
REPO_NAME="prize-roulette-wheel"
ROLE_NAME="prize-roulette-lambda-role"

echo "🧹 Cleaning up AWS resources..."

# Delete Lambda function URL
echo "Removing Function URL..."
aws lambda delete-function-url-config --function-name $FUNCTION_NAME --region $REGION 2>/dev/null || true

# Delete Lambda function
echo "Deleting Lambda function..."
aws lambda delete-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null || true

# Delete ECR repository and all images
echo "Deleting ECR repository..."
aws ecr delete-repository --repository-name $REPO_NAME --region $REGION --force 2>/dev/null || true

# Detach policies and delete IAM role
echo "Cleaning up IAM role..."
aws iam detach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true
aws iam delete-role --role-name $ROLE_NAME 2>/dev/null || true

echo ""
echo "✅ All resources cleaned up. No ongoing charges."
