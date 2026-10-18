# Deploy the synthetic slice on free infrastructure

The committed Astro/React → Go → Neon slice is deployed and checked on a protected Hobby Preview. See [October 18 remote results](../verification/remote-2026-10-18.md) for the deployed SHA, preview URL, successful Actions run, browser results, and performance limits.

## Prerequisites

Use an eligible personal noncommercial Vercel Hobby account and Neon Free project. Confirm the actual project classification and applicable terms. Do not activate a paid plan, trial, add-on, custom domain, or automatic upgrade. Do not import real metadata for this prototype.

1. Create a Neon Free project in a region near the Vercel function region. Inspect the plan and quotas before confirming. Keep scale-to-zero enabled.
2. Obtain direct and pooled PostgreSQL connection URLs privately. Use verified TLS. Do not paste them into repository files, frontend environment variables, screenshots, or command output.
3. In a private shell, set `DATABASE_URL` to the direct URL and run `go run ./cmd/catalog migrate` followed by `go run ./cmd/catalog seed`. This imports only the owned fixture.
4. Connect a Git repository to a new Vercel Hobby project. Keep the project root at the repository root. Do not select a Go-server framework preset. `vercel.json` selects Other, runs the Astro build, and discovers the root Go handler.
5. Set server-only `DATABASE_URL` to the pooled URL in the project's environment settings. Keep this milestone in Preview scope; production deployment requires separate approval. Do not add a PUBLIC-prefixed database variable.
6. Deploy a preview using the free Vercel subdomain. A deployment is permission to test synthetic content, not proof that real metadata is cleared.

## Remote acceptance checks

Run `node scripts/smoke.mjs https://YOUR-PREVIEW.vercel.app` against the matching seeded synthetic revision. Verify both `/en/discover/` and `/fa/discover/`, direct detail URLs, actual React filter requests, and browser Back. Confirm `/api/health` reaches Neon and reports connected. Check the root Go function, runtime version, and `maxDuration=10` in deployment output. The rewrite carries the API suffix in reserved `__route`; the thin function adapter consumes that parameter and restores the portable API path. Verify both the query parameters and restored route remotely. Local adapter tests do not prove the hosting platform's rewrite behavior.

Inspect environment-failure behavior in a separate preview without a database variable. It must return a sanitized 503 rather than an in-memory catalog. Never disturb a working shared database to manufacture a test.

Record five warm requests, a genuinely cold function invocation, and a genuinely sleeping Neon connection separately. Observe pool connections under concurrent reads and reconnect after sleep. A local first request is not proof of a cloud cold start. Record correct row counts and failures along with elapsed times.

Run browser checks against the preview, inspect production JavaScript sizes, and measure throttled mobile navigation. Use enough real traffic for field p75 metrics before claiming the LCP, INP, or CLS targets. Ask a consenting Iranian-network tester to exercise both locales before making a regional-access claim.

## Reproducibility and portability

Commit the npm lockfile, Go checksums, SQL migrations, sqlc sources/generated bindings, fixture revision, and Vercel configuration. Rebuild from a clean checkout. Build output requires no database credential because the initial static snapshot is owned and immutable. Go serving always reads PostgreSQL. Future real-data publication needs a permitted export/build activation process.

For a conventional server, use `go run ./cmd/server` or build that command and serve Astro output with a static host/reverse proxy. Keep Vercel-specific initialization limited to `api/index.go`. If the documented one-project composition fails remotely, evaluate two projects with an API proxy before a free conventional Go host. Any paid change needs separate approval.

## Vercel/Neon provisioning status (October 18, 2026)

Created the Vercel project `frame-movie-discovery` and provisioned Neon Free resource `frame-movie-discovery-db` in `iad1`, connected to the Vercel Preview environment. The real Neon URL from the integration requested `sslmode=require`; the database boundary now upgrades that request to `sslmode=verify-full` before pgx parses it, preserving certificate and hostname checks. Go tests and vet passed, and the remote migration plus idempotent seed completed for all 32 `synthetic-v1` records.

Historical provisioning result: the initial Vercel build completed, but that deployment was `BLOCKED` with the platform reason that the commit author does not have permission to create deployments for this project. That block was superseded by a Ready Preview before this follow-up. This run used the existing authorized CLI account and made no Git-identity or account-link changes. The dated remote record is the current result; no production deployment was created in this follow-up.

The generated `.vercelignore` excludes local environment files, temporary test output, and agent-generated material from uploads. The Neon resource uses the explicit Free plan; no paid plan, custom domain, or production database connection was configured.

## Reproduce the protected Preview

Keep the repository root as the Vercel root. The Go builder imports the reusable adapter from `bettermovie/httpapi`; placing it in `internal/httpapi` prevents the generated Vercel wrapper from importing it under Go internal-package rules. Catalog and database internals remain internal.

Use a clean checkout of the pushed verification branch, run `npm ci`, `go test ./...`, `go vet ./...`, and `npm run verify`, then `vercel deploy --target preview`. Link the existing project; retain its existing Preview database variable. Do not migrate or reseed the working Neon database during verification. Verify deployment metadata identifies the committed SHA and `gitDirty` absent or `0` (not `1`).

Use `vercel curl /api/health --deployment PREVIEW_URL` for CLI-authorized access. Browser and measurement scripts accept the existing automation credential in `VERCEL_AUTOMATION_BYPASS_SECRET`; supply it privately and never save it in tracked files or logs. Preview authentication stays enabled. Run the smoke script, both desktop/mobile browser projects, and performance scripts against that exact deployment.

CI installs the official sqlc v1.31.1 Linux executable after verifying SHA-256 `497ae4fcdfa64c5b0c311ffe4c2bd991e43991e82e5367792ed78bc2dca27354` from the [release asset metadata](https://github.com/sqlc-dev/sqlc/releases/tag/v1.31.1). This avoids compiling the tool with application Go 1.25; generated bindings must still match.

Run the repeatable protected checks with `PREVIEW_URL`, `PLAYWRIGHT_CHANNEL`, and the private automation credential set in your shell:

```sh
node scripts/smoke.mjs "$PREVIEW_URL"
npx playwright test --config playwright.remote.config.mjs
node scripts/verify-remote.mjs
node scripts/measure-api.mjs "$PREVIEW_URL"
node scripts/measure-navigation.mjs "$PREVIEW_URL"
node scripts/measure.mjs "$PREVIEW_URL"
```

For the optional read-only database probe, privately supply the existing pooled `DATABASE_URL` and run `go run ./scripts/measure-neon`. It forces verified TLS and reads only `SELECT 1, pg_postmaster_start_time()`. Compare the server start timestamps before and after at least six minutes with no database traffic. A restart after the interval supports a wake-up observation; elapsed connection time also includes WAN, TLS, authentication, and pooler overhead. Do not manually suspend the shared database.
