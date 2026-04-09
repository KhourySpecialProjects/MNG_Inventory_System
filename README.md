# Inventory Management System repository (SupplyNet)

This is the main repository for the Inventory Management System project, developed for use by the Massachussetts National Guard.

### File layout

The following includes hyperlinks to section-specific docmentation:

- [Deployment](./deployment.md)
- [API documentation](src/api/README.md)
- [CDK documentation](src/cdk/README.md)
- [Frontend documentation](src/frontend/README.md)

### Overview of Project

The Inventory Management System (SupplyNet) is a web application designed to replace the Massachusetts Army National Guard's paper-based inventory system. The existing process is slow, error-prone, and dependent on nested forms and inconsistent item naming, often requiring eight or more hours of repeated checks. SupplyNet modernizes this workflow by giving technicians an intuitive interface to log items, navigate nested kits, update statuses, and attach photos, while providing managers and supervisors the tools needed to create teams, manage personnel, update inventory structures, and export official documentation.

The system is built around role-based access (Technician, Manager, Skip-Manager) and supports the creation, updating, and review of both standalone items and multi-level kits. All logged data can be exported into standardized Army PDF forms generated through our backend system. These reports provide supply managers and leadership with accurate, compliant records of equipment status.

Overall, the goal of the system is to enable fast, accurate, low-training inventory sessions and ensure that all output is compliant with Army documentation standards.

### Development Context

##### Authorship

The code in this project was developed in Northeastern University's inaugural CS4535 class, taught by Dr. Mark Fontenot and Dr. Wendy Truran. Our team includes PM Diego Cicotiste, backend developers Reese Cantu, Steph Sayegh, and Lily Bedichek, and frontend develpoers Tyler Goldener and Ben Tran. Our military associate / client was Sgt. Paul Martin, State Innovation Officer and member of the 387th Explosive Ordinance Disposal Company. We partially included information from a document developed by a Tuft's ENP 0074 capstone class in Spring of 2025.

##### Scope and Limitations

Our job is to create a web-based application for use by inventory-taking technicians which will produce appropriate supply forms. We are working with a $50/month AWS budget and a limited bandwidth team. We are not automating the entire inventory process, only the frontend section done by military technicians. So, our project scope is essentially to make a frontend structure where inventory can be logged by technicians, a backend that stores hierarchies for form automation, and a program to automate filling out the forms.

## Architecture

SupplyNet operates entirely on AWS infrastructure, using CloudFront for hosting, Cognito for authentication, DynamoDB for storing users, teams, items, and logs, S3 for item images and generated reports, and Lambda for server-side PDF generation. The system is browser-based, responsive, and optimized for desktop, laptop, and tablet usage. While not built for full mobile or offline operation, its lightweight design and cloud architecture allow fast, secure access for a small team of fewer than ten active users at a time, with the potential to scale to additional National Guard units.

```
                                    ┌─────────┐
                                    │  Users  │
                                    └────┬────┘
                                         │
          ┌───────────┐            ┌─────▼──────┐            ┌───────────┐
          │ Route 53  │───  DNS  ─▶│ CloudFront │◀──  TLS  ──│    ACM    │
          └───────────┘            └──┬──────┬──┘            └───────────┘
                                      │      │
                        static assets │      │ /trpc/*
                                      │      │
                      ┌───────────────┘      └───────────────┐
                      ▼                                      ▼
               ┌────────────┐                       ┌───────────────┐
               │   S3 Web   │                       │API Gateway v2 │
               │  React SPA │                       │   HTTP API    │
               └────────────┘                       └───────┬───────┘
                                                            │
                                                    ┌───────▼───────┐     ┌───────────┐
                                                    │    Lambda     ├────▶│  Cognito  │
                                                    │  tRPC/Node20  │     │ Auth+MFA  │
                                                    └──┬─────┬───┬──┘     └───────────┘
                                                       │     │   │
                          ┌────────────────────────────┘     │   └──────────────┐
                          │                ┌─────────────────┘                  │
                          ▼                ▼                                    ▼
                   ┌────────────┐   ┌────────────┐                      ┌────────────┐
                   │  DynamoDB  │   │    SES     │                      │ S3 Uploads │
                   │ single-tbl │   │   email    │                      │images/docs │
                   │   5 GSIs   │   └────────────┘                      └─────┬──────┘
                   └─────▲──────┘                                             │
                         │           ┌───────────────────┐                    │
                         └───────────┤  Export Lambdas   │◀───────────────────┘
                                     │ Python 3.11       │
                                     │ DA 2404 PDF / CSV │
                                     └───────────────────┘

                   ┌─────────┐
                   │   KMS   │  ◀── encrypts DynamoDB table + S3 buckets
                   └─────────┘
```

**Request flow:** Users hit **CloudFront** (via Route 53 DNS + ACM TLS). Static assets are served from the **S3 web bucket**. API calls (`/trpc/*`) are proxied to **API Gateway v2**, which invokes the **tRPC Lambda** (Node.js 20). The Lambda authenticates via **Cognito** (EMAIL_OTP MFA), reads/writes data in **DynamoDB** (single-table, 5 GSIs), sends emails through **SES** (DKIM + DMARC), and stores images in **S3 Uploads**. For report generation, the Lambda invokes separate **Export Lambdas** (Python 3.11) that read from DynamoDB and write PDFs/CSVs to S3. All data at rest is encrypted with customer-managed **KMS** keys.

### Infrastructure Highlights

- **Custom Domain**: Route 53 hosted zone with ACM certificate (apex + wildcard). CloudFront serves the frontend under the custom domain with an A-record alias.
- **Email**: SES domain identity with DKIM + DMARC in production. Dev/sandbox stages use a pre-verified email address.
- **Authentication**: Cognito with EMAIL_OTP MFA, OAuth 2.0 authorization code flow, and role-based permissions (Owner, Manager, Member).
- **Data**: Single-table DynamoDB design with customer-managed KMS encryption, point-in-time recovery, and 5 GSIs.
- **Exports**: Python Lambda functions generate DA Form 2404 PDFs and inventory CSV reports.
- **Data Migration**: Script for transferring teams, items, and templates between environments or AWS accounts.

For a complete infrastructure setup guide on a fresh AWS account, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).

---

## Documentation

| Document                                                     | Description                                             |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| [Deployment Guide](./deployment.md)                          | Environment variables, deploy commands, local dev setup |
| [AWS Setup Guide](./SETUP_GUIDE.md)                          | Fresh AWS account setup from scratch                    |
| [CDK Documentation](src/cdk/README.md)                       | Infrastructure stacks and configuration                 |
| [API Documentation](src/api/README.md)                       | tRPC router endpoints and methods                       |
| [Frontend Documentation](src/frontend/README.md)             | React components, pages, and patterns                   |
| [Migration Guide](src/cdk/data-migration/MIGRATION_GUIDE.md) | Data migration between environments                     |

---

## Known Bugs

1. **Stale User Names on Reviewed Items**
   When a user updates the status of an item, their userId, username, and name are saved to that item as the last reviewer. If the user later changes their name or username, previously reviewed items still show the old values. Fix: save only the userId and resolve the current name at query time.
2. Template Generated Items Image Persistance
   When items are created from a template, they inherit the templates image. Instead of copying the image in S3, the app uses the same s3 url as the template. Because of this, deleting a template item from a template could interfere with images on existing items.

## Future Improvements

1. **End-to-End Testing**
   Add E2E test coverage for critical workflows (authentication, item CRUD, exports).
