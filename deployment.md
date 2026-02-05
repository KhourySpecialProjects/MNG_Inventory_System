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

## Prerequisites in order to deploy to prod

1. Register or own a domain.
2. Add the domain to SES for verification.
3. Add SES TXT and DKIM CNAME records in Route 53.
4. Configure SPF to allow SES sending.
5. Update CDK to use a domain identity instead of an email identity.
6. Update sender address in environment variables.
7. Follow deployment step bellow

## Deployment

These steps build and publish your infrastructure to AWS.

Build the project before deploying:

```bash
npm run build
```

To deploy to the development environment:

```bash
npm run deploy:dev
```

To deploy to the production environment:

```bash
npm run deploy:prod
```
