# Performance contract for the synthetic slice

These are requirements and budgets, not measured results. Measurements must name environment, build, data size, request success, cache state, and limitations.

## Rendering and interaction

Astro prerenders public routes with meaningful content. React hydrates discovery only. Filter controls update immediately. A previous result can remain visible while loading, but its count must not pretend to satisfy newly selected filters. Signal pending state with aria-busy and small progress feedback. Debounce text, validate boundaries, cancel obsolete requests, deduplicate identical queries, and prevent stale responses from replacing current results.

History contains deliberate filter changes rather than keystrokes. Restore filters, page, locale, cached results, and scroll through browser Back/Forward. A full-document fallback remains available without custom navigation.

## Cache ownership

Use hashed assets with long browser/CDN caching. Use short explicit public API freshness and conditional validation only where revision and time semantics support it. TanStack Query owns a bounded, short-lived interactive result cache. Cache keys contain normalized filter state and catalog revision. Do not add Redis or a second persistent result cache.

Astro document prefetch warms the HTML destination actually used by navigation. Query prefetch warms the API response actually used by React. Do not claim these are interchangeable. Card hover and keyboard focus are intentional triggers. Skip speculative work with Save-Data, slow connections, or constrained device memory. Bound simultaneous work and unique destinations. Do not prefetch full images or the catalog. Next-page and viewport speculation are deferred until evidence justifies them.

## Images, motion, and interruptions

Own synthetic poster artwork is local and compact. Declare image dimensions, sizes, and loading priority. Lazy-load below the fold. Honor reduced motion and keep a stable poster aspect ratio. A failed or interrupted request keeps useful content with a retry action and an honest offline/error notice. Do not advertise offline freshness. A service worker is not required for the spike. Evaluate a small offline page or visited-page cache later under the relevant content rights.

## Database and hosting

Bound page sizes, query duration, pool size, and result columns. Use generated sqlc queries with stable sorting and no N+1 hydration. Record EXPLAIN ANALYZE against representative synthetic data. The small functional fixture cannot establish scalability. Serverless handlers reuse a small pool per instance, with zero minimum connections. Neon sleep and function startup remain visible in cold/warm evidence. Compression must work with the platform rather than double-compress responses.

## Initial budgets and measurements

Target deployed p75 LCP <= 2.5 seconds, INP <= 200 milliseconds, and CLS <= 0.1. A local Lighthouse score is not field p75 evidence, and a single measured interaction is not a robust INP estimate. Target warm filtering within a few hundred milliseconds on representative connections. Start with a 150 KiB gzip discovery-route JavaScript ceiling and revisit it only with bundle evidence. This ceiling is a planning choice.

Record production-build route bytes, request count, correct filter responses, cache hits/misses, request cancellation, detail-prefetch reuse, Back restoration, cold/warm local and remote API observations separately, and SQL duration. Use mobile CPU/network throttling and both locales. Record median and range for repeated timing samples. Do not call a free host native-like based on localhost. Iran accessibility requires an actual consenting tester on an Iranian network.

## Title lookup implementation

Title lookup is independent of discovery: no per-keystroke URL/history writes or filter changes. It requests at most six compact suggestions after a 200 ms debounce; IME composition defers lookup until committed. No initial title request is sent. Switching the observed TanStack key cancels obsolete fetches immediately, even during the next debounce or on Escape/blur/unmount. Previous suggestions are hidden while a different query is pending; responses are validated for revision, safe IDs and the six-item bound. Search does not prefetch the catalog; selected detail links reuse the existing intent-prefetch and navigation behavior.

The lookup cache uses its own `titles` family, 30-second freshness, 60-second garbage collection, and at most eight inactive entries plus the observed query. Its capacity does not evict discovery entries. HTTP lookup responses are not cached. Focusing the input on narrow screens deliberately scrolls it above the suggestions, leaving room to select a result. The results panel is an overlay with bounded height and scrolling, so opening/loading/updating it does not move the collection. Inputs and clear controls are at least 48 px high; suggestions are at least 64 px. System fonts and existing colors/styles are reused, with no new dependency.

No schema migration or extension is necessary. With 32 movies, scanning three title fields per row avoids storing a second mutable normalized projection. The work grows linearly with catalog size and normalization is repeated per lookup. A normal B-tree index cannot accelerate arbitrary infix `strpos` matching; adding one now would not solve that query. For a modest larger catalog, measure warm/cold plans and latency first. If scans become material, consider a versioned normalized title projection and `pg_trgm` index with matching predicates in a separately reviewed migration. No index, extension, provider, paid service or additional cache is introduced in this milestone. The hard result and query-time bounds remain essential but do not make scans constant-time.

See [title lookup verification](../verification/title-lookup.md) for local measurements and limitations.

## Advanced discovery filters

Language/country changes commit immediately; score and optional vote-count drafts
commit together through an explicit Apply button. These controls send discovery
requests only, using the existing canonical `movies` cache family and cancellation.
Title lookup, debounce and cache ownership are unchanged. Never prune synchronously
inside QueryCache events: observer transfers are incomplete at `observerRemoved`.
The existing coalesced microtask cleanup and zero-observer predicate must remain.

The filter vocabulary is bounded to 11 original languages and 16 production
countries for the owned fixture. Native disclosures and checkbox chips avoid an
external dropdown library or locale-data dependency. Both locales share the same
stable codes and query keys. The UI does not fetch filter options per selection.
See [advanced filter verification](../verification/advanced-filters.md) for build,
SQL and browser regression evidence; these remain local lab measurements.
