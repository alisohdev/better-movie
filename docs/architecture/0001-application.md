# 0001. Astro public pages with a portable Go catalog API

Status: accepted for the synthetic vertical slice, October 18, 2026. Remote deployment remains unverified.

## Problem

The app needs useful bilingual HTML, responsive filters, a real SQL-backed API, and $0 initial infrastructure. The user approved Go and Astro/React and asked for a concrete comparison with a simpler SPA. Real-data licensing must not block owned synthetic UX development.

## Usage

A visitor opens `/en/discover/`, changes visible filters, calls `/api/movies` without a document reload, opens a prerendered detail page, and returns to the same URL, results, and scroll. The Persian route supplies the same behavior in RTL. A conventional server and a Vercel function call the same Go HTTP application. See the [wire contract](../engineering/api-contract.md).

## Shape

Use root `api/index.go` as a thin exported handler and `cmd/server` as the conventional executable. `internal/catalog` owns validated filter state, SQL-backed queries, and movie data. `internal/httpapi` owns transport validation and public errors. `db/migrations` and `db/queries` generate pgx bindings through sqlc. Store canonical facts once in typed columns, with genre membership and bounded release observations. Do not keep a separately editable JSON duplicate of movie scalar facts.

`apps/web` contains static Astro routes and one React discovery island. `catalog/movies.json` is the shared owned synthetic seed/build input. Only the first page is serialized into discovery HTML, not the entire catalog. PostgreSQL supplies live results. Static details are an explicit immutable snapshot, not a hidden database-failure fallback. The current catalog revision is `synthetic-v1`.

`scripts` and tests own repeatable local and deployment checks. The module boundaries hide parameterized querying, nullable row conversion, and cancellation behind a small search/detail interface. UI state follows the URL contract. No repository abstraction, ORM, separate search service, or background-job framework is needed.

## Synthesis decision

Candidate A is the base. The independent native judge preferred its useful HTML and selective hydration over Candidate B's client-rendered startup. The judge used the same configured Sol family, so this is independent review without model diversity. See [judgment](judgment.md) and both [Astro](candidates/astro.md) and [SPA](candidates/spa.md) proposals.

Take two policies from the SPA proposal: a single browser QueryClient with explicit inactive-result bounds, and coalesced history entries that never push during Back restoration. Prefetch the actual Astro detail document on card intent. Do not fetch detail JSON that static navigation never consumes. Next-page and viewport speculation stay deferred until measured benefit.

Use one Vercel project, root framework preset Other, static `apps/web/dist`, and Go function routing. Neon Free is the remote database candidate. Local PostgreSQL proves the application contract. Account eligibility, routing behavior, Go runtime duration, Neon access, and actual Iranian connectivity remain independent remote gates. No paid alternative is enabled.

## Tradeoffs accepted

- Static detail pages require a rebuild when the catalog changes. Before mutable real-data publication, define a database export/revision activation policy. Do not add revision-retention infrastructure for 32 immutable synthetic films.
- A direct filtered URL initially has a labeled static starting sample until hydration retrieves its correct SQL result. It must never label that sample as satisfying the URL.
- Go functions and Neon can both start cold. Local timings cannot prove free-host latency.
- Query memory survives Astro client navigation, but a hard refresh relies on HTML and HTTP caching. Full offline storage and a service worker are deferred.
- The first slice uses offset pages of twelve and stable sorting. Measure before adding keyset pagination.

## Alternative considered

Go plus a Vite/React SPA has one continuous React tree and less rendering integration. It exposes public content to JavaScript startup and requires a separate prerender/SEO solution to meet the explicit brief. It loses on useful initial HTML, not on backend portability. Astro SSR is another future option if measured freshness or catalog size requires it. Neither change is justified for this slice.

## Verification and next step

Build the smallest Astro/React to Go to PostgreSQL path first. Verify an actual database read and error handling, then expand only into the agreed filters, detail navigation, URL state, and bilingual UX. Record local and remote results separately in `docs/verification/`. See [deployment compatibility](../deployment/compatibility.md) and [performance contract](../engineering/performance.md).
