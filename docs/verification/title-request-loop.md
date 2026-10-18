# Stable title lookup: request-loop fix

## Reproduction before the fix

Base: `main` at `6645e47`. All reproductions used `npm run build` and Astro production preview with the local Go API, PostgreSQL 18.6 and the unchanged 32-film synthetic catalog. Browser: system Chromium, Linux. No deployment or external database was used.

A fresh page sent one `orbit` request and stayed quiet for six seconds. A cold-cache-only check therefore missed the bug. Ordinary prior lookups fill the cache: `paper`, `last`, `space`, `sea`, `silence`, `orange`, `train`. These seven settled queries plus the disabled empty-key query reach the eviction boundary. Typing `orbit` once then causes repeated successful requests without further input or navigation.

The new full-cache desktop browser regression failed against the unchanged production implementation: suggestions could not remain available, and its Playwright trace recorded **850 orbit requests** (successful and canceled attempts) during the failed assertion. Both new QueryObserver unit tests also failed before the fix: the observer's current query was missing from QueryCache after a transfer, and a disabled observed query was evicted under pressure. The existing 22 unit tests passed.

Temporary production-build instrumentation assigned query-object identities and recorded cache events, observer counts, cache membership and fetch actions. One six-second unchanged-input window recorded **1,503 additional orbit requests** on localhost. A bounded event-buffer excerpt shows the repeated sequence below; all events share `['titles', 'synthetic-v1', 'orbit']`:

| Time (ms since navigation) | Event | Query object | Observer count | In cache |
| ---: | --- | ---: | ---: | --- |
| 11053 | removed | 3143 | 0 | false |
| 11053 | observerAdded | 3143 | 1 | false |
| 11053 | updated: fetch | 3143 | 1 | false |
| 11057 | updated: success | 3143 | 1 | false |
| 11057 | added | 3144 | 0 | true |
| 11057 | removed | 3144 | 0 | false |
| 11057 | observerAdded | 3144 | 1 | false |

Instrumentation was removed before the fix build; no debug globals or query logging ship. Local loop frequency reflects very short localhost latency and is not a production-rate claim.

## Root cause

React Query transfers a mounted QueryObserver by building the destination Query, removing the observer from the previous Query, then adding it to the destination. The custom QueryCache subscriber pruned synchronously inside `observerRemoved`. At that instant, the destination has zero observers and idle fetch status. Its new `dataUpdatedAt=0` also puts it last in the recency ordering, so the full-cache pruner removes it **before** the observer attaches.

The observer then fetches an orphan Query successfully. On the next React render, QueryCache has no entry for that key, so another Query object is built. QueryObserver sees a different object with no data and fetches again. The eviction sequence repeats. The key string and `enabled=true` can remain unchanged throughout; the 30-second stale time cannot preserve data on an object removed from the cache.

There was a related bug in the eviction predicate: TanStack's `type: 'inactive'` means no **enabled** observers, not no observers. It can include a query still watched by a disabled observer. It is not a safe ownership test for removal.

`TitleSearch` switches to its disabled empty key while waiting for debounce, on blur and on Escape, then switches back to the ready key. These legitimate transitions expose the race. Parent/pointer rerenders make the orphan visible but do not require component remounting. The reproduction stayed on the same discovery URL/document with unchanged input; Astro navigation was not the trigger. Detail/Back navigation still remounts the island normally and reuses the browser QueryClient.

## Fix and verification

Cache cleanup is coalesced into a microtask, after synchronous observer transfers finish. At execution time it selects only idle queries with **zero observers**, retains the eight most recently used unused entries per family, and removes the rest. Disabled observers are protected. The cache count can temporarily exceed its bound within a synchronous event batch; it is trimmed at the next microtask. No delay, rate limiter, refetch suppression or new persistent cache is added. Query keys, 200 ms debounce, cancellation, staleTime, gcTime, retry and window-focus policies are unchanged. `TitleSearch.tsx` requires no change.

- `npm run verify`: zero diagnostics, all **24 unit tests**, production build and budget gate passed. The two new unit tests exercise real QueryObserver transfers and disabled-observer retention; the existing cache-capacity test now awaits asynchronous cleanup.
- Browser suite: **44 tests** across desktop and Pixel 7 emulation. Eight new cases cover fresh/full caches in both English and Persian. Each types `orbit` once, waits for suggestions, keeps it focused and unchanged for **5.1 seconds**, then checks exactly one orbit request. They also exercise pointer/keyboard state, parent rerenders, blur/refocus, Escape/reopen, another title, detail navigation and Back. Existing cancellation/stale-response, IME, offline/retry, genre/range/filter-history, prefetch and scroll-restoration checks remain included.
- `go test ./...` with local PostgreSQL integration and `go vet ./...` passed. sqlc 1.31.1 regeneration was byte-for-byte identical.
- `python3 -m unittest discover -s tests/ci -v`: all **14 Preview workflow/gate unit tests** passed. This executes mocked gate tests, not a deployment.
- All production JavaScript: **120,686 bytes gzip (117.9 KiB)** versus **120,657 bytes** on the freshly built base: **+29 bytes**, below 150 KiB. No dependency, API, schema or migration change.

Commands used the existing Playwright suite with an ignored cloud configuration selecting `/usr/bin/chromium` and absolute workspace paths. CI uses the standard `npm run test:e2e` command with its installed browser. This fix is submitted on a dedicated branch for review; it does not merge or dispatch a deployment. The existing protected Preview workflow remains governed by approved main merges and successful CI.
