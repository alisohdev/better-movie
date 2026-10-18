# Deploy the synthetic slice on free infrastructure

This run has not established a remote Astro/React to Go to Neon deployment. A cached Vercel CLI session exists, but no Neon connection URL or Neon API credential is configured. Account eligibility and actual Iranian-network access remain unverified. The compatibility assessment is documentation evidence, not a deployed test.

## Prerequisites

Use an eligible personal noncommercial Vercel Hobby account and Neon Free project. Confirm the actual project classification and applicable terms. Do not activate a paid plan, trial, add-on, custom domain, or automatic upgrade. Do not import real metadata for this prototype.

1. Create a Neon Free project in a region near the Vercel function region. Inspect the plan and quotas before confirming. Keep scale-to-zero enabled.
2. Obtain direct and pooled PostgreSQL connection URLs privately. Use verified TLS. Do not paste them into repository files, frontend environment variables, screenshots, or command output.
3. In a private shell, set `DATABASE_URL` to the direct URL and run `go run ./cmd/catalog migrate` followed by `go run ./cmd/catalog seed`. This imports only the owned fixture.
4. Connect a Git repository to a new Vercel Hobby project. Keep the project root at the repository root. Do not select a Go-server framework preset. `vercel.json` selects Other, runs the Astro build, and discovers the root Go handler.
5. Set server-only `DATABASE_URL` to the pooled URL in the project's environment settings. Set both preview and production scopes deliberately. Do not add a PUBLIC-prefixed database variable.
6. Deploy a preview using the free Vercel subdomain. A deployment is permission to test synthetic content, not proof that real metadata is cleared.

## Remote acceptance checks

Run `node scripts/smoke.mjs https://YOUR-PREVIEW.vercel.app` against the matching seeded synthetic revision. Verify both `/en/discover/` and `/fa/discover/`, direct detail URLs, actual React filter requests, and browser Back. Confirm `/api/health` reaches Neon and reports connected. Check the root Go function, runtime version, and `maxDuration=10` in deployment output. The rewrite carries the API suffix in reserved `__route`; the thin function adapter consumes that parameter and restores the portable API path. Verify both the query parameters and restored route remotely. Local adapter tests do not prove the hosting platform's rewrite behavior.

Inspect environment-failure behavior in a separate preview without a database variable. It must return a sanitized 503 rather than an in-memory catalog. Never disturb a working shared database to manufacture a test.

Record five warm requests, a genuinely cold function invocation, and a genuinely sleeping Neon connection separately. Observe pool connections under concurrent reads and reconnect after sleep. A local first request is not proof of a cloud cold start. Record correct row counts and failures along with elapsed times.

Run browser checks against the preview, inspect production JavaScript sizes, and measure throttled mobile navigation. Use enough real traffic for field p75 metrics before claiming the LCP, INP, or CLS targets. Ask a consenting Iranian-network tester to exercise both locales before making a regional-access claim.

## Reproducibility and portability

Commit the npm lockfile, Go checksums, SQL migrations, sqlc sources/generated bindings, fixture revision, and Vercel configuration. Rebuild from a clean checkout. Build output requires no database credential because the initial static snapshot is owned and immutable. Go serving always reads PostgreSQL. Future real-data publication needs a permitted export/build activation process.

For a conventional server, use `go run ./cmd/server` or build that command and serve Astro output with a static host/reverse proxy. Keep Vercel-specific initialization limited to `api/index.go`. If the documented one-project composition fails remotely, evaluate two projects with an API proxy before a free conventional Go host. Any paid change needs separate approval.
