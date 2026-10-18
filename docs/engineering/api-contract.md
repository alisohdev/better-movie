# Discovery API contract, synthetic revision 1

The catalog contains only owned synthetic movie records. PostgreSQL is authoritative for live API filtering. The source fixture at `catalog/movies.json` also supplies Astro's bounded prerendered baseline and detail pages. There is no runtime in-memory fallback if the database fails.

## Routes

- `GET /api/health` checks the actual database with a bounded deadline and returns `{ "status": "ok", "database": "connected", "catalogRevision": "synthetic-v1" }`. It returns 503 without database connectivity. Do not expose configuration values or errors containing credentials.
- `GET /api/movies` returns `{ "items": Movie[], "total": number, "page": number, "pageSize": 12, "catalogRevision": "synthetic-v1" }`.
- `GET /api/movies/{id}` returns `{ "movie": Movie, "catalogRevision": "synthetic-v1" }` or 404.

Errors use `{ "error": { "code": string, "message": string } }`. Unknown filters, duplicate scalar keys, invalid ranges, genre conflicts, unknown genres, and unsupported values return 400. GET and HEAD are read-only. Other methods receive 405. Queries must be parameterized and canceled with the request context.

## First-slice query parameters

`genres` and `excludeGenres` are comma-separated stable genre slugs. `genreMode` is `any` by default, or `all`. A genre cannot occur in both lists. `yearMin`, `yearMax`, `runtimeMin`, and `runtimeMax` are inclusive integers. Years range from 1888 through 2100 and runtime from 1 through 600. Missing values cannot satisfy an active constraint. Exclusions reject any known matching tag, without claiming content safety.

`sort` is `popularity`, `rating`, `newest`, or `runtime`. Use descending popularity/rating/year, ascending runtime, nulls last, then stable ID ascending. `page` starts at 1 and is at most 10000. Page size is fixed at 12 and not client-controlled. Different groups combine with AND. `v=1` is accepted for versioned URLs. No title, country, language, release, or score-threshold filter is exposed in this first slice. These are later increments.

## Movie JSON shape

`id` is an immutable synthetic slug. `titleEn`, `originalTitle`, and `synopsisEn` are strings. `titleFa` and `synopsisFa` are strings or null. `year`, `runtime`, `rating`, and `voteCount` are numbers or null. `popularity` is a synthetic number. `genres` is an array of stable slugs. `originalLanguage` is a language code or null. `countries` is an array of country codes. `poster` is a root-relative local SVG path. `source` is exactly `Synthetic studio`. `synthetic` is true.

`releaseObservations` is an array with `eventType` (`theatrical`, `digital`, or `physical`), `date` (`YYYY-MM-DD` or null), `country`, `source`, `checkedAt` (ISO timestamp), and `verification` (`reported` or `confirmed`). All fixture observations are reported synthetic examples. No verified-file/provider availability fields exist.

Store canonical movie facts once in typed SQL columns, with genre membership in a join table and the bounded source-backed release observation array in JSONB. Build the wire document from those fields rather than keeping an independently editable JSON copy of scalar facts. The fixture is the owned import/build source, and PostgreSQL is authoritative for runtime results. No external provider ingestion is implemented.

## Consistency and cache behavior

Prerendered routes and API data must share `synthetic-v1`. Deployment instructions seed before activating the corresponding frontend. A future real mutable catalog needs a revisioned build/update policy before publication. API results may use a short public cache lifetime. Release observations always retain their checked time. Synthetic pages are noindex and make no current-world availability claims.
