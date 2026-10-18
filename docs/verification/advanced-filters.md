# Advanced discovery filters: verification

Base: latest `main` at `6701181970873581bfb13151e2ca8c9ff7be599a`.
Environment: Linux managed workspace, Node 24, Go 1.26.9, sqlc 1.31.1,
PostgreSQL 18.6 in local Docker, system Chromium. All live checks use the
unchanged 32 owned movies at `synthetic-v1`. No external catalog, Neon write,
secret change, workflow dispatch, merge or deployment was performed.

## Behavior and data flow

Language and country checkboxes, plus explicit score/vote application, produce
canonical `v=1` discovery URLs. The browser requests `GET /api/movies`; Go validates
the complete filter before calling parameterized generated sqlc queries. Count
and page run in one repeatable-read snapshot. The response retains the existing
DTO and 12-result bound; React validates it before displaying matching counts.

The advanced section starts collapsed on a fresh visit. Native nested disclosures,
48px controls, bilingual names and hints, score-source labeling, individual chips,
per-group clearing and full reset work in English/LTR and Persian/RTL. Invalid
links produce localized correction text without a broader discovery request.
Zero is an active threshold, while blank is absent. No vote floor is inferred.
Valid empty combinations preserve every constraint. Exclusions retain their
existing behavior and all groups combine with AND.

A new mobile navigation regression exposed a layout problem: detail/Back remounts
the discovery island, so expanded filters used to collapse and shift the saved
scroll target. The fix saves a validated, bounded disclosure snapshot in history
and the optional session selection; it restores presentation before scrolling
and waits for matching results to render. This state is independent of shared
filter URLs. Desktop keeps its always-visible panel behavior. Tests exercise
Back/Forward, individual chips, cached results, detail/Back, and expanded-panel
scroll restoration in both locales and viewport sizes.

## Automated checks

- `go test ./...` with explicit local `TEST_DATABASE_URL`: 209 tests/subtests pass;
  no integration test is skipped. Tests migrate/seed only isolated random test
  schemas. The owned app fixture remains unchanged.
- `go vet ./...`: pass.
- `sqlc generate` followed by `sqlc diff`: generated bindings consistent.
- `npm run verify`: zero Astro/TypeScript diagnostics, 54 unit tests pass,
  67 static pages build, HTML content and gzip budget checks pass.
- Desktop Chromium and Pixel 7 emulation: 60 Playwright cases, including English
  and Persian advanced filtering, malformed links, empty states, clearing,
  navigation and existing title search, cancellation, IME, offline/retry and
  prefetch checks. The final RTL chip refinement also passes a focused rerun of
  all 16 advanced cases across both locales and viewport sizes.
- `python3 -m unittest discover -s tests/ci -v`: 14 Preview guard tests pass.
  Workflows are unchanged; these are mocked guard checks, not deployments.

PostgreSQL cases compare counted and listed IDs against an independent fixture
predicate across all four sorts and every page. They cover multiple languages,
co-productions, score decimals and inclusive 0/10, independent optional votes,
missing values, combined genre/year/runtime/advanced constraints and empty
intersections. Additional isolated updates of an existing owned movie prove
known zero values satisfy zero thresholds, missing votes do not prevent a
score-only match, and vote-only constraints do not require a known rating.
HTTP and URL tests reject duplicates, unknown/case-invalid codes, empty list
entries, malformed/nonfinite/exponent numbers, score overflow, negative or
fractional votes, integer overflow and queries over 4096 bytes.

The title-query cache implementation is unchanged. Existing fresh/full-cache
cases keep `orbit` focused and unchanged for 5.1 seconds and assert exactly one
request. New cases fill the cache, repeat that assertion, change language,
country, score and votes, and reopen the existing title suggestion without any
additional title request. The microtask cleanup and zero-observer predicate
remain intact. No synchronous cache eviction is introduced.

## Bundle and local measurements

Fresh baseline build and final production build, summing gzip bytes of **all**
generated JS assets (a conservative discovery-route ceiling):

| Build | Bytes gzip | KiB gzip |
| --- | ---: | ---: |
| Base main | 120686 | 117.9 |
| Advanced filters | 123566 | 120.7 |
| Change | +2880 | +2.8 |
| Budget | 153600 | 150.0 |

No dependency, schema migration, index or external UI library is added. The
bounded supported vocabulary is 11 original languages and 16 production
countries. It is independent of current results and requires no options request.

Reproduce mobile measurements against production preview and local PostgreSQL:

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium node scripts/measure-advanced-filters.mjs
```

The checked-in [JSON evidence](advanced-filters.json) records six distinct uncached
edits per locale under 4x CPU and 150ms latency, 1.6Mbps down / 750Kbps up:

| Surface | Median edit-to-results | Range | Discovery / title requests |
| --- | ---: | ---: | ---: |
| English mobile | 321.1 ms | 296.6–412.1 ms | 6 / 0 |
| Persian mobile | 353.0 ms | 329.4–431.7 ms | 6 / 0 |

Both surfaces have zero page errors and no horizontal overflow. Timings include
Playwright interaction/scrolling and assertion overhead on a shared runner; they
are not INP. Twelve sequential unthrottled local HTTP requests through the preview
proxy all return the expected seven combined-filter movies. The first observed
sample is 25.4ms; the following eleven have median 7.8ms, range 4.8–12.5ms. The
process and database were already running, so this is not cold-start evidence.

`TestPostgresQueryPlans` runs real generated-query `EXPLAIN (ANALYZE, BUFFERS)` on
analyzed isolated fixture tables. The advanced language/country/score/votes case
returns four rows; the observed warm count/page execution times were 0.056ms /
0.197ms. No schema/index change is justified by this 32-row functional fixture.
Plans scan the small movie relation and preserve the existing stable sort.

These are local lab measurements. They establish neither catalog scalability,
deployed p75 LCP/INP/CLS, Vercel cold-start behavior, Neon wake-up nor accessibility
from an Iranian network. The PR remains for review; deployment follows only the
existing approved-merge workflow.
