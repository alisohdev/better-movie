# Discovery and title lookup API contract, synthetic revision 1

The catalog contains only owned synthetic movie records. PostgreSQL is authoritative for live API filtering. The source fixture at `catalog/movies.json` also supplies Astro's bounded prerendered baseline and detail pages. There is no runtime in-memory fallback if the database fails.

## Routes

- `GET /api/health` checks the actual database with a bounded deadline and returns `{ "status": "ok", "database": "connected", "catalogRevision": "synthetic-v1" }`. It returns 503 without database connectivity. Do not expose configuration values or errors containing credentials.
- `GET /api/movies` returns `{ "items": Movie[], "total": number, "page": number, "pageSize": 12, "catalogRevision": "synthetic-v1" }`.
- `GET /api/titles?q=...&v=1` returns a separate bounded title lookup (see below).
- `GET /api/movies/{id}` returns `{ "movie": Movie, "catalogRevision": "synthetic-v1" }` or 404.

Errors use `{ "error": { "code": string, "message": string } }`. Unknown filters, duplicate scalar keys, invalid ranges, genre conflicts, unknown genres, and unsupported values return 400. GET and HEAD are read-only. Other methods receive 405. Queries must be parameterized and canceled with the request context.

## Discovery query parameters

`genres` and `excludeGenres` are comma-separated stable genre slugs. `genreMode` is `any` by default, or `all`. A genre cannot occur in both lists. `yearMin`, `yearMax`, `runtimeMin`, and `runtimeMax` are inclusive integers. Years range from 1888 through 2100 and runtime from 1 through 600. Missing values cannot satisfy an active constraint. Exclusions reject any known matching tag, without claiming content safety.

`sort` is `popularity`, `rating`, `newest`, or `runtime`. Use descending popularity/rating/year, ascending runtime, nulls last, then stable ID ascending. `page` starts at 1 and is at most 10000. Page size is fixed at 12 and not client-controlled. Different groups combine with AND. `v=1` is accepted for versioned URLs. Title lookup remains separate from discovery; release filters are deferred. Advanced filters below extend the existing version 1 URL contract additively.

## Advanced discovery filters (Milestone 3)

- `languages`: comma-separated original-language codes, matching **any** selected language. Supported codes: `de,en,es,fa,fr,it,ja,ko,no,sv,tr`. These describe original language, never subtitles, dubbing or interface locale.
- `countries`: comma-separated production-country codes, matching **any** selected country (including co-productions). Supported codes: `AU,BE,CA,DE,ES,FR,GB,IR,IT,JP,KR,MX,NO,SE,TR,US`. These describe production, never filming location or streaming availability.
- `ratingMin`: inclusive minimum synthetic fictional score, from `0` through `10`. Plain unsigned decimal notation is accepted (for example `8.25`); signs, exponents, nonfinite values and empty values are rejected. The current scores are fictional, not real TMDB/IMDb ratings.
- `voteCountMin`: optional inclusive integer minimum from `0` through `2147483647`, matching the existing PostgreSQL integer column. It is independent of score and is never silently added. Omitting either numeric constraint leaves that field unconstrained; explicit zero excludes unknown values.

The code lists are a bounded supported vocabulary for this synthetic catalog, independent of current results and UI locale. Unsupported codes, repeated codes, duplicate parameters (even identical values), malformed numbers, unknown keys and raw query strings over 4096 bytes return 400 `invalid_filters`. Code casing is exact. Lists may not contain empty entries. Every group combines with AND, including the existing genre include/exclude and year/runtime constraints. Missing language, empty countries, null rating and null votes cannot satisfy their respective active constraint. There is no implicit catalog eligibility or popularity/vote floor.

Both `CountMovies` and `ListMovies` use the same parameterized predicates: original language via `= ANY`, countries via array overlap `&&`, and nullable inclusive numeric bounds. They share a repeatable-read snapshot, stable existing sorting and fixed 12-result pagination. No schema migration or index is added.

The UI sorts list codes canonically in `v=1` URLs, resets the page on committed filter edits and retains valid empty combinations. Advanced controls use progressive disclosure, bilingual names, removable chips, per-group clearing and full reset. Browser traversal restores filters; a locale switch preserves their stable codes. Title lookup continues to ignore discovery constraints and keeps its own cache family.

Example: `/en/discover/?v=1&languages=en,fa&countries=IR,US&ratingMin=7.8&voteCountMin=200`.

## Movie JSON shape

`id` is an immutable synthetic slug. `titleEn`, `originalTitle`, and `synopsisEn` are strings. `titleFa` and `synopsisFa` are strings or null. `year`, `runtime`, `rating`, and `voteCount` are numbers or null. `popularity` is a synthetic number. `genres` is an array of stable slugs. `originalLanguage` is a language code or null. `countries` is an array of country codes. `poster` is a root-relative local SVG path. `source` is exactly `Synthetic studio`. `synthetic` is true.

`releaseObservations` is an array with `eventType` (`theatrical`, `digital`, or `physical`), `date` (`YYYY-MM-DD` or null), `country`, `source`, `checkedAt` (ISO timestamp), and `verification` (`reported` or `confirmed`). All fixture observations are reported synthetic examples. No verified-file/provider availability fields exist.

Store canonical movie facts once in typed SQL columns, with genre membership in a join table and the bounded source-backed release observation array in JSONB. Build the wire document from those fields rather than keeping an independently editable JSON copy of scalar facts. The fixture is the owned import/build source, and PostgreSQL is authoritative for runtime results. No external provider ingestion is implemented.

## Consistency and cache behavior

Prerendered routes and API data must share `synthetic-v1`. Deployment instructions seed before activating the corresponding frontend. A future real mutable catalog needs a revisioned build/update policy before publication. API results may use a short public cache lifetime. Release observations always retain their checked time. Synthetic pages are noindex and make no current-world availability claims.

## Bilingual title lookup

`GET /api/titles?q=<title>` accepts exactly one `q`, plus optional `v=1`. Discovery filters and client-specified limits are rejected. A query is valid UTF-8, at most 120 Unicode code points before normalization. Unicode whitespace and ZWNJ are accepted; other control and format characters are rejected. Missing/duplicate `q`, unknown parameters, malformed encoding and oversized input return 400 `invalid_query`. Empty, whitespace-only and normalization-empty input return an empty `items` array, never the whole catalog. The general 4096-byte raw query-string bound also applies. GET and HEAD are supported; other methods return 405.

Success is `{ "items": TitleSuggestion[], "catalogRevision": "synthetic-v1" }`. Each suggestion contains only `id`, `titleEn`, nullable `titleFa`, `originalTitle`, and nullable `year`. At most six distinct films are returned. The interface uses its locale's title with English fallback, adds the original title when different, and displays the year or an explicit unknown-year label. Selecting a suggestion opens the existing localized static detail route. Translation fallback is tested with a simulated missing translation; all current fixture titles have Persian values.

PostgreSQL normalizes both the parameter and all three available title fields: Arabic ي/ك become Persian ی/ک; Arabic combining diacritics, tatweel, whitespace and zero-width separators are removed; ASCII English is lowercased under C collation. Compact keys make half-space, ordinary-space and joined spelling equivalent, including inconsistent spacing. Original values are never rewritten. This deliberately permits matches across word boundaries. It is literal substring lookup, with no token relevance, transliteration or typo correction.

Ranking is the best match across a film's available title fields: exact compact key, prefix, then other substring. Within each rank, immutable ID under C collation is the stable tie-breaker. Duplicate title fields cannot duplicate a suggestion. `strpos` uses a bound sqlc text parameter, so percent signs, underscores, quotes and SQL fragments are literal text, not wildcard patterns or SQL syntax.

Lookup uses the existing revision-checked, read-only snapshot and bounded acquire/query deadlines. Failures return sanitized 503 errors, without fixture fallback. HTTP responses use `Cache-Control: no-store` so intermediary caches do not retain search text. No raw query logging or analytics is added.
