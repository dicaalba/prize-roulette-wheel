FROM public.ecr.aws/lambda/nodejs:20

COPY src/ ${LAMBDA_TASK_ROOT}/src/
COPY public/ ${LAMBDA_TASK_ROOT}/public/
COPY package.json ${LAMBDA_TASK_ROOT}/

RUN npm install --production 2>/dev/null || true

COPY lambda.js ${LAMBDA_TASK_ROOT}/

CMD ["lambda.handler"]
