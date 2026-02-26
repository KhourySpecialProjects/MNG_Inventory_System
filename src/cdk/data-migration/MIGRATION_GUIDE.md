# MNG Inventory System - Data Migration Guide

This guide explains how to use `scripts/migrate-teams-items.ts` to migrate team and inventory data between environments.

## What Gets Migrated

| Data | Migrated? | Notes |
|---|---|---|
| Team metadata | Yes | `ownerId` rewritten to migration user |
| Inventory items (including kits and kit children) | Yes | `createdBy` and `updateLog` rewritten to migration user |
| Item images (S3) | Yes | Copied from source to destination bucket |
| Team membership records | No | A new MEMBER record is created for the migration user per team |
| User records | No | Users are managed via Cognito in the destination |
| Role records | No | Roles are seeded automatically by CDK on deploy |
| Profile images | No | Tied to user records |
| Generated documents (PDFs/CSVs) | No | Can be regenerated via the export feature |

## Prerequisites

1. **Node.js 20+** and project dependencies installed (`npm install`)
2. **AWS CLI profiles** configured for both source and destination accounts
3. **A user already exists** in the destination environment's Cognito user pool (this is the "migration user" who will own all migrated data)
4. **The destination stack is deployed** (DynamoDB table, S3 bucket, Cognito pool all exist)
5. **ts-node** available (`npx ts-node` will use the project's dependency)

## Configuration

Open `scripts/migrate-teams-items.ts` and set the configuration variables at the top of the file:

```ts
const REGION = 'us-east-1';

// DynamoDB tables
const SOURCE_TABLE = 'mng-dev-data';        // Source table name
const DEST_TABLE   = 'mng-prod-data';       // Destination table name

// S3 buckets
const SOURCE_BUCKET = 'mng-dev-uploads-245120345540';
const DEST_BUCKET   = 'mng-prod-uploads-245120345540';

// Migration user (must already exist in destination Cognito)
const MIGRATION_USER_SUB  = '...';  // Cognito sub (user ID)
const MIGRATION_USER_NAME = '...';  // Display name

// AWS CLI profiles
const SOURCE_PROFILE = 'my_source_profile';
const DEST_PROFILE   = 'my_dest_profile';

// Set to true for same-account, false for cross-account
const SAME_ACCOUNT = true;
```

### Finding the Migration User's Cognito Sub

The migration user must already be signed up and confirmed in the destination Cognito user pool. To find their `sub`:

```bash
# Using AWS CLI
aws cognito-idp list-users \
  --user-pool-id <POOL_ID> \
  --filter "email = \"user@example.com\"" \
  --profile <DEST_PROFILE>
```

The `sub` is listed in the `Attributes` array of the response. It looks like a UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### Finding Table and Bucket Names

Table and bucket names follow the pattern `mng-{stage}-data` and `mng-{stage}-uploads-{accountId}`. You can find the exact names from CDK outputs:

```bash
# Check CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name MNG-{stage}-DynamoStack \
  --query "Stacks[0].Outputs" \
  --profile <PROFILE>

aws cloudformation describe-stacks \
  --stack-name MNG-{stage}-S3UploadsStack \
  --query "Stacks[0].Outputs" \
  --profile <PROFILE>
```

## Running the Migration

### Step 1: Dry Run

Always run a dry run first to verify what will be migrated:

```bash
npx ts-node scripts/migrate-teams-items.ts --dry-run
```

This will:
- Scan the source table and list all records found
- Show how many teams, items, and member records will be created
- Check for team name conflicts in the destination
- List all S3 objects that would be copied
- Make **no changes** to either environment

### Step 2: Execute the Migration

```bash
npx ts-node scripts/migrate-teams-items.ts
```

The script will:
1. Scan all records from the source DynamoDB table
2. Filter to team metadata + item records only
3. Check for team name conflicts in the destination (with a 5-second abort window)
4. Rewrite all user references (`ownerId`, `createdBy`, `updateLog`) to the migration user
5. Create MEMBER records granting the migration user OWNER access to each team
6. Batch write all records to the destination table
7. Copy all item images from the source S3 bucket to the destination

### Step 3: Verify

1. Log into the destination environment
2. Confirm all teams appear in the migration user's team list
3. Open each team and verify items are present with correct data
4. Spot-check that item images load correctly
5. Invite additional team members through the UI as needed

---

## Scenario 1: Same-Account Migration (e.g., dev -> prod)

This is the simpler case. Both stacks are in the same AWS account, just different stages.

### Setup

```ts
const SOURCE_PROFILE = 'mng_inventory';
const DEST_PROFILE   = 'mng_inventory';  // Same profile
const SAME_ACCOUNT   = true;
```

### AWS Profile Configuration

You need a single profile in `~/.aws/credentials` with permissions to access both stacks:

```ini
[mng_inventory]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
region = us-east-1
```

### Required IAM Permissions

The IAM user/role needs:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Scan",
    "dynamodb:BatchWriteItem",
    "dynamodb:Query"
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:<ACCOUNT>:table/mng-dev-data",
    "arn:aws:dynamodb:us-east-1:<ACCOUNT>:table/mng-dev-data/index/*",
    "arn:aws:dynamodb:us-east-1:<ACCOUNT>:table/mng-prod-data",
    "arn:aws:dynamodb:us-east-1:<ACCOUNT>:table/mng-prod-data/index/*"
  ]
},
{
  "Effect": "Allow",
  "Action": [
    "s3:ListBucket",
    "s3:GetObject",
    "s3:PutObject",
    "s3:CopyObject"
  ],
  "Resource": [
    "arn:aws:s3:::mng-dev-uploads-*",
    "arn:aws:s3:::mng-dev-uploads-*/*",
    "arn:aws:s3:::mng-prod-uploads-*",
    "arn:aws:s3:::mng-prod-uploads-*/*"
  ]
},
{
  "Effect": "Allow",
  "Action": [
    "kms:Decrypt",
    "kms:GenerateDataKey",
    "kms:DescribeKey"
  ],
  "Resource": [
    "arn:aws:kms:us-east-1:<ACCOUNT>:key/*"
  ],
  "Condition": {
    "StringLike": {
      "kms:RequestAlias": [
        "alias/mng-*-kms-key",
        "alias/mng-*-dynamodb-key"
      ]
    }
  }
}
```

Both the DynamoDB tables and S3 buckets are encrypted with customer-managed KMS keys. You need `kms:Decrypt` on the source keys and `kms:GenerateDataKey` on the destination keys. In the same-account scenario, the S3 `CopyObject` command handles re-encryption automatically using the destination bucket's default encryption settings.

---

## Scenario 2: Cross-Account Migration (e.g., your account -> client's account)

This is used when moving the system to a different AWS account entirely.

### Setup

```ts
const SOURCE_PROFILE = 'my_account';
const DEST_PROFILE   = 'client_account';  // Different profile
const SAME_ACCOUNT   = false;             // Must be false
```

### AWS Profile Configuration

You need two profiles in `~/.aws/credentials`:

```ini
[my_account]
aws_access_key_id = AKIA_SOURCE...
aws_secret_access_key = ...
region = us-east-1

[client_account]
aws_access_key_id = AKIA_DEST...
aws_secret_access_key = ...
region = us-east-1
```

If the client provides an IAM role instead of credentials, use role assumption:

```ini
[client_account]
role_arn = arn:aws:iam::<CLIENT_ACCOUNT>:role/MigrationRole
source_profile = my_account
region = us-east-1
```

### Required Permissions - Source Account

The source profile needs read access:

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:Scan"],
  "Resource": "arn:aws:dynamodb:us-east-1:<SOURCE_ACCOUNT>:table/mng-*-data"
},
{
  "Effect": "Allow",
  "Action": ["s3:ListBucket", "s3:GetObject"],
  "Resource": ["arn:aws:s3:::mng-*-uploads-*", "arn:aws:s3:::mng-*-uploads-*/*"]
},
{
  "Effect": "Allow",
  "Action": ["kms:Decrypt", "kms:DescribeKey"],
  "Resource": "arn:aws:kms:us-east-1:<SOURCE_ACCOUNT>:key/*"
}
```

### Required Permissions - Destination Account

The destination profile needs write access:

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:BatchWriteItem", "dynamodb:Query"],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:<DEST_ACCOUNT>:table/mng-*-data",
    "arn:aws:dynamodb:us-east-1:<DEST_ACCOUNT>:table/mng-*-data/index/*"
  ]
},
{
  "Effect": "Allow",
  "Action": ["s3:PutObject"],
  "Resource": ["arn:aws:s3:::mng-*-uploads-*", "arn:aws:s3:::mng-*-uploads-*/*"]
},
{
  "Effect": "Allow",
  "Action": ["kms:GenerateDataKey", "kms:DescribeKey"],
  "Resource": "arn:aws:kms:us-east-1:<DEST_ACCOUNT>:key/*"
}
```

### Cross-Account S3 Behavior

When `SAME_ACCOUNT = false`, the script downloads each image from the source bucket to local memory, then uploads it to the destination bucket. This avoids the need for cross-account S3 bucket policies on the source. The destination bucket's default KMS encryption applies automatically on upload.

This is slower than server-side copy but works without any bucket policy changes.

### Preparing the Destination Account

Before running the migration, the client's account must have:

1. **The CDK stacks deployed** (`npm run deploy:prod` or equivalent)
2. **At least one Cognito user created** (sign up through the app or via CLI)
3. **The user's Cognito `sub` identified** (see "Finding the Migration User's Cognito Sub" above)

---

## Post-Migration Steps

After the migration completes:

1. **Verify data integrity**: Log in as the migration user and check that all teams and items are present with correct statuses, descriptions, and images.

2. **Invite team members**: The migration user is the sole OWNER of all migrated teams. Use the application UI to invite additional users to each team.

3. **Test exports**: Generate a DA Form 2404 or inventory export to verify the export Lambda functions work correctly with the migrated data.

4. **Clean up audit trail** (optional): All `updateLog` entries now show the migration user. If preserving the original audit history matters, you could modify the script to skip `updateLog` rewriting -- but this would leave references to user IDs that don't exist in the destination, which may cause display issues.

## Troubleshooting

### "Access Denied" on S3 operations
- Verify KMS permissions. Both source and destination buckets use customer-managed KMS keys. You need `kms:Decrypt` on source keys and `kms:GenerateDataKey` on destination keys.
- For cross-account: ensure `SAME_ACCOUNT = false` so the script uses download-then-upload instead of `CopyObject`.

### "Team name already exists" warning
- The destination already has a team with the same name. The script will overwrite it after a 5-second warning. To avoid this, rename the conflicting team in the destination first.

### Items appear but images don't load
- Check that the S3 objects were copied to the correct bucket. Image keys follow the pattern `items/{teamId}/{identifier}.{ext}`.
- Verify the API Lambda has `s3:GetObject` and `kms:Decrypt` permissions on the destination bucket and its KMS key.

### "UnprocessedItems" errors
- DynamoDB throttling. The script retries up to 3 times with backoff. If items still fail, you can re-run the script safely -- `BatchWriteItem` with `PutRequest` is idempotent (it overwrites existing records).

### Migration user can't see teams
- Verify the MEMBER records were created. Check DynamoDB for records with `PK=TEAM#{teamId}` and `SK=MEMBER#{migrationUserSub}`.
- Verify the GSI attributes are present: `GSI1PK=USER#{sub}` and `GSI1SK=TEAM#{teamId}`.
