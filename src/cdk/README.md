# CDK Documentation

This document describes the infrastructure components defined in the CDK folder and how they support the system.

---

## Overview

The CDK folder contains all infrastructure definitions, shared configuration, and cross-stack wiring. The stacks provision the runtime environment for the API, frontend, authentication, storage, and email systems. There are **8 stacks** total, orchestrated by `bin/app.ts`.

All stacks follow the naming convention `Mng{Component}-{stage}` (e.g., `MngApi-dev`, `MngWeb-prod`).

---

## Stacks

### **App (bin/app.ts)**

The CDK entry point that orchestrates all stacks. Key responsibilities:

- **Stage resolution**: Reads stage from CDK context (`-c stage=dev`) or `STAGE` env var.
- **Domain detection**: If `SITE_DOMAIN` is set and the stage is not dev/local/beta, enables custom domain mode (Route 53, ACM, SES domain identity).
- **CORS origins**: Builds an explicit list of allowed origins (never `["*"]`) based on whether a custom domain is in use.
- **Cross-stack wiring**: Passes outputs between stacks (e.g., DynamoDB table ARN to ApiStack, Cognito pool ID to API Lambda environment).
- **Dependency ordering**: Auth stack depends on SES (domain identity must exist before Cognito can send verification emails).

**Environment variables consumed:**
| Variable | Purpose | Required |
|----------|---------|----------|
| `SITE_DOMAIN` | Custom domain (e.g., `mng-inv.nunext.com`) | Prod only |
| `SES_FROM_ADDRESS` | Verified sender email for sandbox mode | Dev only |
| `COGNITO_CALLBACK_URLS` | Override OAuth callback URLs | No |
| `COGNITO_LOGOUT_URLS` | Override OAuth logout URLs | No |
| `ALLOW_PROD_DEPLOY` | Safety gate for prod deploys | Prod only |

---

### **DnsStack** *(prod only)*

Created only when `SITE_DOMAIN` is set and the stage is not dev/local/beta.

- **Route 53 Hosted Zone**: Creates a public hosted zone for the custom domain.
- **ACM Certificate**: Covers both the apex domain and `*.{domain}` (wildcard). Uses DNS validation via Route 53 for automatic renewal.
- **Manual step required**: After first deploy, copy the NS records from CloudFormation outputs and update your domain registrar's nameservers to point to them.

**Outputs:** HostedZoneId, NameServers, CertificateArn

---

### **AuthStack**

- Creates the **Cognito User Pool** (`{service}-{stage}-users`) with email-based sign-in.
- **MFA**: EMAIL_OTP enforced for all users (set via L1 override on the CfnUserPool).
- **Password policy**: Minimum 10 characters, requires lowercase + uppercase + digits.
- **Email channel**: Uses SES domain identity in production (`no-reply@{domain}`) or Cognito's built-in email service in dev.
- Creates an **App Client** with OAuth 2.0 authorization code grant, callback/logout URLs derived from allowed origins.
- **Token validity**: Access token 1 hour, refresh token 30 days.
- Depends on SesStack (must deploy SES identity before auth can send emails).

**Outputs:** UserPoolId, UserPoolArn, UserPoolClientId, HostedUiDomain, IssuerUrl, JwksUri

---

### **DynamoStack**

- Creates the primary table (`{service}-{stage}-data`) with `PK`/`SK` string keys and on-demand billing.
- **Encryption**: Customer-managed KMS key with automatic rotation.
- **Backup**: Point-in-time recovery enabled (35-day retention).
- **Monitoring**: Contributor Insights enabled for CloudWatch metrics.
- **Deletion protection**: Enabled in production.
- **TTL**: Configured on `ttl` attribute for auto-expiring records.

**Global Secondary Indexes (5):**
| GSI | Partition Key | Sort Key | Use Case |
|-----|---------------|----------|----------|
| GSI_WorkspaceByName | `GSI_NAME` | `SK` | Query teams by name |
| GSI_UsersByUid | `GSI6PK` | `GSI6SK` | Query users by UID |
| GSI_UsersByUsername | `username` | `SK` | Unique username lookup |
| GSI_RolesByName | `ROLENAME` | `SK` | Query roles by name |
| GSI_UserTeams | `GSI1PK` | `GSI1SK` | User's team membership, template listing |

**Default roles seeded on deploy** via custom resource (idempotent, updates overwrite):
- **OWNER**: 24 permissions (full control including templates)
- **MANAGER**: 13 permissions (team/item/template management)
- **MEMBER**: 5 permissions (view items/templates, create/view reports)

---

### **ApiStack**

- **Lambda function** (`{service}-{stage}-trpc`): Node.js 20, bundled with esbuild (CJS, minified, source maps).
  - Memory: 512 MB (dev) / 1024 MB (prod)
  - Timeout: 15 sec (dev) / 20 sec (prod)
- **HTTP API Gateway v2** with CORS preflight (credentials enabled, specific origin list, 12-hour cache).
- Routes: `/trpc/{proxy+}` (any method) and `/health` (GET) → Lambda integration.
- Environment variables injected by `app.ts`: Cognito config, DynamoDB table, S3 bucket, SES sender, export function names, allowed origins, web URL.

**IAM permissions granted to API Lambda:**
- Cognito admin actions (create/update/confirm users, initiate auth)
- SES SendEmail/SendRawEmail (restricted to verified sender)
- DynamoDB full read/write
- S3 read/write + KMS encrypt/decrypt
- Lambda invoke on both export functions

**Outputs:** HttpApiInvokeUrl, FunctionName, TableName

---

### **ExportLambdaStack**

Python 3.11 Lambda functions for generating reports:

- **pdf2404Function**: Generates DA Form 2404 PDFs using a template PDF from S3. Uses reportlab + pypdf.
- **inventoryFunction**: Generates inventory CSV exports from DynamoDB data.
- **pdfLayer**: Shared Lambda layer with PDF processing dependencies (pypdf, pillow, reportlab).

Both functions get DynamoDB read access, S3 read/write access, and share environment variables (TABLE_NAME, UPLOADS_BUCKET, KMS_KEY_ARN, TEMPLATE_PATH).

**Outputs:** Function ARNs for invocation by the API Lambda.

---

### **WebStack**

- **S3 bucket**: Hosts frontend build artifacts. Fully locked down (block all public access, enforce SSL).
- **CloudFront distribution**:
  - Default behavior: S3 origin via OAI, caching optimized.
  - API behaviors: `/trpc/*`, `/health`, `/hello` proxied to API Gateway (caching disabled, all cookies/query strings forwarded).
  - SPA routing: 404 → 200 with `/index.html`.
  - Custom domain: When enabled, attaches ACM certificate and creates Route 53 A-record alias.
- **Frontend deployment**: Uploads built files from `src/frontend/dist` and invalidates CloudFront cache.

**Outputs:** SiteUrl, DistributionDomain, ApiDomainName

---

### **S3UploadsStack**

- **Uploads bucket** (`mng-{stage}-uploads-{accountId}`): Stores item images, template images, and generated documents.
- **Encryption**: Customer-managed KMS key with rotation.
- **Versioning**: Enabled for all objects.
- **CORS**: Allows all origins (presigned URL uploads from browser).
- **Lifecycle rules**:
  - `Documents/` prefix: Auto-expire after 30 days (generated PDFs/CSVs).
  - `temp/` prefix: Auto-expire after 90 days.
- **Python scripts deployed**: `2404-handler.py`, `inventory-handler.py`, and `2404-template.pdf` uploaded to the bucket on deploy.

---

### **SesStack**

Two operating modes based on whether a custom domain is configured:

**Production (domain identity):**
- Creates SES domain identity with automatic DKIM DNS records.
- Sets mail-from domain to `mail.{domain}`.
- Creates DMARC TXT record (`v=DMARC1; p=quarantine`).
- Sender address: `noreply@{domain}`.

**Dev/sandbox (email identity):**
- Uses `SES_FROM_ADDRESS` env var (must be pre-verified in SES console).
- Can only send to other verified email addresses.

**Both modes:**
- Configuration set with reputation metrics, TLS required, bounce/complaint suppression.
- SNS feedback topic for email event notifications (send, bounce, complaint, delivery, open, click).
- Managed IAM policy restricting sends to the configured from-address and configuration set.

**Outputs:** Stage, FromAddress, ConfigSetName, Mode, FeedbackTopicArn, SesSendPolicyArn

---

## Stage Configuration (`stage.ts`)

| Property | Dev | Prod |
|----------|-----|------|
| Lambda memory | 512 MB | 1024 MB |
| Lambda timeout | 15 sec | 20 sec |
| Auto-delete objects | Yes | No |
| Removal policy | DESTROY | RETAIN |
| Deletion protection | No | Yes |
| NODE_ENV | development | production |

---

## Stack Dependency Graph

```
DnsStack (prod only)
  ├── SesStack (uses hosted zone for domain identity + DKIM)
  │     └── AuthStack (depends on SES for email sending)
  └── WebStack (uses hosted zone + certificate for custom domain)

DynamoStack
  ├── ApiStack (uses table)
  └── ExportLambdaStack (uses table)

S3UploadsStack
  ├── ApiStack (uses bucket + KMS key)
  └── ExportLambdaStack (uses bucket + KMS key)

ApiStack
  └── WebStack (proxies API via CloudFront)
```

---

## Data Migration

A TypeScript migration script is available at `data-migration/migrate-teams-items.ts` for transferring data between environments. See [MIGRATION_GUIDE.md](data-migration/MIGRATION_GUIDE.md) for full details.

**What gets migrated:** Teams, items (including kits), templates, template items, and all associated S3 images. User references are rewritten to a designated migration user in the destination environment.

**What does not get migrated:** Users (managed by Cognito), roles (seeded by CDK), team membership (recreated for migration user).
