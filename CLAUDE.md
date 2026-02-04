# MNG Inventory System - Claude Context File

## Project Overview
Massachusetts National Guard inventory management system - a full-stack TypeScript application replacing paper-based equipment tracking processes. Built for technicians to log equipment, track status, and generate compliance reports (DA Form 2404).

## Tech Stack Summary

### Frontend (src/frontend/)
- **Framework:** React 19 + React Router 7
- **Build:** Vite 7
- **UI:** Material-UI (MUI) 7 + Emotion CSS-in-JS
- **State:** TanStack React Query + tRPC Client
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Validation:** Zod
- **Testing:** Vitest + React Testing Library

### Backend API (src/api/)
- **Framework:** Express.js + tRPC 10
- **Runtime:** Node.js 20 (Express locally, Lambda in prod)
- **Database:** DynamoDB via AWS SDK v3
- **Auth:** AWS Cognito + aws-jwt-verify
- **Validation:** Zod
- **Testing:** Jest + aws-sdk-client-mock

### Infrastructure (src/cdk/)
- **IaC:** AWS CDK 2
- **Services:** Lambda, API Gateway v2, DynamoDB, S3, CloudFront, Cognito, SES, KMS

## Project Structure
```
src/
├── frontend/           # React SPA
│   ├── src/
│   │   ├── pages/      # Route-level components (HomePage, TeamspacePage, etc.)
│   │   ├── components/ # Reusable UI components
│   │   ├── api/        # tRPC client wrappers
│   │   ├── App.tsx     # Router setup
│   │   └── theme.ts    # MUI theme config
│   └── tests/          # Vitest tests
├── api/                # tRPC backend
│   ├── src/
│   │   ├── routers/    # tRPC routers (auth, items, users, teamspace, etc.)
│   │   ├── helpers/    # Utility functions
│   │   ├── server.ts   # Express dev server (port 3001)
│   │   └── handler.ts  # Lambda handler
│   └── __tests__/      # Jest tests
└── cdk/                # AWS infrastructure
    ├── lib/            # CDK stacks (AuthStack, ApiStack, DynamoStack, etc.)
    ├── bin/app.ts      # Stack orchestration
    └── python_*/       # Python Lambda for PDF/CSV export
```

## Key Commands
```bash
npm run dev              # Run frontend (5173) + API (3001) concurrently
npm run dev:local        # Run in LOCAL DEV MODE (no AWS required!)
npm run dev:frontend     # Frontend only
npm run dev:api          # API only
npm run build            # Build both packages
npm run test             # Run all tests
npm run test:api         # Backend tests (Jest)
npm run test:frontend    # Frontend tests (Vitest)
npm run deploy:dev       # Deploy to dev environment
npm run deploy:prod      # Deploy to prod (requires ALLOW_PROD_DEPLOY=true)
```

## Local Development Mode (No AWS Required)

Run `npm run dev:local` to start the app without AWS credentials. This mode:

- **Auth:** Bypassed - sign in with any email and password (min 10 chars)
- **Database:** In-memory store (data resets on restart)
- **S3:** Mock storage for images
- **Lambda:** Export functions return mock responses
- **Email:** Invite emails logged to console instead of sent

The local dev mode creates a default user and team automatically:
- User: `dev@localhost` / `local-dev`
- Team: "Local Dev Team"
- Role: Owner (full permissions)

Key file: `src/api/src/localDev.ts` - contains mock implementations

## Database Schema (DynamoDB Single-Table)
Primary key: PK (partition) + SK (sort)

Key patterns:
- `USER#{userId} / METADATA` - User profiles
- `TEAM#{teamId} / METADATA` - Team info
- `TEAM#{teamId} / ITEM#{itemId}` - Inventory items
- `TEAM#{teamId} / MEMBER#{userId}` - Team membership
- `ROLE#{roleName} / METADATA` - Role definitions

GSIs: GSI_WorkspaceByName, GSI_UsersByUid, GSI_UsersByUsername, GSI_RolesByName, GSI_UserTeams

## Authentication Flow
1. User invited via email with temp password (Cognito + SES)
2. Sign-in returns JWT tokens (stored in HTTP-only cookies)
3. tRPC middleware verifies JWT on each request
4. MFA required (EMAIL_OTP)
5. Role-based permissions checked via `permissionedProcedure`

## tRPC Router Structure
- `auth.ts` - Sign-in, sign-up, MFA, password reset
- `items.ts` - Inventory CRUD + S3 image upload
- `teamspace.ts` - Team/workspace management
- `users.ts` - User profiles, invitations
- `roles.ts` - RBAC management
- `home.ts` - Dashboard statistics
- `export.ts` - PDF/CSV generation via Lambda

## Coding Conventions
- **Files:** PascalCase for components, camelCase for utilities
- **DynamoDB Keys:** Prefixed format (e.g., `USER#`, `TEAM#`, `ITEM#`)
- **Validation:** Zod schemas for all inputs/outputs
- **Error Handling:** tRPC errors with codes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
- **Style:** Prettier (single quotes), ESLint, strict TypeScript

## Default Roles & Permissions
- **OWNER:** Full control (team CRUD, user management, all reports)
- **MANAGER:** Team lead (invite members, manage items, export)
- **MEMBER:** Technician (view items, submit reports)

## Environment Variables (API)
- `DDB_TABLE_NAME` - DynamoDB table name
- `S3_BUCKET_NAME` - Uploads bucket
- `S3_KMS_KEY_ARN` - KMS encryption key
- `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` - Auth config
- `SES_FROM_ADDRESS` - Email sender
- `ALLOWED_ORIGINS` - CORS origins
- `EXPORT_2404_FUNCTION_NAME`, `EXPORT_INVENTORY_FUNCTION_NAME` - Export Lambdas

## Important File Locations
- API entry: `src/api/src/server.ts` (dev), `src/api/src/handler.ts` (Lambda)
- Frontend entry: `src/frontend/src/main.tsx`
- tRPC setup: `src/api/src/routers/trpc.ts`
- Theme config: `src/frontend/src/theme.ts`
- CDK stacks: `src/cdk/lib/`
- Env validation: `src/api/src/process.ts`

## Testing Patterns
- Backend: Jest with aws-sdk-client-mock for AWS services
- Frontend: Vitest with React Testing Library, components mocked via vi.mock()
- Test locations: `src/api/__tests__/`, `src/frontend/tests/`

## Deployment Stages
- `dev` - Development environment
- `beta` - Staging environment
- `prod` - Production (requires env var gate)

Region: us-east-1
