# Frontend verification

Local implementation on October 18, 2026. No remote deployment, field-performance result, or Iranian-network result is claimed here.

## Completed local checks

- `npm install`: 415 packages added; npm reported zero vulnerabilities at installation.
- Minimal Astro production build: passed before expanding the vertical slice.
- Full `npm run build`: passed, generating 67 static routes: two discovery pages, 64 localized movie pages, and the root redirect.
- `npm run check`: passed with zero errors, warnings, or hints.
- `npm run test:unit`: 18 tests passed for full query round trips, invalid ranges, genre conflicts, duplicate/unknown URL values, and explicit clearing of ranges.
- Impeccable mechanical detector on `apps/web/src`: returned an empty findings array.
- An actual request to the local Go endpoint with included drama and runtime maximum 110 returned ten records conforming to the agreed shape. The application has no client catalog-filtering fallback.

Browser integration and screenshot verification are coordinated by the parent task. Record those actual results separately; the checks above do not establish browser navigation or deployed performance.

## Implementation evidence

The complete source fixture is imported only by `catalog.server.ts` and Astro frontmatter. Discovery serializes the first twelve movie records and the derived genre list. All 32 details are built independently per locale. `node apps/web/scripts/inspect-build.mjs` checks the server-rendered card bound and conservative total generated JavaScript gzip budget.

A browser-scoped TanStack Query client survives Astro navigation. Keys include catalog revision and the canonical URL filters. Freshness is 60 seconds, inactive expiry is five minutes, and inactive idle discovery results are additionally bounded to eight entries. Queries consume the request AbortSignal and identical canonical keys deduplicate through TanStack Query. Previous data stays labeled as previous until the current result arrives.

Card focus/hover queues actual Astro HTML prefetch after a short intent delay. Session storage bounds unique destinations to two; Save-Data, offline state, slow-2g/2g, and device memory at most 2 GiB skip speculation. Astro's helper returns no cancellation or completion handle. Queued work can be canceled; started work cannot. When a prefetch link exposes load/error events, the scheduler observes completion before starting another. On the unobservable WebKit fallback, it conservatively permits one start in that document.

Filter history uses deliberate control actions and explicit Apply ranges, so typing does not add history entries. Same-discovery Back/Forward is handled without an Astro document swap; movie/locale navigation remains Astro-owned. Detail return links preserve the last discovery URL and optional session scroll. Native full-page links remain valid without client routing.

## Limits

The default HTML is an immutable synthetic starting sample. A filtered direct visit labels it as such until the API response arrives. Static detail pages are the `synthetic-v1` snapshot and require a rebuild when the fixture changes. No service worker, offline freshness, availability inference, account, search provider, or AI feature is implemented.
