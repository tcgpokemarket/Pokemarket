---
name: "PR #1 — Bootstrap self-healing infrastructure"
about: "Adds environment templates, health endpoints, health-monitor scaffold, CI skeleton, and documentation."

labels:
  - "infra"
  - "bootstrap"

---

### Summary

This PR adds the initial bootstrap for the self-healing production architecture. It includes environment templates, a health endpoint scaffold for the Next.js app, a standalone health-monitor microservice scaffold, structured logging utilities, a CI skeleton, and onboarding documentation.

This is PR #1 in a sequence of focused PRs implementing a complete self-healing architecture. Subsequent PRs will add health-monitor logic, feature flags, Supabase resilience, worker services, observability, deployment automation, and chaos testing.

### What this PR contains

- .env.example — environment variable template (no secrets)
- .github/SECRETS_TEMPLATE.md — GitHub Secrets template
- ops/SETUP.md — provisioning and setup guide
- CONTRIBUTING.md — contribution guidelines
- Health endpoints: /api/health, /api/ready, /api/live
- lib/health/checks.ts — basic probes for Supabase, Redis, external APIs
- lib/logger — pino-based structured logger
- packages/health-monitor — health monitor scaffold (runs probes every 30s)
- .github/workflows/bootstrap.yml and .github/workflows/ci.yml — CI skeletons
- package.json workspace entry and package-level tsconfig

### Testing

Local validation steps:
1. Install dependencies: `npm ci`
2. Run Next dev server: `npm run dev`
3. Call the routes:
   - `GET /api/health`
   - `GET /api/ready`
   - `GET /api/live`

Health monitor locally:
1. `cd packages/health-monitor`
2. `npm ci`
3. `npm run dev`

Notes:
- For accurate external probes, provide configuration in a local `.env` file or export environment variables.
- The CI workflows will not deploy until required GitHub Secrets are configured in the repository.

### Checklist before merging
- [ ] Add required repository secrets (see .github/SECRETS_TEMPLATE.md)
- [ ] Validate the health endpoints in a Preview deployment
- [ ] Confirm no secrets were committed in the PR

### Next steps (PR #2)
- Implement the full health-monitor service with Prometheus metrics, automatic recovery actions, and Redis-backed feature flags for graceful degradation.
- Add unit/integration tests for health and recovery logic.
