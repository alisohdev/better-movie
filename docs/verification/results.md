# First vertical slice verification

Local verification on October 18, 2026. The build contains two discovery routes, 64 localized detail routes, and the root redirect. All 32 records, scores, release observations, and SVG posters are original synthetic examples. No third-party film metadata was ingested, and no provider was scraped.

## Automated and browser checks

`go test ./... -count=1` passed with real PostgreSQL integration enabled. `go vet ./...` passed. `sqlc generate` reproduced all committed generated bindings byte-for-byte. See [backend evidence](backend.md) and the raw ignored [PostgreSQL plan output](../../.local/sql-plans.txt).

`npm run verify` passed: Astro reported zero diagnostics, all 18 frontend unit tests passed, the production build generated all 67 pages, and its build gate confirmed twelve server-rendered cards in each language and 118,967 bytes of gzip JavaScript across every emitted script, below the conservative 150 KiB ceiling. Both English and Persian routes are `noindex` for this synthetic preview.

`npm run test:e2e` passed all 20 browser checks across desktop Chrome and a mobile viewport in installed Chrome 155. Checks covered useful pre-hydration HTML, RTL/LTR direction, Persian range validation and switching language, real SQL genre and runtime filters, any/all matching, stable details and Back scroll, empty/error states, cached results, adaptive detail prefetch, delayed-query races, and filter Back/Forward without a document swap or page error. Separate no-JavaScript checks confirmed useful cards, translated fallback, and full-page detail navigation in both languages. Edge also passed the two filter history Back/Forward cases.

`node scripts/smoke.mjs http://127.0.0.1:4321` passed nine real HTTP-to-PostgreSQL observations, including successful health/list/filter/detail routes and expected 400/404 responses. `node scripts/measure-navigation.mjs` passed five detail/Back cycles with zero browser errors and one total API request, showing the reused result cache and intentional prefetched navigation.

## Local lab measurements

`node scripts/measure.mjs` ran against the production preview with 32 synthetic records on Windows x64, an Intel i3-10100, 24 GiB RAM, and Node 24.19.0. The mobile emulation used 4x CPU slowdown, 150 ms latency, and 1.6 Mbps downstream. These measurements describe this local lab only.

| Observation | Desktop English | Mobile Persian |
| --- | ---: | ---: |
| Single cold-browser LCP | 1,060 ms | 2,484 ms |
| CLS | 0 | 0.00050 |
| Resource entries | 24 | 20 |
| JavaScript resources | 10 | 10 |
| Horizontal overflow or page errors | None | None |

All generated JavaScript totaled 116.2 KiB gzip. Five successful, correctly filtered API responses measured 6.88 ms median, range 6.21–21.18 ms, including the local Astro proxy, Go handler, PostgreSQL, and JSON. These five requests cannot establish a latency distribution or identify the limiting layer.

The separate five-cycle intent-prefetch/navigation run measured 352 ms median detail navigation (range 110–378 ms) and 63 ms median Back restoration (range 53–71 ms), including Playwright driver and assertion time. One deliberate detail prefetch completed after its 140 ms intent delay. Tests confirmed the detail body was reused and Save-Data suppressed speculative requests. Do not interpret these lab timings as end-user percentiles or zero-network navigation.

One Lighthouse run on the earlier, visually equivalent build reported a 0.99 performance score, 1.00 accessibility and best-practices scores, 1,891 ms LCP, zero CLS, and zero TBT. Its only failed binary audit was the nonactionable back/forward-cache audit, which returned an internal error. A rerun after the final change did not complete because headless Chrome presented an interstitial, so there is no valid current Lighthouse report. An earlier capture under the same throttled mobile settings measured 2,556 ms LCP; the latest 2,484 ms capture is only 16 ms inside the target and cannot establish repeatable performance. Neither capture establishes p75 LCP, INP, cold hosting, Neon wake-up, availability from Iran, or scale beyond this 32-film fixture.

## Architecture and deployment status

The local browser-to-Astro-to-Go-to-PostgreSQL path works. The Go HTTP logic remains portable between the conventional server and thin Vercel handler. One Vercel Hobby project and Neon Free remain the $0 target, subject to account eligibility and actual hosting behavior.

There is no configured Neon database URL or Neon API credential, no connected Git remote, and no Vercel deployment. Therefore, Vercel rewrite behavior, deployed React hydration, Neon TLS and connection reuse, cloud cold/warm requests, free-tier eligibility, and regional access remain unverified. Use the exact [Vercel and Neon checklist](../deployment/vercel-neon.md) when credentials and account access are available. CI is configured but has not run remotely.

## Current scope and next increments

This slice deliberately ends at synthetic genre include/exclude/any/all filtering, year and runtime ranges, sorting, pagination, shareable URLs, localized results, official-release observation examples, and details. It has no real catalog, title search, language or country filter, rating threshold, provider offer, authentication, video, AI, ads, or billing.

First verify eligible free hosting with a privately configured Neon database. In parallel, settle real metadata permissions and audit source coverage. Then add bilingual title aliases, language/country and source-labeled rating filters, followed by sourced official digital/physical observations only if the evidence supports them. No source, provider, or real-film publication is approved by this synthetic prototype.

## Hosted provisioning attempt

Vercel project creation and Neon Free provisioning completed. The integration attached preview environment variables; migration and seed were run through the Vercel environment without printing the database URL. The 32 synthetic fixture rows are present in Neon. `sslmode=require` from the provider is strengthened to certificate and hostname verification in `internal/database/pool.go`.

The production build passed on Vercel after narrowing `.vercelignore` so required Astro scripts remained included. Vercel then blocked the deployment because the repository commit author lacks deployment permission for the account. There is no ready preview deployment to test, so remote HTTP routing, React hydration, and end-to-end Vercel-to-Neon requests remain unverified. See the [deployment handoff](../deployment/vercel-neon.md).
