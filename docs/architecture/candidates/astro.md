# Candidate A: Astro pages with a Go catalog API

Status: proposal, 2026-10-18; no deployment has been proved.

## Problem

Deliver immediate bilingual HTML and responsive discovery on $0 infrastructure. The first slice includes genre inclusion/exclusion with any/all, inclusive year/runtime ranges, sorting, pagination, shareable URLs, details, and both locales. Language/country/rating/release filters and title lookup follow in small milestones.

## Usage: caller's view

A visitor opens `/fa/discover?v=1&genres=crime,thriller&genreMode=all&excludeGenres=horror&runtimeMax=110`, changes filters synchronously, opens `/fa/movies/{id}/`, and returns to the same search and scroll.

The discovery island calls `moviePageOptions(normalizedFilters, page, revision)`; the resulting query options own key construction and fetching. Astro's build calls `readPublishedCatalog(revision)` for crawlable detail HTML. Both consume one versioned wire contract; neither implements filtering locally. A filtered direct visit clearly distinguishes the static unfiltered starting sample from results matching its URL until hydration completes.

## Shape and signatures

Keep `cmd/server` and `api/entry.go` as conventional-server/serverless adapters. `internal/httpapi` owns request validation and DTOs; `internal/catalog` owns catalog behavior and sqlc queries; `db/migrations` owns schema; `web` owns Astro, React, and Tailwind. No generic repository framework.

The concrete catalog exposes `Search(context.Context, SearchRequest) (MoviePage, error)` and `Detail(context.Context, MovieID) (MovieDetail, error)`. SearchRequest contains validated filters and page; the catalog instance owns its immutable revision. `NewHandler(*Catalog) http.Handler` hides transport parsing, typed errors, and JSON encoding. Ranges, genre sets, and sorts are validated domain types; generated database types stay internal, per boundary-discipline.

For the 32-film synthetic slice, PostgreSQL stores the fixture document alongside scalar filter columns and genre joins, updated in one transaction. Stable IDs and source attribution survive later normalization into title/alias and observation tables. SQL combines groups with AND, genre inclusion with selected any/all, exclusion with NOT EXISTS. Unknown scalar fields fail active bounds; inactive constraints retain unknowns. Genre exclusions reject recorded matches without claiming complete tagging. Missing sort values go last; movie ID breaks ties. Parameterized sqlc queries select compact projections without N+1 queries. Use fixed-size offset pages and a matching count query; inspect EXPLAIN ANALYZE before adding pagination complexity.

## API contract

The slice follows `docs/engineering/api-contract.md`: bilingual movie documents carry `catalogRevision=synthetic-v1`; locale selection stays in the presentation layer.

- `GET /api/movies`: `v=1`, comma-separated `genres`/`excludeGenres`, `genreMode=any|all`, inclusive `yearMin/Max` (1888–2100), `runtimeMin/Max` (1–600), `sort=popularity|rating|newest|runtime`, and `page` (1–10000). Return items, total, page, pageSize fixed at 12, and catalogRevision.
- `GET /api/movies/{id}`: movie and revision; the movie contains both titles/synopses, original title, nullable facts, genre slugs, local SVG poster, `Synthetic studio` source, and release observations.
- Discovery metadata: genre IDs/labels, supported sorts, bounds, revision, and synthetic notice. Embed generated metadata initially; a future `GET /api/meta` can expose the same shape.

Invalid ranges, duplicate scalar parameters, unsupported values, and intersecting included/excluded genres return structured 400 errors, never relaxed searches; absent IDs return 404, database failures 503. Numeric unknowns are JSON null, never zero. Arrays contain recorded values only; other HTTP methods return 405.

Release observations retain eventType, nullable date, country, source, checkedAt, and reported/confirmed verification. Scheduled, past-reported, and unknown remain distinct relative to labeled asOf; digital/physical never imply WEB-DL, Blu-ray files, or Iranian availability. Synthetic scores and observations are visibly fictional.

For the title-lookup milestone, normalize aliases centrally in Go: Unicode NFKC normalization, Arabic/Persian yeh/kaf, digits, spacing/ZWNJ, and Latin case. Preserve displayed source text. Persian falls back to English/original; routes use en/fa, UI sets lang/dir, titles use bidi isolation. Format numbers by locale; release years remain Gregorian.

## Publication and SEO

One generator validates `catalog/movies.json` and produces idempotent SQL plus Astro's bounded build snapshot with the same checksum. Seed PostgreSQL before activating matching pages; verify revision parity. No independent frontend catalog or runtime in-memory fallback; database outages remain failures.

The first catalog stays immutable. Before integrating mutable real data, define staged publication: export a PostgreSQL snapshot, build both locales, and bind API/HTML to that revision. Retaining the previous revision through cache expiry or rejecting mismatches must be proved then; revision history is outside this slice.

Prerender details and default discovery content with localized metadata, canonical/hreflang links, and snapshot/check times. Mark all synthetic pages noindex; later index permitted details while excluding unlimited filtered combinations. Immutable assets receive long CDN caching; HTML revalidates and public JSON uses revision-keyed ETags. Rebuild on publication; SSG does not provide live release freshness. Reconsider Astro SSR only when measured catalog size or refresh frequency justifies its extra runtime.

## Navigation and prefetch

Use Astro ClientRouter on public routes, a module-scoped QueryClient, and explicit history/scroll restoration. Controls update immediately; replace transient URL edits, push committed changes, reset page on constraints, and restore popstate. Stable keys include revision, normalized filters, and page; bilingual DTOs avoid locale refetches. Retain previous cards with a pending label; stale requests consume AbortSignal. Proposed Query cache bounds: 60-second freshness, ten-minute inactive lifetime, 30 inactive pages.

Card hover/keyboard focus intentionally prefetches the Astro HTML destination. Configure prefetchAll false; no full-size poster speculation. Astro supports hover/focus and slow-network/save-data adaptation. Its documented helper exposes no cancellation handle: cancel queued intent timers, and cap document speculation to two distinct destinations per client session. In-flight hints remain browser-controlled. [Astro prefetch](https://docs.astro.build/en/guides/prefetch/)

Separately, prefetch at most the next discovery page near its boundary when total indicates one exists, with two concurrent JSON requests, deduplication, cancellation, and the same query key on consumption. Disable speculation on saveData/slow networks; normal navigation still works. Current TanStack docs recommend queryClient.query for cache prefetch. Static details consume prefetched HTML, not Query JSON. [Query prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)

Use sized responsive synthetic posters, reserved card dimensions, reduced-motion transitions, and explicit offline/error recovery. Defer service workers until measured benefit and retention rights exist.

## Deployment proof and tradeoffs

Attempt one root Vercel project: Astro static output, a thin Go handler, same-origin API rewrites, and Neon. Official Go support is Beta; mixed-build routing/module imports remain spike gates. Reuse one small pgx pool per warm instance, bound query/acquire deadlines, validate TLS, and use Neon pooled connections for serving/direct connections for migrations. Local Astro proxies to the same Go handler with local PostgreSQL. [Vercel Go](https://vercel.com/docs/functions/runtimes/go), [Neon pooling](https://neon.com/docs/connect/connection-pooling)

Hobby permits personal noncommercial use. Neon currently documents 100 CU-hours, 1 GB storage, and 5 GB transfer per project, with five-minute scale-to-zero. Eligibility, quota headroom, and Iran connectivity remain unverified; $0 is conditional. [Hobby](https://vercel.com/docs/plans/hobby), [Neon plans](https://neon.com/docs/introduction/plans)

The spike must prove deployed Astro/React → Go → PostgreSQL, environment handling, reproducible routing, cold/warm latency, pool behavior, mobile interactions, and intentional-prefetch reuse. Record LCP/INP/CLS targets of 2.5s/200ms/0.1 and wasted speculation; measurements are not yet available. If composition fails, try two projects with an API proxy before evaluating a free conventional Go host.

We accept Astro build/publication complexity for crawlable, low-JavaScript details. A Vite/React SPA simplifies rendering ownership but exposes public content to client startup and adds SEO work; SSR adds runtime cost before need is measured. Source permissions gate real metadata ingestion/publication; interviews and the 40-film audit do not block this synthetic prototype. Next: build only the deployment spike after synthesis.
