# Deployment Guide

## Initial Setup

1. Install **Node.js 20+** and the **AWS CDK CLI** (`npm install -g aws-cdk`).
2. Clone the repository and install dependencies:

```bash
npm install
```

3. Run the test suite to confirm everything works:

```bash
npm run test
```

4. Bootstrap the CDK environment in your AWS account (one-time setup):

```bash
AWS_PROFILE=my-profile npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

## Local Development (No AWS Required)

Build and start a local DynamoDB container:

```bash
docker compose build
docker compose up
```

Seed the local database:

```bash
npm run seed
```

Start the local development environment with mock auth:

```bash
npm run dev:local
```

This starts both the frontend (port 5173) and API (port 3001). Sign in with any email and a password of at least 10 characters. Auth, S3, SES, and Lambda exports are all mocked. Data resets on restart.

To stop the local database:

```bash
docker compose down
```

## Environment Variables

All deployment configuration is passed inline with the deploy command. No `.env` file is used.

| Variable | Required For | Description |
|----------|-------------|-------------|
| `AWS_PROFILE` | All deploys (optional) | AWS CLI profile name from `~/.aws/credentials`. Falls back to default/ambient credentials. |
| `SES_FROM_ADDRESS` | Dev deploys | A verified email address in the AWS SES console, used as the sender in sandbox mode. |
| `SITE_DOMAIN` | Prod deploys | Custom domain (e.g., `mng-inv.nunext.com`). Enables Route 53, ACM certificate, SES domain identity, and CloudFront custom domain. |
| `ALLOW_PROD_DEPLOY` | Prod deploys | Must be `true` to allow production deployment (safety gate). |
| `COGNITO_CALLBACK_URLS` | Optional | Override OAuth callback URLs (comma-separated). Auto-derived from allowed origins if not set. |
| `COGNITO_LOGOUT_URLS` | Optional | Override OAuth logout URLs (comma-separated). Auto-derived from allowed origins if not set. |

## SES Email Setup (Dev Deployments)

Dev deployments use SES in **sandbox mode**, which only allows sending to verified email addresses.

1. Open the [AWS SES Console](https://console.aws.amazon.com/ses/) in `us-east-1`.
2. Go to **Identities** > **Create identity** > choose **Email address**.
3. Enter the email address you want to send from and click **Create identity**.
4. Check your inbox for the verification email from AWS and click the confirmation link.
5. To send to test recipients, verify their email addresses the same way.
6. Pass `SES_FROM_ADDRESS` when deploying (see commands below).

> **Note:** Production deployments with a custom domain use SES domain identity instead, which bypasses the sandbox restriction. See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for production SES setup.

## Deployment Commands

Build the project before deploying:

```bash
npm run build
```

### Dev Deployment

```bash
SES_FROM_ADDRESS=you@example.com npm run deploy:dev
```

With an AWS profile:

```bash
AWS_PROFILE=my-profile SES_FROM_ADDRESS=you@example.com npm run deploy:dev
```

### Production Deployment

```bash
SITE_DOMAIN=mng-inv.nunext.com ALLOW_PROD_DEPLOY=true npm run deploy:prod
```

With an AWS profile:

```bash
AWS_PROFILE=my-profile SITE_DOMAIN=mng-inv.nunext.com ALLOW_PROD_DEPLOY=true npm run deploy:prod
```

### Other Useful Commands

```bash
npm run synth              # Generate CloudFormation templates without deploying
npm run diff               # Preview infrastructure changes
npm run destroy            # Destroy all stacks (careful in production!)
```

## After First Production Deploy

If you deployed with a custom domain for the first time:

1. **Update domain nameservers**: The DnsStack outputs NS records. Copy them to your domain registrar (Porkbun, GoDaddy, etc.) as the domain's nameservers.
2. **Wait for DNS propagation**: This can take up to 48 hours, but typically completes within a few hours.
3. **Request SES production access**: In the AWS SES console, go to **Account dashboard** and request to move out of sandbox mode so you can send to unverified email addresses.

For a complete walkthrough of setting up a fresh AWS account, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).
