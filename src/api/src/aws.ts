import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { isLocalDev, MOCK_USER } from './localDev';
import { SELF_HOSTED, localCognito, localSes, localLambda } from './helpers/selfHosted';

// Hardcode region; change if needed
const AWS_REGION = 'us-east-1';

// Detect Lambda runtime
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Reusable singletons.
// When SELF_HOSTED=true (Coolify), the app's own login, email and export runner
// stand in for Cognito, SES and Lambda, so nothing here talks to AWS.
export const cognitoClient = (
  SELF_HOSTED ? localCognito : new CognitoIdentityProviderClient({ region: AWS_REGION })
) as CognitoIdentityProviderClient;

export const sesClient = (
  SELF_HOSTED ? localSes : new SESv2Client({ region: AWS_REGION })
) as SESv2Client;

/**
 * S3 client used everywhere in the API.
 * When S3_ENDPOINT is set it talks to Garage (or any S3-compatible storage) instead of AWS.
 */
export function makeS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || AWS_REGION,
    ...(process.env.S3_ENDPOINT
      ? {
          endpoint: process.env.S3_ENDPOINT,
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
          },
        }
      : {}),
  });
}

export const s3Client = makeS3Client();

// DynamoDB client configuration.
// Local dev and self-hosted mode both use DynamoDB Local (credentials don't matter for it).
const dynamoEndpoint = isLocalDev
  ? process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
  : process.env.DYNAMODB_ENDPOINT;

export const ddb = new DynamoDBClient(
  dynamoEndpoint
    ? {
        region: AWS_REGION,
        endpoint: dynamoEndpoint,
        credentials: {
          accessKeyId: 'dummy',
          secretAccessKey: 'dummy',
        },
      }
    : {
        region: AWS_REGION,
      },
);

export const lambdaClient = (
  SELF_HOSTED ? localLambda : new LambdaClient({ region: AWS_REGION })
) as LambdaClient;

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
