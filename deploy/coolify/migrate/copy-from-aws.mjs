// One-time copy of SupplyNet's real data out of AWS into the self-hosted setup.
//
// 1. Creates the table in DynamoDB Local with the same keys and indexes as AWS.
// 2. Copies every item from the AWS table.
// 3. Makes a login for every Cognito user (same user ID, new temporary password),
//    and writes the temporary passwords to a CSV file.
//
// Needs temporary AWS credentials in the environment (from CloudShell), plus:
//   SOURCE_TABLE        the AWS table name (DDB_TABLE_NAME from the Lambda)
//   USER_POOL_ID        the Cognito user pool (COGNITO_USER_POOL_ID from the Lambda)
//   DYNAMODB_ENDPOINT   DynamoDB Local's address on the server
//   TARGET_TABLE        optional, defaults to SOURCE_TABLE
//   EXTRA_LOGIN_EMAIL   optional, also make a login for this email (for testing)
// Safe to run again: items are re-copied and existing logins are left alone.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { promisify } from 'node:util';
import {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  ScanCommand,
  BatchWriteItemCommand,
  GetItemCommand,
  PutItemCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const REGION = process.env.AWS_REGION || 'us-east-1';
const SOURCE_TABLE = need('SOURCE_TABLE');
const TARGET_TABLE = process.env.TARGET_TABLE || SOURCE_TABLE;
const USER_POOL_ID = need('USER_POOL_ID');
const ENDPOINT = need('DYNAMODB_ENDPOINT');
const EXTRA_LOGIN_EMAIL = (process.env.EXTRA_LOGIN_EMAIL || '').trim().toLowerCase();
const OUT_FILE = process.env.OUT_FILE || 'deploy/coolify/migrate/temp-passwords.csv';

const aws = new DynamoDBClient({ region: REGION });
const local = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const cognito = new CognitoIdentityProviderClient({ region: REGION });
const scrypt = promisify(crypto.scrypt);

// Must match hashPassword() in src/api/src/helpers/selfHosted.ts
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function ensureTargetTable() {
  const { Table } = await aws.send(new DescribeTableCommand({ TableName: SOURCE_TABLE }));
  try {
    await local.send(new DescribeTableCommand({ TableName: TARGET_TABLE }));
    console.log(`Table ${TARGET_TABLE} already exists on the server.`);
    return;
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') throw err;
  }
  const gsis = (Table.GlobalSecondaryIndexes || []).map((g) => ({
    IndexName: g.IndexName,
    KeySchema: g.KeySchema,
    Projection: g.Projection,
  }));
  const lsis = (Table.LocalSecondaryIndexes || []).map((l) => ({
    IndexName: l.IndexName,
    KeySchema: l.KeySchema,
    Projection: l.Projection,
  }));
  await local.send(
    new CreateTableCommand({
      TableName: TARGET_TABLE,
      KeySchema: Table.KeySchema,
      AttributeDefinitions: Table.AttributeDefinitions,
      BillingMode: 'PAY_PER_REQUEST',
      ...(gsis.length ? { GlobalSecondaryIndexes: gsis } : {}),
      ...(lsis.length ? { LocalSecondaryIndexes: lsis } : {}),
    }),
  );
  await waitUntilTableExists({ client: local, maxWaitTime: 60 }, { TableName: TARGET_TABLE });
  console.log(`Created ${TARGET_TABLE} on the server with ${gsis.length} indexes.`);
}

async function copyItems() {
  let startKey;
  let total = 0;
  do {
    const page = await aws.send(new ScanCommand({ TableName: SOURCE_TABLE, ExclusiveStartKey: startKey }));
    const items = page.Items || [];
    for (let i = 0; i < items.length; i += 25) {
      let requests = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
      let attempt = 0;
      while (requests.length) {
        const res = await local.send(new BatchWriteItemCommand({ RequestItems: { [TARGET_TABLE]: requests } }));
        requests = res.UnprocessedItems?.[TARGET_TABLE] || [];
        if (requests.length) await new Promise((r) => setTimeout(r, 200 * ++attempt));
      }
    }
    total += items.length;
    startKey = page.LastEvaluatedKey;
    console.log(`  copied ${total} items so far`);
  } while (startKey);
  return total;
}

async function createLogin(email, sub) {
  const key = { PK: { S: `AUTH#${email}` }, SK: { S: 'CREDENTIALS' } };
  const existing = await local.send(new GetItemCommand({ TableName: TARGET_TABLE, Key: key }));
  if (existing.Item) return null;
  const password = crypto.randomBytes(12).toString('base64url'); // 16 characters
  const now = new Date().toISOString();
  await local.send(
    new PutItemCommand({
      TableName: TARGET_TABLE,
      Item: {
        ...key,
        email: { S: email },
        sub: { S: sub },
        passwordHash: { S: await hashPassword(password) },
        mustChangePassword: { BOOL: true },
        createdAt: { S: now },
        updatedAt: { S: now },
      },
    }),
  );
  return password;
}

async function createLogins() {
  const rows = [['email', 'temporary_password']];
  let token;
  let created = 0;
  let skipped = 0;
  do {
    const page = await cognito.send(
      new ListUsersCommand({ UserPoolId: USER_POOL_ID, PaginationToken: token, Limit: 60 }),
    );
    for (const user of page.Users || []) {
      const attrs = Object.fromEntries((user.Attributes || []).map((a) => [a.Name, a.Value]));
      const email = (attrs.email || '').trim().toLowerCase();
      if (!email || !attrs.sub) {
        skipped++;
        continue;
      }
      const password = await createLogin(email, attrs.sub);
      if (password) {
        rows.push([email, password]);
        created++;
      } else {
        skipped++;
      }
    }
    token = page.PaginationToken;
  } while (token);

  if (EXTRA_LOGIN_EMAIL) {
    const password = await createLogin(EXTRA_LOGIN_EMAIL, crypto.randomUUID());
    if (password) {
      rows.push([EXTRA_LOGIN_EMAIL, password]);
      created++;
    }
  }

  fs.writeFileSync(OUT_FILE, rows.map((r) => r.join(',')).join('\n') + '\n', { mode: 0o600 });
  return { created, skipped };
}

console.log(`Copying ${SOURCE_TABLE} from AWS into ${TARGET_TABLE} at ${ENDPOINT}`);
await ensureTargetTable();
const count = await copyItems();
console.log(`Copied ${count} items.`);
const { created, skipped } = await createLogins();
console.log(`Made ${created} logins (${skipped} skipped or already there).`);
console.log(`Temporary passwords are in ${OUT_FILE}. Hand them out, then delete that file.`);
