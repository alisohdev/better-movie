# Free deployment compatibility

Checked on 2026-10-18 against first-party documentation. Target: $0 monthly infrastructure for a personal, noncommercial pilot.

The recommended candidate is one Vercel Hobby project containing static Astro pages and Go functions, plus one Neon Free PostgreSQL project. This preserves Go portability and gives the browser one origin. The protected remote slice is now verified on the committed revision recorded in [remote results](../verification/remote-2026-10-18.md). Provider eligibility and regional access remain unresolved.

| Evidence level | Current conclusion |
| --- | --- |
| Documentation-supported | Vercel documents static Astro, Go handlers, and internal rewrites. Neon documents pgx and pooled PostgreSQL connections. |
| Locally tested | The static build, portable Go handler, real local PostgreSQL queries, and browser checks are recorded separately in [verification results](../verification/results.md). These do not establish remote compatibility. |
| Remotely tested | The protected Hobby Preview builds with Go 1.25, reaches the existing Neon database with verified TLS, and passes both browser projects. See the [dated evidence](../verification/remote-2026-10-18.md) for measurements and limits. Regional accessibility, field p75, and isolated Go initialization duration remain unverified. |

## One project is the first candidate

The repository keeps `go.mod`, `go.sum`, `vercel.json`, and `api/index.go` at the root. Astro source and its package live in `apps/web`; its static output is `apps/web/dist`. Ordinary Go packages and a conventional `cmd/server` reuse the same HTTP application.

The Vercel project root must remain the repository root. Proposed settings are `framework: null`, install command `npm ci`, build command `npm run build` delegating to Astro, and `outputDirectory: "apps/web/dist"`. Vercel documents `null` as the Other preset and discovers supported functions under root `api`. These settings avoid selecting the Go server preset. [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json#framework)

Vercel's Go runtime is beta on all plans. An exported `func Handler(http.ResponseWriter, *http.Request)` in `api/index.go` is supported. Dependencies come from root `go.mod`; commit `go.sum`. The runtime selects the `go` version or overriding `toolchain` directive. Current documentation also offers a full Go server preset, but combining that server with a frontend uses Services. The spike uses the documented function path. [Go runtime](https://vercel.com/docs/functions/runtimes/go)

The configured rewrite sends `/api/:path*` to `/api/index?__route=:path*`. The thin Go adapter validates and removes that reserved parameter, then restores the portable `/api/...` route while preserving public query parameters. Vercel documents same-application rewrites to functions. Local tests verify the adapter; the remote spike must verify the platform's resolved URL and path, including query parameters and unknown routes. The dated remote record verifies this combination, including Vercel preserving the public path and injecting both `__route` and wildcard `path` query values. The adapter validates and removes those technical values before public filter validation. [Rewrites](https://vercel.com/docs/routing/rewrites#same-application-rewrites)

Two Vercel projects add separate environment scopes and deployment coordination. Direct cross-origin API requests also need CORS. They offer little benefit for this slice, so keep them as a fallback for a demonstrated routing or build blocker.

## Static Astro keeps public rendering inexpensive

Astro defaults to static output and requires no Vercel adapter for static deployment. On-demand rendering requires an adapter and adds runtime rendering. The initial catalog can therefore produce crawlable localized pages during builds. Catalog changes require another build for that HTML to change. [Astro deployment](https://docs.astro.build/en/guides/deploy/vercel/)

React integration supplies hydration. Framework components first produce HTML unless `client:only` is used; a `client:*` directive loads the interactive component. Hydrate discovery controls deliberately and keep ordinary detail content static. [Framework components](https://docs.astro.build/en/guides/framework-components/#hydrating-interactive-components)

## Free allowances are finite

Hobby permits noncommercial personal use. Vercel defines commercial use by financial gain, including paid development, advertisements, and product promotion. Absence of payments alone does not classify this pilot. Confirm the actual project purpose before public deployment. [Fair use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)

Current Hobby allowances include 100 GB fast data transfer, 10 GB origin transfer, and one million CDN requests. Its headline function allowances are one million invocations, four CPU-hours, and 360 GB-hours of provisioned memory. Exceeding allowances can interrupt service. [Hobby plan](https://vercel.com/docs/plans/hobby)

Go is absent from the current Fluid runtime support list. Do not apply Fluid's headline duration or billing assumptions to the Go function. [Fluid runtime support](https://vercel.com/docs/fluid-compute#available-runtime-support) The separate legacy pricing page lists 100 GB-hours and 100,000 invocations, with no Hobby overage charges but possible suspension. Confirm which meter applies to the deployed Go function. [Legacy function pricing](https://vercel.com/docs/functions/usage-and-pricing/legacy-pricing)

Configure `functions["api/index.go"].maxDuration` as 10 seconds for the spike, with shorter database deadlines. Go supports this configuration location. The live limits table explicitly gives 300 seconds for Node.js, Bun, and Python. Older indexed official text gives non-Fluid Hobby a 10-second default and 60-second maximum, but that table is absent from the current live page. The current Go-specific ceiling needs provider verification. [Duration configuration](https://vercel.com/docs/functions/configuring-functions/duration), [Function limits](https://vercel.com/docs/functions/limitations#max-duration)

Neon Free currently includes 100 CU-hours per project monthly, 1 GB PostgreSQL storage per project, 20 GB across the account, 5 GB monthly public transfer per project, and ten branches per project. Older indexed 0.5 GB storage descriptions are stale. Free compute suspends after five idle minutes; disabling suspension requires another plan. Exhausted compute or transfer suspends compute until reset; storage limits reject operations that increase storage. The reviewed PostgreSQL plan specifies resource quotas rather than a fixed SQL-request allowance. Neon Functions' invocation allowance is a different product. [Neon plans](https://neon.com/docs/introduction/plans)

Keep both accounts on their free plans, use the supplied subdomain, and avoid paid add-ons, trials, and automatic upgrades. Inspect usage before inviting more testers. A database wake-up can combine with a Go cold start, so native-like warm behavior does not establish native-like first-request latency.

## Pooling needs a small client budget

Use Neon's pooled hostname containing `-pooler` for application traffic. Use a direct connection for migrations and administrative tools. Neon uses transaction pooling, accepts up to 10,000 client connections, and has a much smaller underlying PostgreSQL connection limit. Ten thousand connections is not ten thousand concurrent queries. [Neon pooling](https://neon.com/docs/connect/connection-pooling)

Recommended starting settings are one lazily initialized pgxpool per function instance, `MaxConns=2`, `MinConns=0`, and `MinIdleConns=0`. Each instance has its own pool, so aggregate connections still grow with instances. Tune idle lifetime and check stale connections after suspension. These are project defaults to test, not provider guarantees. [pgxpool configuration](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool#Config)

Neon supports protocol-level prepared statements with a nonzero PgBouncer limit; SQL `PREPARE` is unsupported. [Prepared statements](https://neon.com/docs/connect/connection-pooling#protocol-level-prepared-statements) pgx documents compatible cached statements and `QueryExecModeExec` as an alternative when support is unavailable. Avoid `QueryExecModeDescribeExec` with transaction pooling. Test the pinned driver rather than disabling all prepared statements by assumption. [pgx PgBouncer guidance](https://pkg.go.dev/github.com/jackc/pgx/v5#hdr-PgBouncer)

Neon requires TLS and recommends `sslmode=verify-full`. Keep `DATABASE_URL` server-side and verify the deployed Go certificate validation. The current Preview has a private Neon database credential; it is excluded from Git and frontend output. [Secure connections](https://neon.com/docs/connect/connect-securely)

Local development can use PostgreSQL 18 in a dedicated scratch cluster or optional Docker container, the conventional Go server on port 8080, and Astro on port 4321. Astro's Vite configuration can proxy `/api` to Go. This tests the browser contract without requiring cloud credentials. [Vite development proxy](https://vite.dev/config/server-options#server-proxy)

## Eligibility and fallback remain conditional

Vercel requires applicable-law compliance and represents that customers are not sanctions targets. [Vercel terms](https://vercel.com/legal/terms) Neon's October 14 schedule incorporates Databricks' agreement, whose export-controls clause restricts prohibited access. These documents do not establish this operator's eligibility. [Neon schedule](https://neon.com/platform-terms), [Databricks agreement](https://www.databricks.com/legal/mcsa) Account acceptance, permission to serve the audience, and actual access from Iranian networks require separate evidence. None was tested here.

If Vercel proves unusable, evaluate the portable Go server on Render Free with Neon retained. Render sleeps after 15 idle minutes and documents about one minute to restart, 750 shared monthly instance-hours, and possible extra bandwidth charges when a payment method exists. Render Free PostgreSQL expires after 30 days. This is a deliberate testing fallback with a substantial latency tradeoff. [Render Free](https://render.com/docs/free)

## Remaining remote smoke checks

Record the commit, toolchain, configuration, region, plan, timestamps, and observed result for each check.

1. Rebuild from a clean checkout and confirm Astro HTML, assets, direct detail URLs, and a working React island.
2. Verify Go discovery, API rewrites, query strings, error responses, and same-origin browser calls.
3. Set server environment variables privately. Verify secure database access and missing-variable failure without exposing secrets in assets or logs.
4. Apply migrations to an isolated Neon branch. Test concurrent reads, connection counts, cancellation, and reconnect after suspension.
5. Measure static delivery, cold API, warm API, cold database connection, warm query, and mobile discovery separately.
6. Confirm free-plan meters and eligible account ownership. Test representative Iranian networks and record failures as well as successes.

This list originally described unverified checks. The [dated remote record](../verification/remote-2026-10-18.md) now establishes the committed build, API, bilingual UI, and lab performance results. Regional access, field metrics, isolated cold-function duration, connection counts under load, and missing-environment deployment behavior remain open.
