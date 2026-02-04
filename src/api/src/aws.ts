import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { isLocalDev, mockDynamoDB, MOCK_USER, memoryStore } from './localDev';

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

export const ddb = new DynamoDBClient({
  region: AWS_REGION,
});

export const lambdaClient = new LambdaClient({
  region: AWS_REGION,
});

// Create mock DynamoDB document client for local dev
const createMockDocClient = () => {
  return {
    send: async (command: any) => {
      const commandName = command.constructor.name;
      const input = command.input;

      switch (commandName) {
        case 'GetCommand':
          return mockDynamoDB.get(input);
        case 'PutCommand':
          return mockDynamoDB.put(input);
        case 'QueryCommand':
          return mockDynamoDB.query(input);
        case 'DeleteCommand':
          return mockDynamoDB.delete(input);
        case 'ScanCommand':
          return mockDynamoDB.scan(input);
        case 'UpdateCommand':
          // Handle updates by getting, modifying, and putting back
          const existing = mockDynamoDB.get({
            TableName: input.TableName,
            Key: input.Key,
          });
          if (existing.Item) {
            // Apply updates (simplified)
            const updated = { ...existing.Item, updatedAt: new Date().toISOString() };
            if (input.ExpressionAttributeValues) {
              for (const [key, value] of Object.entries(input.ExpressionAttributeValues)) {
                const attrName = key.replace(':', '');
                updated[attrName] = value;
              }
            }
            mockDynamoDB.put({ TableName: input.TableName, Item: updated });
            return { Attributes: updated };
          }
          return { Attributes: undefined };
        default:
          console.log(`[LocalDev] Unhandled DynamoDB command: ${commandName}`);
          return {};
      }
    },
  };
};

export const doc = isLocalDev
  ? (createMockDocClient() as unknown as DynamoDBDocumentClient)
  : DynamoDBDocumentClient.from(ddb, {
      marshallOptions: { removeUndefinedValues: true },
    });

export const AWS_CONFIG = {
  region: AWS_REGION,
  isLambda,
  profile: isLambda ? 'lambda-role' : 'default',
};

// Export local dev utilities for use in other modules
export { isLocalDev, MOCK_USER, memoryStore };
