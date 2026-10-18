# Frame movie discovery prototype

A bilingual movie-discovery vertical slice with a portable Go API, PostgreSQL, and prerendered Astro pages with a React discovery island. The working name is provisional. All 32 films, scores, release observations, and poster artwork are fictional demonstration content. No movie provider or third-party metadata is integrated.

## Requirements

Use Node.js 24, npm, Go 1.25 or newer, PostgreSQL 18, and sqlc 1.31.1 when changing queries. Docker is optional. Keep a local PostgreSQL instance bound to loopback. No remote subscription, domain, or data API key is needed for local development.

## Start locally

1. Run `npm ci` at the repository root.
2. Run `docker compose up -d` for the optional database. If PostgreSQL is already running on port 55432, use that database and do not start a competing container.
3. Set the Go process's `DATABASE_URL` environment variable. The local-only example in `.env.example` matches the Docker service. Go does not automatically load `.env` files.
4. Run `go run ./cmd/catalog migrate`, then `go run ./cmd/catalog seed`. Both commands are safe to repeat for the owned fixture.
5. Start the API with `go run ./cmd/server` in one terminal. It listens on port 8080 by default.
6. Start Astro with `npm run dev` in another terminal. Open `http://127.0.0.1:4321/en/discover/` or `/fa/discover/`. The frontend proxies `/api` to the local Go process.

For PowerShell, set a local environment variable with `$env:DATABASE_URL = 'postgres://movie:local-development-only@127.0.0.1:55432/movie_discovery?sslmode=disable'`. For a POSIX shell, use `export DATABASE_URL='postgres://movie:local-development-only@127.0.0.1:55432/movie_discovery?sslmode=disable'`. This password is a public local-development placeholder. Never put a remote secret in a command log or public frontend variable.

The development run created a separate local PostgreSQL cluster under ignored `.local/pgdata` on port 55432. It does not change the pre-existing PostgreSQL service. A clean checkout can use Docker or another local PostgreSQL database instead.

## Verify the slice

Run `go test ./...` and `go vet ./...`. Set `TEST_DATABASE_URL` to a disposable local database to include the real SQL integration cases. Without that variable, database integration tests report skips. Runtime production never falls back to a fake in-memory store.

Run `sqlc generate` after query/schema changes and inspect the generated diff. Run `npm run verify` for frontend type checks, unit tests, the production static build, and the useful-HTML/JavaScript-budget gate. Install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. Browser tests start the Go server and production Astro preview if those ports are not already in use. Set `DATABASE_URL` for that process and migrate/seed first.

If the managed browser download is unavailable and Chrome is already installed, set `PLAYWRIGHT_CHANNEL=chrome` before running browser tests or `scripts/measure.mjs`. PowerShell uses `$env:PLAYWRIGHT_CHANNEL = 'chrome'`. This development run used installed Chrome because the download endpoint returned a location-restriction error. Do not infer hosting or regional app accessibility from that event.

With the preview running, `node scripts/smoke.mjs http://127.0.0.1:4321` checks the real HTTP-to-SQL path and invalid-query behavior. `node scripts/measure.mjs` records bounded local lab observations and desktop/mobile screenshots under ignored `.local/`. `node scripts/measure-navigation.mjs` validates five cached detail/Back cycles, browser errors, and API reuse while recording local navigation timings. Those measurements cannot establish deployed field percentiles or Iranian-network access. The GitHub Actions workflow runs the build and behavior checks with an ephemeral PostgreSQL service. It has not been run remotely in this workspace.

## Repository structure

- `apps/web` owns Astro routes, the React island, localization, styles, and original poster generation.
- `api/index.go` is the thin Vercel handler. `cmd/server` runs the same application conventionally.
- `internal` owns catalog validation, database access, generated queries, and HTTP behavior.
- `db` owns SQL migrations and sqlc query sources.
- `catalog/movies.json` owns the bounded synthetic seed and static build input.
- `tests/e2e` and `scripts` own browser and integration checks.
- `docs` contains the product scope, accepted architecture, hosting assessment, and verification evidence.

## Decisions and limits

Read the [architecture decision](docs/architecture/0001-application.md), [API contract](docs/engineering/api-contract.md), and [performance contract](docs/engineering/performance.md). The first slice covers genre include/exclude/any/all, year/runtime ranges, sorting, pagination, details, URL sharing, and both locales. Title lookup, language/country/rating/release filters, real metadata, provider offers, and AI are later increments.

Official digital, physical, verified-file, and provider availability are different concepts. The UI must never infer WEB-DL, Blu-ray files, or access in Iran from an official release date. Canonical metadata stays separate from future provider listings. Only Zarfilm, Avamovie, 30nama, and Digimovie are selected future providers. Filimo and Namava are excluded.

## Free deployment and next work

The target is one eligible Vercel Hobby project and Neon Free database. No paid service is enabled. Read [deployment compatibility](docs/deployment/compatibility.md) and the [Vercel/Neon steps](docs/deployment/vercel-neon.md). The app remains portable to a conventional Go server. A Vercel login alone does not prove a Go-to-Neon deployment. No remote database URL is configured, and no deployed end-to-end success is claimed.

Next, verify remote routing, database TLS/pooling, and free-plan eligibility with a privately configured Neon connection. Then add one small V1 increment at a time, beginning with bilingual title lookup and its normalization tests. Real catalog ingestion/publication remains blocked on suitable rights. See [product brief](docs/product/mvp.md) and [data feasibility](docs/product/data-source-feasibility.md).
