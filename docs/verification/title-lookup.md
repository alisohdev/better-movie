# Bilingual title lookup verification

The implemented story is: type an English, original or Persian title in either interface → bounded Go API → parameterized sqlc lookup in PostgreSQL → localized suggestions → existing detail page → Back restores discovery constraints and scroll.

## Checks

- `go test ./...` passed with `TEST_DATABASE_URL` pointing only to the local PostgreSQL 18.6 Docker instance. Integration tests migrate/seed disposable random schemas, never Neon. Cases cover both query and stored-title Persian variants, diacritics, half-spaces and whitespace, all three title fields, unchanged display values, English case, mixed-direction text, exact/prefix/substring ranking, stable ID ties, deduplication, empty inputs, literal SQL/wildcard text, six-item bounds, revision mismatch and cancellation of a blocked real SQL query. Go validation and HTTP tests cover invalid encoding, controls, duplicate/unknown parameters, 120-character limits, methods, no-store responses and sanitized failure states. The existing function adapter also exercises the new endpoint against PostgreSQL.
- `go vet ./...` passed.
- sqlc 1.31.1 regeneration reproduced all generated Go files byte-for-byte (SHA-256 manifests before/after). Existing generated discovery queries are unchanged.
- `npm run verify` passed: zero Astro diagnostics, 22 unit tests, production build and JavaScript budget gate. Unit tests cover compact response bounds/revision/IDs, safe parameter encoding, AbortSignal propagation, cache reuse and independent cache capacity.
- Browser E2E: all 36 checks passed in system Chromium on desktop and Pixel 7 emulation, including both locales, keyboard arrows/Enter/Escape, touch selection, translation fallback, debounce, IME composition, immediate abort/stale response suppression, offline/retry/no-match/invalid states and mobile popup visibility. All existing genre/range/sort/cache/prefetch/filter history and detail/Back/scroll checks pass. Command: `PATH=/tmp/title-toolchain/go/bin:$PATH DATABASE_URL=<local-test-url> npx playwright test --config=.local/playwright.cloud.config.ts`; the ignored cloud config changes only the browser executable and workspace paths. It uses the committed production-preview/API test setup. Standard CI continues to use `npm run test:e2e` with Playwright's installed browser.

## Performance evidence

Measurements are in [title-lookup.json](title-lookup.json), reproducible with `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium node scripts/measure-title-lookup.mjs` against the local production preview and Go API. Environment: Linux, AMD EPYC 9V74, Node 24.19.0, PostgreSQL 18.6, the unchanged 32-film synthetic fixture. E2E and other processes shared this environment during capture; this is not an isolated throughput benchmark.

All emitted JavaScript totals **120,657 bytes / 117.8 KiB gzip**, compared with **118,979 bytes** for the freshly built base `main` (`00a7ff6`): **+1,678 bytes / 1.6 KiB**, below the 150 KiB ceiling. This includes every generated script, a conservative upper bound for a single discovery route. No dependencies were added. Both locales retain twelve server-rendered cards, and no catalog is embedded for client-side title filtering.

Five successful uncached warm local title HTTP responses returned six suggestions each, **887 bytes of JSON**, with **5.50 ms median**, **4.56–29.83 ms range**, including preview proxy, Go, PostgreSQL and JSON. A warm `EXPLAIN (ANALYZE, BUFFERS)` on the unchanged isolated fixture recorded **0.310 ms execution**, **0.332 ms planning**, using a sequential movie scan and lateral title expansion. The generated lookup test logs this plan on demand; these single SQL timings do not establish scale.

Five distinct successful queries per surface measured input-to-render time, including the intentional **200 ms debounce**, network emulation and Playwright overhead:

| Surface | Median | Range |
| --- | ---: | ---: |
| Desktop en | 255.76 ms | 244.63–307.04 ms |
| Desktop fa | 271.42 ms | 252.72–323.26 ms |
| Mobile en | 505.56 ms | 429.56–610.05 ms |
| Mobile fa | 514.24 ms | 445.56–589.96 ms |

Mobile used 4x CPU slowdown, 150 ms RTT and 1.6 Mbps downstream. Each surface sent exactly five lookup requests for five queries, with none before typing. Opening/loading/updating the popup caused **zero collection displacement** after deliberate mobile focus scrolling; no horizontal overflow or browser errors were observed. This interaction measurement is not a page-wide CLS measurement. The 200 ms debounce coalesces typing while keeping these local interactions under roughly 0.7 seconds with throttling; it does not establish field INP or a network guarantee.

## Database and delivery limits

No schema migration, extension, index, Neon write, secret change, Vercel configuration change or deployment is required or performed. The Vercel project was checked read-only before branch publication: it has no Git integration, so branch pushes cannot initiate a Vercel Git deployment. The manual Preview workflow is not dispatched.

Normalization currently scans up to three title fields per movie; future growth needs representative measurements before introducing normalized storage or a trigram index. See [indexing tradeoffs](../engineering/performance.md#title-lookup-implementation). Compact keys intentionally ignore word boundaries; this is literal normalized title lookup with no transliteration or typo correction. Current data has only one available Persian title per film; future alias expansion requires an explicit data-model decision.

Local emulation does not establish real Android keyboard behavior, screen-reader usability, deployed p75 LCP/INP/CLS, Vercel cold starts, Neon wake-up, Iranian-network accessibility, or larger-catalog performance. No new production performance claim is made.
