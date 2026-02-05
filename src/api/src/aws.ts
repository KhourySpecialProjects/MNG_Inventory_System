import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { isLocalDev, MOCK_USER } from './localDev';

// Hardcode region; change if needed
const AWS_REGION = 'us-east-1';

// Detect Lambda runtime
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Reusable singletons (only create real clients if not in local dev mode)
export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});

export const sesClient = new SESv2Client({
  region: AWS_REGION,
});

export const s3Client = new S3Client({
  region: AWS_REGION,
});

// DynamoDB client configuration
// In local dev mode, connect to DynamoDB Local running in Docker (credentials don't matter for that)
export const ddb = new DynamoDBClient(
  isLocalDev
    ? {
        region: AWS_REGION,
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
        credentials: {
          accessKeyId: 'dummy',
          secretAccessKey: 'dummy',
        },
      }
    : {
        region: AWS_REGION,
      },
);

export const lambdaClient = new LambdaClient({
  region: AWS_REGION,
});

// DynamoDB Document Client - works with both local and AWS DynamoDB
export const doc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

export const AWS_CONFIG = {
  region: AWS_REGION,
  isLambda,
  profile: isLambda ? 'lambda-role' : 'default',
};

// Export local dev utilities for use in other modules
export { isLocalDev, MOCK_USER };
