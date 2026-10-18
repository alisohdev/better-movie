# Candidate B: Go API with a Vite React SPA

Status: alternative evaluated, preferred Astro direction retained. Both supplied prompts supersede the older product brief. This is a design proposal.

## Problem and recommendation

A Vite React SPA gives discovery and details one persistent React tree and query cache. That simplifies navigation continuity. However, the product explicitly requires meaningful Astro HTML, selective hydration, bilingual public pages, and small JavaScript workloads on mid-range Android. A pure SPA fails the initial HTML requirement. Retain Go plus Astro and React unless the deployment spike exposes a concrete blocker.

## Usage before modules

A visitor opens `/fa/discover?v=1&genres=drama,crime&genreMode=all&excludeGenres=horror&runtimeMax=110&yearMin=2000&sort=newest&page=1`. Controls reflect that URL immediately. The client requests `GET /api/v1/movies` with the same stable parameter names and `locale=fa`, receives twelve compact cards and pagination information, then opens `/fa/movies/{id}` through `GET /api/v1/movies/{id}?locale=fa`.

The response contains `items`, `page`, `hasMore`, and `catalogVersion`. Details add titles, synopsis, provenance, and recorded release observations. An invalid query receives a structured 400 error. An unknown movie receives 404. Empty results preserve every constraint. Back restores the URL, cached results, and scroll position.

## Shape and ownership

`cmd/server` constructs a portable `http.Handler`. An exported serverless handler delegates to that same handler. `internal/catalog` exposes `Search(context, Filter, Locale) -> Page` and `Movie(context, MovieID, Locale) -> Movie or NotFound`. Its parameterized sqlc queries and pgx storage details stay internal. Request contexts bound connection acquisition and query execution.

The HTTP boundary parses versioned parameters into validated filters. Sort values are popularity, rating, newest, or runtime. Different filter groups combine with AND. Included genres match any or all, exclusions reject any matching tag, and overlap is invalid. Year and runtime bounds are inclusive. Changes reset pagination. Sorts use a stable movie-ID tie-breaker and place unknown values last.

Unknown year, runtime, rating, or release evidence remains nullable. An active constraint excludes unknown values for that field. Inactive constraints retain them. An unknown genre set fails active inclusion or exclusion constraints. Incomplete tags cannot establish content safety. SQL and domain tests own these rules. The browser never presents locally filtered partial pages as complete results.

One product-authored `data/synthetic/catalog.json`, with stable IDs and a catalog version, supplies PostgreSQL seeding and HTML build inputs. It includes bilingual titles and deliberate missing values. API and HTML display the synthetic label. Real ingestion remains permission-gated. Release observations retain type, country, source, date, and checked time. They never imply verified files or access in Iran.

## Continuity and transferable policies

The SPA keeps one QueryClient mounted across discovery and detail routes. Query keys include API version, build-known synthetic catalog version, locale, canonical filters, sort, and page. Proposed initial bounds are twenty result pages, forty details, and five-minute freshness, with explicit eviction beyond time-based collection.

Controls update synchronously. Pending searches retain previous cards and show progress. Requests carry cancellation signals, stale responses cannot replace newer selections, and free text is debounced. Coalesced draft edits commit one history entry. URL normalization uses replacement. Restoring history never pushes another entry.

Hover or keyboard focus starts a deduplicated detail prefetch. Speculation is disabled for data saving and reduced on slow connections. Limit concurrency to two and avoid speculative full-size posters. Responsive posters reserve dimensions. Optional offline storage later retains only bounded, permitted content with explicit stale messaging. [TanStack Query documents intent-based prefetching and freshness controls](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching).

These policies transfer to Astro. Its [ClientRouter and persistent islands](https://docs.astro.build/en/guides/view-transitions/) can preserve state across document transitions, with reduced-motion support. The Astro candidate must prove that its cache survives navigation and that prefetched responses are consumed. Fetching detail JSON and then ignoring it while fetching HTML wastes the SPA's main advantage.

## Rendering and bilingual tradeoffs

The SPA needs JavaScript execution before movie content appears on a cold visit. A localized HTML shell can set `lang`, direction, and navigation, but does not supply crawlable movie bodies. Updating titles, canonical links, and hreflang after React starts also leaves the initial document incomplete.

Custom route prerendering fixes those gaps, but adds rendering, refresh, and hydration responsibilities that Astro already handles. Both approaches need `/en` and `/fa` routes, mixed-direction title isolation, English metadata fallback, and filtered-URL indexing rules. Astro can prerender the bounded catalog and hydrate discovery only. Rebuild and refresh policies remain necessary.

## Deployment feasibility and evaluation

[Vite produces static deployment output](https://vite.dev/guide/static-deploy.html). Prerendered Astro does too, so removing Astro does not inherently reduce hosting cost. Try one project with static output and Go functions, keeping API routing ahead of frontend fallbacks. Use two projects only if the combined build proves unreliable.

[Vercel documents Go as beta on all plans](https://vercel.com/docs/functions/runtimes/go). The $0 target still requires account eligibility, quotas, and routing verification against [Hobby terms](https://vercel.com/docs/plans/hobby) and [Neon pricing](https://neon.com/pricing). Reuse one small pgx pool per warm instance, initially zero minimum and two maximum connections. Use verified TLS and Neon's pooled endpoint for requests, with a direct endpoint for migrations. [Neon documents transaction-pooling restrictions](https://neon.com/docs/connect/connection-pooling). Neither frontend removes API cold starts or database wake-up latency.

The SPA wins runtime continuity and basic build simplicity. Astro wins initial content, selective JavaScript, and public SEO correctness. Portability and $0 feasibility are comparable. The next step is the preferred stack's deployment spike, measuring cold and warm requests, mobile navigation, cache reuse, JavaScript size, and the stated LCP, INP, and CLS targets. No deployed performance, provider permission, or Iranian connectivity is established here.

## Synthesis decision

Reserved for the parent Arena synthesis. Candidate B recommends transferring its single-owner cache, explicit bounds, and history policy into the Astro design.
