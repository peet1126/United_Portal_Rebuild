# United Portal Rebuild

A serverless ticketing system built to mirror the architecture of a production app I shipped at scale — 60,000+ users, 10,000+ concurrent sessions, $1M+ in tickets processed. This rebuild strips it down to its architectural core so the decisions are visible.

## What this demonstrates

**Lambda connection pooling via RDS Proxy** — Lambda functions are stateless and can spin up dozens of instances simultaneously. Each instance naively opens its own database connection, which exhausts MySQL's connection limit fast under real load. RDS Proxy sits between Lambda and RDS, maintaining a warm connection pool shared across all instances. IAM token auth replaces static credentials entirely.

**3-tier VPC isolation** — Public subnet holds only the NAT gateway. Lambda runs in the private subnet (outbound only, no inbound from the internet). RDS and the proxy live in an isolated subnet with zero internet access — the only traffic in or out is what security groups explicitly allow. Defense in depth at the network layer.

**Single multi-resolver Lambda** — One function handles all four GraphQL operations, routing by `event.info.fieldName`. This keeps cold starts low, shares the Sequelize connection pool across operations, and reduces IAM surface area compared to one Lambda per resolver.

**Infrastructure as code end-to-end** — Every resource (VPC, RDS, Proxy, Cognito, AppSync, Lambda, CloudFront, S3) is defined in AWS Cloud Development Kit (CDK). Nothing was clicked into existence in the console. Tearing down and redeploying the entire stack is one command.

**Shared TypeScript types across the monorepo** — A `shared` package defines `Ticket`, `TicketStatus`, and `TicketCategory`. The Lambda resolver, GraphQL schema, and React frontend all import from the same source. Schema drift between layers is structurally impossible.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Material-UI (MUI), AWS Amplify |
| API | AWS AppSync (GraphQL), Cognito JWT auth |
| Compute | AWS Lambda (Node.js), esbuild bundling |
| ORM | Sequelize, mysql2 |
| Database | Amazon RDS MySQL 8.0, RDS Proxy |
| Infrastructure | AWS Cloud Development Kit (CDK), CloudFormation |
| Hosting | S3, CloudFront (Origin Access Control) |
| Auth | Amazon Cognito User Pool, SRP auth flow |

## Architecture

```
Browser (React + Amplify)
  → CloudFront → S3 (static assets)
  → AppSync (Cognito JWT validated)
    → Lambda (inside VPC, private subnet)
      → RDS Proxy (IAM token auth, isolated subnet)
        → MySQL on RDS
```

## Monorepo structure

```
packages/
  infra/        CDK stacks — Foundation, Api, Frontend
  lambda/       AppSync resolver + Sequelize models
  shared/       TypeScript interfaces shared across packages
  frontend/     React app
```

## Key decisions

**RDS Proxy over direct RDS connection** — Lambda's stateless scaling model makes direct DB connections a liability. The proxy solves connection exhaustion without requiring connection pooling logic in application code.

**AppSync over REST** — The ticketing domain maps cleanly to a GraphQL schema. AppSync handles auth (Cognito JWT validation), subscriptions if needed later, and request/response mapping without a separate API Gateway layer.

**CDK over raw CloudFormation** — TypeScript CDK means infrastructure gets the same type safety, refactoring tools, and code review as application code. Stack outputs are typed props passed between stacks — no string literals, no copy-pasting ARNs.

**esbuild bundling with `nodeModules` for mysql2** — Sequelize loads dialect drivers via dynamic `require()` calls that esbuild can't statically trace. Marking `mysql2` as a `nodeModule` installs it as a real dependency in the Lambda package rather than attempting to inline it — the correct fix for this class of bundling problem.

## Running locally

```bash
# Install dependencies
npm install

# Lambda — requires local MySQL
cd packages/lambda
cp .env.example .env  # fill in local MySQL credentials
DB_SYNC=true ts-node src/test-db.ts

# Frontend — hardcoded fallbacks point at deployed AWS resources
cd packages/frontend
npm run dev
# → http://localhost:5173
```

## Status

Fully functional end-to-end against live AWS infrastructure. Architecture and code are the point — the cloud resources are spun down to keep costs in check.
