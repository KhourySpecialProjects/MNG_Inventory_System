# Project Requirements

## Initial Setup

These steps prepare your local environment so the project can run and deploy correctly.

Ensure that Node.js 20 and the AWS CDK are installed on your system.

After cloning the repository, install all project dependencies:

```bash
npm install
```

Install all Node.js dependencies required for the project to compile, run tests, and deploy.
Run the test suite to confirm everything is functioning correctly:

```bash
npm run test
```

To deploy the environment to AWS, bootstrap the CDK environment:

```bash
npm run bootstrap
```

## Local Development

To develop locally without the need for AWS, you can build a dynamodb docker container to mock the AWS DynamoDB:

```bash
docker compose build
```

Then you can start and stop the database with:

```bash
docker compose up
docker compose down
```

To seed the local database with seed data from [seed.ts](./src/api/src/seed.ts):

```bash
npm run seed
```

Finally, to spin up a local development environment with a default mock admin user:

```bash
npm run dev:local
```

## Environment Variables

All AWS deployment configuration is provided through environment variables, passed inline with the deploy command. No `.env` file is used.

| Variable | Required for | Description |
|---|---|---|
| `AWS_PROFILE` | All deploys (optional) | AWS CLI profile name from `~/.aws/credentials`. If not set, the default profile or ambient credentials are used. |
| `SES_FROM_ADDRESS` | Dev deploys | A verified email address in the AWS SES console, used as the sender in sandbox mode. Not needed for prod. |
| `SITE_DOMAIN` | Prod deploys | Custom domain name (e.g. `mng-inv.nunext.com`). Enables Route 53, ACM certificate, and SES domain identity. Not used for dev. |

## SES Email Setup (Dev Deployments)

Dev and sandbox deployments use SES in sandbox mode, which requires a verified sender email address. This is **not** needed for production deployments that use a custom domain — those use a domain-level SES identity instead.

1. Open the [AWS SES Console](https://console.aws.amazon.com/ses/) in `us-east-1`.
2. Go to **Identities** → **Create identity** → choose **Email address**.
3. Enter the email address you want to send from and click **Create identity**.
4. Check your inbox for the verification email from AWS and click the confirmation link.
5. Provide the `SES_FROM_ADDRESS` variable when deploying (see examples below).

> **Note:** In SES sandbox mode, you can only send emails to other verified email addresses. This is sufficient for development and testing. Production deployments with a custom domain bypass this restriction.

## Prerequisites in order to deploy to prod

1. Register or own a domain.
2. Add the domain to SES for verification.
3. Add SES TXT and DKIM CNAME records in Route 53.
4. Configure SPF to allow SES sending.
5. Update CDK to use a domain identity instead of an email identity.
6. Update sender address in environment variables.
7. Follow deployment steps below.

## Deployment

These steps build and publish your infrastructure to AWS.

Build the project before deploying:

```bash
npm run build
```

Deploy to the development environment:

```bash
SES_FROM_ADDRESS=you@example.com npm run deploy:dev
```

Deploy to the production environment:

```bash
SITE_DOMAIN=mng-inv.nunext.com npm run deploy:prod
```

To specify an AWS profile for either deploy:

```bash
AWS_PROFILE=my-profile SITE_DOMAIN=mng-inv.nunext.com npm run deploy:prod
```
