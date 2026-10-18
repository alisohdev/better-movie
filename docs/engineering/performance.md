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
