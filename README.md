# kiro-app

Express.js web application with unit tests.

## Repos in this system

| Repo | Purpose |
|---|---|
| **kiro-app** (this repo) | App source, unit tests, Dockerfile, CI pipeline |
| **kiro-e2e** | Playwright E2E tests and runner Dockerfile |
| **kiro-infra** | AWS CDK infrastructure (private — contains account-specific config) |

## Local development

```bash
npm install
npm run dev        # starts server at http://localhost:3000
npm test           # run unit tests (vitest)
npm run build      # compile TypeScript → dist/
```

## CI/CD pipeline (GitHub Actions)

Every push to `main` runs three jobs in sequence:

```
1. unit-test       → runs vitest
2. build-and-push  → builds Docker image, pushes to ECR, updates ECS service
3. trigger-e2e     → calls API Gateway webhook → Lambda → Fargate runs Playwright tests
                     polls CloudWatch for pass/fail result (up to 15 min)
```

PRs only run `unit-test`. The push and E2E jobs are `main`-only.

## GitHub Actions secrets required

Set these in: Settings → Secrets and variables → Actions

| Secret | Description |
|---|---|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC authentication (from kiro-infra deploy output) |
| `APP_URL` | Public ALB URL of the deployed app (from kiro-infra deploy output) |
| `TARGET_GROUP_ARN` | ALB target group ARN (from kiro-infra deploy output) |
| `E2E_TRIGGER_URL` | API Gateway webhook URL (from kiro-infra deploy output) |
| `E2E_API_KEY` | API Gateway API key value (retrieve after infra deploy — see kiro-infra README) |

> **No AWS access keys are stored.** Authentication uses OIDC — GHA exchanges
> a short-lived JWT for temporary AWS credentials scoped to this repo only.

## Docker image

Built automatically by GHA on every push to `main`.
Base image: `node:20-alpine` (multi-stage build, ~50MB final image).
Published to ECR: `<account>.dkr.ecr.us-east-1.amazonaws.com/kiro-app:<commit-sha>`

To build locally:
```bash
docker build -t kiro-app:local .
docker run -p 3000:3000 kiro-app:local
```
