# CDK Documentation

This document describes the infrastructure components defined in the CDK folder and how they support the system.

---

## Overview

The CDK folder contains all infrastructure definitions, shared configuration, and cross-stack wiring. The stacks provision the runtime environment for the API, frontend, authentication, storage, and email systems.

---

## Stacks

### **App (bin/app.ts)**

Gets all the stacks and stage configuration, initializes the and wire them out and deploys it.

---

### **AuthStack**

- Creates the Cognito User Pool, App Client, and domain.
- Sets email verification and MFA rules.
- Applies OAuth redirect URLs from stage config.
- Exports user pool details to the API for authentication.

---

### **DynamoStack**

- Creates the primary table (`${service}-${stage}-data`).
- Defines `PK` and `SK` structure.
- Enables PITR, TTL, KMS encryption, and Contributor Insights.
- Defines all GSIs used by the API.

---

### **ApiStack**

- Hosts the Lambda running the API.
- Wraps the Lambda in an HTTP API Gateway.
- Injects environment variables from stage configuration.
- Grants:
  - DynamoDB read/write access
  - S3 upload bucket access
  - SES send permissions
  - Cognito admin rights for Auth routes

- Provides API URL to WebStack.

---

## ExportLambdaStack

This stack provides Lambda functions used for generating PDF and CSV export reports.

### Components

- **pdf2404Function**: Generates DA Form 2404 PDFs.
- **inventoryFunction**: Generates inventory CSV exports.
- **pdfLayer**: Shared Python layer including PDF processing dependencies.
- **commonEnv**: Injected environment variables (Dynamo table, uploads bucket, KMS key, region, template path).

### Permissions

- Grants DynamoDB read access.
- Grants S3 read/write access.
- Adds explicit `s3:GetObject` permission for template files.

### Outputs

- Exposes function ARNs for external invocation.

---

### **WebStack**

- Hosts the frontend build in an S3 bucket.
- Creates the CloudFront distribution.
- Proxies `/trpc/*`, `/health`, `/hello` to the API.
- Provides the distribution URL to the frontend at build time.

---

### **S3UploadsStack**

- Creates the uploads bucket for images/documents.
- Enables managed KMS encryption.
- Exports bucket + key identifiers to the API.
- Grants read/write/delete permissions.

---

### **SesStack**

- Sets up SES identity for all system emails.
- Exports sender address and configuration set.
- Optionally configures SNS topics if enabled for a stage.

---

## Usage Summary

Each stack contributes critical resources:

- **AuthStack**: authentication backend.
- **DynamoStack**: primary database.
- **ApiStack**: backend logic + permissions.
- **WebStack**: frontend hosting + API proxy.
- **S3UploadsStack**: secure file storage.
- **SesStack**: email system.
- **ExportLambdaStack**: sets up lambda for automation output
