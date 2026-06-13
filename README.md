# kiro-app

Express.js web application with unit tests and a fully automated CI/CD pipeline
that triggers Playwright E2E tests on AWS Fargate on every push to `main`.

## Repositories in this system

| Repo | Visibility | Purpose |
|---|---|---|
| [kiro-app](https://github.com/enageshwari/kiro-app) | Public | App source, unit tests, Dockerfile, CI pipeline |
| [kiro-e2e](https://github.com/enageshwari/kiro-e2e) | Public | Playwright E2E tests and Fargate runner Dockerfile |
| [kiro-infra](https://github.com/enageshwari/kiro-infra) | Public | AWS CDK infrastructure |

## Local development

```bash
npm install
npm run dev        # starts server at http://localhost:3000
npm test           # run unit tests (vitest)
npm run build      # compile TypeScript → dist/
```

## CI/CD pipeline

Every push to `main` runs three jobs in sequence:

```
push to main
  │
  ├─ Job 1: Unit Tests (vitest)
  │         runs on every push and PR
  │
  ├─ Job 2: Build & Push to ECR          [main only]
  │         docker buildx build (ECR registry cache for faster rebuilds)
  │         push kiro-app:<sha> to ECR
  │         aws ecs update-service --desired-count 1 (wires ALB on first deploy)
  │         aws ecs wait services-stable  ← waits for new task to be healthy
  │         ensures E2E always runs against the newly deployed version
  │
  └─ Job 3: Trigger E2E & Wait           [main only]
            health check smoke test (5 retries) before triggering
            POST /run-e2e → API Gateway (202)
            GHA polls CloudWatch /ecs/kiro-e2e every 30s (max 15 min)
            Pass/fail gates the workflow
```

**Why `ecs wait services-stable` matters:** without it, GHA triggers E2E immediately after
`update-service`. The new container may not be running yet, so tests hit the old version
or a 502/504. The wait ensures the new image is serving traffic before E2E fires.

## GitHub Actions secrets

Set in: Settings → Secrets and variables → Actions

| Secret | Description | Where to get it |
|---|---|---|
| `AWS_ROLE_ARN` | IAM OIDC role for GHA | `KiroGitHubOidcStack` CDK output |
| `APP_URL` | ALB public URL | `KiroAppStack` CDK output |
| `TARGET_GROUP_ARN` | ALB target group ARN | `KiroAppStack` CDK output |
| `E2E_TRIGGER_URL` | API Gateway webhook URL | `KiroE2EPipelineStack` CDK output |
| `E2E_API_KEY` | API Gateway API key value | `aws apigateway get-api-keys --include-values` |

> No AWS access keys stored — uses OIDC. See [kiro-infra](https://github.com/enageshwari/kiro-infra) for details.

## Docker image

Built by GHA on every push to `main`.
Published to: `<account>.dkr.ecr.us-east-1.amazonaws.com/kiro-app:<commit-sha>`

```bash
# Build and run locally
docker build -t kiro-app:local .
docker run -p 3000:3000 kiro-app:local
# visit http://localhost:3000
```
