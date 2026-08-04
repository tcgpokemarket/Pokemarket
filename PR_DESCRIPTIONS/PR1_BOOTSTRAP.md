# Health endpoints and monitor scaffold

This PR introduces the initial scaffolding for the self-healing infrastructure.

Changes:
- .env.example: environment variable template (no secrets)
- .github/secrets.example.md: template for required GitHub Secrets
- ops/SETUP.md: onboarding and provisioning instructions
- CONTRIBUTING.md: contribution guidelines
- Health endpoints: /api/health, /api/ready, /api/live
- lib/health/checks.ts: basic probes for Supabase, Redis, and external APIs
- packages/health-monitor: a small Node service that runs health checks every 30 seconds and attempts conservative recovery actions
- lib/logger: pino-based structured logger
- CI workflow: .github/workflows/bootstrap.yml (build & test skeleton)

Testing:
- Routes: GET /api/health, /api/ready, /api/live
- Health monitor: packages/health-monitor can be run locally using "npm run dev" in that package after installing dependencies.

Next steps (subsequent PRs):
- Full monitoring and recovery implementations
- Supabase resilience and auth/session recovery
- BullMQ queue and worker service
- Observability (OTel, Prometheus, Grafana, Sentry)
- CI/CD with Vercel deployment validation and rollback

