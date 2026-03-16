# Fresh AWS Account Setup Guide

This guide walks through deploying the MNG Inventory System on a brand-new AWS account, from scratch. It covers bootstrapping, domain configuration, email setup, and data migration from an existing deployment.

---

## Prerequisites

- An AWS account with admin access
- A registered domain name (e.g., from Porkbun, GoDaddy, Namecheap)
- Node.js 20+ installed
- Docker installed (for local development)
- AWS CLI configured with credentials

## Step 1: AWS CLI Configuration

Create an IAM user with admin access in the new AWS account and configure a local profile:

```bash
aws configure --profile mng-new
# Enter: Access Key ID, Secret Access Key, region (us-east-1), output (json)
```

Verify access:

```bash
aws sts get-caller-identity --profile mng-new
```

## Step 2: Bootstrap CDK

CDK bootstrap provisions an S3 bucket and IAM roles that CDK needs to deploy stacks. This is a one-time operation per account/region.

```bash
AWS_PROFILE=mng-new npx cdk bootstrap aws://<NEW_ACCOUNT_ID>/us-east-1
```

You should see output ending with `Environment aws://<ACCOUNT_ID>/us-east-1 bootstrapped`.

## Step 3: Update Account Configuration

In `src/cdk/bin/app.ts`, update the default account ID on line 24:

```typescript
const account = process.env.CDK_DEFAULT_ACCOUNT ?? '<NEW_ACCOUNT_ID>';
```

## Step 4: Initial Dev Deployment (Recommended)

Before setting up production with a custom domain, do a dev deployment to verify everything works:

### 4a. Verify a sender email in SES

1. Go to the [SES Console](https://console.aws.amazon.com/ses/) in `us-east-1`.
2. Navigate to **Identities** > **Create identity** > **Email address**.
3. Enter your email address and confirm via the verification link sent to your inbox.
4. Also verify any recipient email addresses you plan to test with (sandbox mode restriction).

### 4b. Deploy dev stacks

```bash
npm install
npm run build
AWS_PROFILE=mng-new SES_FROM_ADDRESS=you@example.com npm run deploy:dev
```

This deploys all stacks except DnsStack. The app will be available at the CloudFront URL shown in the WebStack output.

### 4c. Verify the dev deployment

1. Open the CloudFront URL in a browser.
2. Sign up a test user through the app.
3. Check that the verification email arrives (you may need to check spam).
4. Sign in, create a team, and add some items to verify DynamoDB and S3 work correctly.

## Step 5: Register and Configure a Custom Domain

### 5a. Deploy with SITE_DOMAIN

```bash
AWS_PROFILE=mng-new SITE_DOMAIN=yourdomain.com ALLOW_PROD_DEPLOY=true npm run deploy:prod
```

This creates the DnsStack (Route 53 hosted zone + ACM certificate) along with all other stacks. The first deploy may take 10-15 minutes because ACM certificate validation requires DNS propagation.

### 5b. Copy NS Records to Your Registrar

After the deploy completes, find the nameserver records:

```bash
aws cloudformation describe-stacks \
  --stack-name MngDns-prod \
  --query "Stacks[0].Outputs[?OutputKey=='NameServers'].OutputValue" \
  --output text \
  --profile mng-new
```

This returns 4 nameservers like:

```
ns-1234.awsdns-56.org, ns-789.awsdns-01.co.uk, ns-456.awsdns-23.com, ns-012.awsdns-78.net
```

Go to your domain registrar (e.g., Porkbun):

1. Navigate to your domain's DNS settings.
2. Find the **Nameservers** section.
3. Replace the default nameservers with the 4 AWS nameservers from above.
4. Save the changes.

### 5c. Wait for DNS Propagation

DNS propagation typically takes 15 minutes to a few hours, but can take up to 48 hours. You can check progress:

```bash
# Check if NS records have propagated
dig NS yourdomain.com

# Check if the ACM certificate is validated
aws acm list-certificates --profile mng-new --query "CertificateSummaryList[?DomainName=='yourdomain.com'].Status"
```

Once DNS propagates, the ACM certificate will automatically validate (CDK uses DNS validation via Route 53).

### 5d. Verify the domain is working

Open `https://yourdomain.com` in a browser. You should see the application served with a valid SSL certificate.

## Step 6: Get Out of SES Sandbox Mode

New AWS accounts start in SES sandbox mode, which means you can only send emails to verified addresses. To send to any address (required for user invitations):

### 6a. Request production access

1. Go to the [SES Console](https://console.aws.amazon.com/ses/) > **Account dashboard**.
2. Click **Request production access**.
3. Fill out the form:
   - **Mail type**: Transactional
   - **Website URL**: `https://yourdomain.com`
   - **Use case description**: Explain that the system sends transactional emails only (user invitations, password resets, MFA codes). Example:

     > This is an internal inventory management system for the Massachusetts National Guard. We send transactional emails only: user invitation links, password reset codes, and MFA verification codes. Expected volume is under 100 emails per day. We have DKIM, SPF, and DMARC configured via our CDK deployment.

4. Submit the request.

### 6b. Wait for approval

AWS typically reviews and approves sandbox removal requests within 24 hours. You'll receive an email notification. You can check status in the SES console under **Account dashboard**.

### 6c. Verify domain identity is active

The CDK deployment automatically creates the SES domain identity with DKIM records. Verify it's active:

```bash
aws sesv2 get-email-identity --email-identity yourdomain.com --profile mng-new
```

Look for `"VerificationStatus": "SUCCESS"` and all three DKIM tokens showing `"Status": "SUCCESS"`.

The CDK also creates a DMARC record (`_dmarc.yourdomain.com`) with policy `quarantine`. This helps ensure email deliverability and prevents spoofing.

## Step 7: Migrate Data from Existing Account

If you have an existing deployment with data to migrate, use the migration script to transfer teams, items, and templates to the new account.

### 7a. Prerequisites

- AWS CLI profiles configured for both the source and destination accounts.
- At least one user signed up in the **destination** Cognito user pool (this is the "migration user" who will own all migrated data).
- The destination stacks are fully deployed.

### 7b. Find the migration user's Cognito sub

The migration user must already exist in the destination Cognito pool. Find their `sub`:

```bash
# Find the User Pool ID
aws cognito-idp list-user-pools --max-results 10 --profile mng-new \
  --query "UserPools[?Name=='mng-prod-users'].Id" --output text

# Find the user's sub
aws cognito-idp list-users \
  --user-pool-id <POOL_ID> \
  --filter "email = \"admin@yourdomain.com\"" \
  --profile mng-new
```

The `sub` is a UUID in the `Attributes` array (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### 7c. Find table and bucket names

```bash
# Destination table name
aws cloudformation describe-stacks \
  --stack-name MngDynamo-prod \
  --query "Stacks[0].Outputs[?contains(OutputKey,'TableName')].OutputValue" \
  --output text --profile mng-new

# Destination bucket name
aws cloudformation describe-stacks \
  --stack-name MngS3-prod \
  --query "Stacks[0].Outputs[?contains(OutputKey,'BucketName')].OutputValue" \
  --output text --profile mng-new
```

Repeat for the source account with the source profile.

### 7d. Configure the migration script

Open `src/cdk/data-migration/migrate-teams-items.ts` and set the configuration variables:

```typescript
const REGION = 'us-east-1';

const SOURCE_TABLE = 'mng-prod-data';           // Source table name
const DEST_TABLE = 'mng-prod-data';             // Destination table name

const SOURCE_BUCKET = 'mng-prod-uploads-111111111111';  // Source bucket
const DEST_BUCKET = 'mng-prod-uploads-222222222222';    // Destination bucket

const MIGRATION_USER_SUB = 'a1b2c3d4-...';     // Destination user's Cognito sub
const MIGRATION_USER_NAME = 'Admin User';       // Display name for audit trail

const SOURCE_PROFILE = 'mng-old';              // AWS profile for source account
const DEST_PROFILE = 'mng-new';               // AWS profile for destination account

const SAME_ACCOUNT = false;                    // false for cross-account migration
```

### 7e. Understand user attribution

**All user references in migrated data are rewritten** to the migration user. This includes:

- `ownerId` on team metadata (the team's designated owner)
- `createdBy` on items and templates (who created the record)
- `updateLog` entries on items and templates (userId and userName in the audit trail)

This rewriting is necessary because Cognito user IDs (`sub` values) are unique per user pool. Users from the source account's Cognito pool do not exist in the destination's pool, so referencing them would cause lookup failures and display errors.

**After migration:**
- The migration user appears as the owner/creator of all migrated data.
- Original audit trail timestamps and actions are preserved, but the user attribution shows the migration user.
- New users must be invited to the destination environment through the app's invitation flow. They will get fresh Cognito accounts in the new pool.
- Use the app UI to transfer team ownership and adjust member roles as needed.

### 7f. Set up IAM permissions

The migration script needs specific permissions in both accounts. For cross-account migration:

**Source account (read-only):**
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

**Destination account (write):**
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

Both DynamoDB tables and S3 buckets use customer-managed KMS keys. For cross-account migration, the script downloads images to memory and re-uploads them (no bucket policy changes needed on the source).

### 7g. Run the migration

```bash
# Always do a dry run first
npx ts-node src/cdk/data-migration/migrate-teams-items.ts --dry-run

# Execute the migration
npx ts-node src/cdk/data-migration/migrate-teams-items.ts
```

### 7h. Verify the migration

1. Log in as the migration user in the destination environment.
2. Confirm all teams appear in the team list.
3. Open each team and verify items are present with correct data and images.
4. Navigate to the Templates page and verify all templates and template items migrated correctly.
5. Generate a test export (DA Form 2404 or inventory CSV) to verify the export functions work.
6. Invite additional users through the app and assign them to teams.

For detailed troubleshooting, see [MIGRATION_GUIDE.md](src/cdk/data-migration/MIGRATION_GUIDE.md).

---

## Summary Checklist

- [ ] AWS CLI configured with admin credentials
- [ ] CDK bootstrapped (`cdk bootstrap`)
- [ ] Account ID updated in `src/cdk/bin/app.ts`
- [ ] Dev deployment verified (optional but recommended)
- [ ] Prod deployment with `SITE_DOMAIN`
- [ ] Domain registrar nameservers updated to Route 53 NS records
- [ ] DNS propagated and ACM certificate validated
- [ ] SES production access requested and approved
- [ ] SES domain identity verified (DKIM + DMARC)
- [ ] Data migrated from source account (if applicable)
- [ ] Migration verified (teams, items, templates, images, exports)
- [ ] Additional users invited through the app
