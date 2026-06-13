# kiro-app

Express.js web application with a fully automated CI/CD pipeline that builds,
deploys to AWS ECS Fargate, and triggers a Playwright E2E test suite on every
push to `main` — all without storing any long-lived AWS credentials.

## Repositories in this system

| Repo | Purpose |
|---|---|
| [kiro-app](https://github.com/enageshwari/kiro-app) | App source, unit tests, Dockerfile, CI pipeline |
| [kiro-e2e](https://github.com/enageshwari/kiro-e2e) | Playwright E2E tests and Fargate runner Dockerfile |
| [kiro-infra](https://github.com/enageshwari/kiro-infra) | AWS CDK infrastructure — fully reproducible |

---

## Highlights

### Security
- **Zero stored AWS credentials** — GitHub Actions uses OIDC (OpenID Connect).
  GHA exchanges a short-lived JWT for temporary STS credentials scoped to this
  exact repo + main branch. No `AWS_ACCESS_KEY_ID` anywhere.
- **Least-privilege IAM** — OIDC roles grant only what each workflow needs:
  ECR push, ECS update, CloudWatch read. No wildcard `*` on sensitive actions.
- **API Gateway key auth** — E2E trigger endpoint requires an API key so only
  kiro-app GHA can invoke it.
- **Non-root container** — app Docker image runs as a dedicated non-root user.

### Reliability
- **`aws ecs wait services-stable`** — GHA waits for the new container to pass
  health checks before triggering E2E. Tests always run against the deployed version.
- **Smoke check before E2E** — 5-retry health check on `/health` before firing
  Playwright. Fails fast if the app didn't come up, with a clear error.
- **Playwright actionability** — every interaction waits for visible + enabled +
  stable. Web-first assertions auto-retry until timeout. No `page.waitForTimeout()`.
- **CI retries** — Playwright retries each test 2× in CI before marking it failed,
  absorbing transient network blips.
- **Docker layer caching** — `docker buildx` with ECR registry cache. Only changed
  layers are pushed on subsequent builds.

### Usability
- **Single command restore** — `scripts/restore.sh` in kiro-infra brings back the
  entire AWS infrastructure from zero after teardown.
- **Structured E2E results in CloudWatch** — Lambda writes `{ result, taskArn, exitCode }`
  as a JSON log event. GHA polls for it — no long-lived HTTP connections.
- **Screenshot on failure** — Playwright captures page state on any failed test
  in CI for immediate visual debugging.
- **Separate repos, separate concerns** — app, E2E tests, and infra have independent
  release cadences and ownership. E2E never ships to prod.

---

## Local development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest unit tests
npm run build   # tsc → dist/
```

---

## CI/CD pipeline

Every push to `main`:

```
push to main
  │
  ├─ Job 1: Unit Tests (vitest) ── runs on PRs too
  │
  ├─ Job 2: Build & Deploy       [main only]
  │    docker buildx (ECR layer cache)
  │    push kiro-app:<sha> to ECR
  │    aws ecs update-service
  │    aws ecs wait services-stable  ← deployment gate
  │
  └─ Job 3: E2E Gate             [main only]
       smoke check /health (5 retries)
       POST /run-e2e → API Gateway → Lambda → Fargate
       GHA polls CloudWatch every 30s (max 15 min)
       ✅ PASSED or ❌ FAILED gates the workflow
```

---

## GitHub Actions secrets

| Secret | Description | Source |
|---|---|---|
| `AWS_ROLE_ARN` | OIDC role ARN | `KiroGitHubOidcStack` output |
| `APP_URL` | ALB public URL | `KiroAppStack` output |
| `TARGET_GROUP_ARN` | ALB target group | `KiroAppStack` output |
| `E2E_TRIGGER_URL` | API Gateway webhook | `KiroE2EPipelineStack` output |
| `E2E_API_KEY` | API key value | `aws apigateway get-api-keys --include-values` |

---

## Docker image

```bash
docker build -t kiro-app:local .
docker run -p 3000:3000 kiro-app:local
# http://localhost:3000
```

Multi-stage Alpine build — lean runtime image (~50MB), browser-free, non-root user.
