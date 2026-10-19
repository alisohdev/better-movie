# M5b: bounded TMDB import, private staging, activation and rollback

Decision/verification date: 2026-10-19. The owner selected TMDB and declares a free, noncommercial project operated by an individual in Iran. **Engineering and synthetic-response testing are authorized now, without waiting for the provider inquiry.** That declaration does not establish account eligibility, the governing agreement, storage/refresh/removal rights, poster/prose rights, Iranian connectivity or publication permission. Those remain NOT VERIFIED. The [M5a findings](../product/data-source-feasibility.md) and [unsent inquiry](../product/provider-inquiry.md) remain available; the earlier requirement to wait before implementation is superseded by Issue #12.

This code never changes the existing deployed Neon database or Vercel settings. Default builds/runtime still use the original 32 owned films. No live TMDB call or actual credential was used in development. All new tests use self-authored TMDB-shaped responses; none establishes provider coverage.

## Implemented boundary

- A Go standard-library client requests only `https://api.themoviedb.org/3/movie/{manual-id}?language=en-US&append_to_response=translations,alternative_titles`, using an environment-only `TMDB_READ_ACCESS_TOKEN` Bearer header. There is no search crawl, configurable mirror/origin, query-string key or redirect following. Request timeout is 10 seconds, response bound 2 MiB, concurrency one, and spacing 250 ms. Each selected ID gets at most three attempts. 429/5xx honor Retry-After (seconds or HTTP date), otherwise use 1/2-second backoff. A wait over 30 seconds stops the run for later resume; 401/403, redirects, transport errors and exhausted retries stop it. Provider bodies, transport errors, tokens and response text are not logged.
- The mapping is an explicit subset of 1–40 frozen sample IDs, with unique positive TMDB IDs, manually reviewed matching titles and a review flag. Title/year mismatch, absent source year, conflicting Persian translations, adult/video records or unsupported genre IDs reject the row. Matching uses the supplied reviewed title against source titles/aliases and the frozen year. A legitimately reviewed alternate title may be supplied for renamed/localized films; it is the operator's responsibility to ensure it identifies the same frozen film, not substitute a different film. No fuzzy matching or automatic year correction occurs.
- Domain projections preserve original titles, sourced English/Persian titles and at most 32 aliases, runtime, original language, actual production countries, a labeled score/vote count and record provenance. Blank Persian values become null; absent English uses the original title. Missing runtime/score/votes/language remain null; explicit zero votes remain zero. Missing popularity uses zero only as a deterministic sort fallback, not a measured popularity claim. Unknown genre IDs reject instead of inventing a taxonomy. Standard broad genres are supported; TV Movie is rejected. The additional bounded language/country filter choices appear only in TMDB mode; the v=1 grammar and 12/page semantics are preserved.
- Prose, provider images and release-event import are hard-disabled in this slice, even if returned by details/translations: they are discarded, never copied to a checkpoint. All images use the owned `/posters/placeholder.svg`. Runtime can vary by edition; the source year is identity evidence, not availability. No digital, physical, WEB-DL, Blu-ray-file or Iranian-service badge is inferred. Optional prose/image rights require separate implementation/review, not an undocumented flag.
- Checkpoints contain only the permitted compact projection and stable outcome codes, never raw provider payloads. Every completed/error row is checkpointed atomically with mode 0600. Partial runs exit nonzero and cannot produce a new completed artifact. An unchanged checkpoint/mapping rerun reuses completed rows without new requests. Changed mappings, expired records or changed retention deadlines require an explicit fresh run. SIGINT/SIGTERM cancel HTTP/backoff; resume uses the same private checkpoint.

Official documentation accessed 2026-10-19: [application authentication](https://developer.themoviedb.org/docs/authentication-application), [rate limits](https://developer.themoviedb.org/docs/rate-limiting), [append-to-response](https://developer.themoviedb.org/docs/append-to-response), [movie details](https://developer.themoviedb.org/reference/movie-details), [translations](https://developer.themoviedb.org/reference/movie-translations), [FAQ/attribution](https://developer.themoviedb.org/docs/faq). Reading documentation did not invoke Try It or a movie API. The official logo page was robots-blocked here; no logo or poster was fetched or recreated.

## 1. Eligible account, privately configured token and permissions

The authorized operator must obtain an **API Read Access Token** from their own eligible TMDB account, through its API settings, and review/accept the applicable current terms. Follow the [official authentication instructions](https://developer.themoviedb.org/docs/authentication-application). Do not use another person's identity, a mirror, a geographic bypass, scraping or an unauthorized key. If eligibility/access is denied, stop. The deferred inquiry is not a prerequisite to write/test code, and the importer cannot certify the legal sufficiency of the holder's accepted terms.

Before any real request, establish whether those terms cover the intended **private** audit/projection retention. Privately record the accepted version/date, any provider clarification, allowed fields and refresh/removal duties. Set an evidence reference and actual permitted expiry below; no six-month or permanent-storage right is assumed. The access flag is an explicit operator acknowledgement, not a rights determination. Public publication requires a separate owner decision.

The following commands are for the operator's private terminal, not for Codex to execute against TMDB. Never paste credentials, provider responses or real projections into chat, git, screenshots, logs or CI artifacts. The ordinary runtime and all tests require no TMDB credential.

```sh
# Bash, at repository root. Disable shell tracing; do not put a token on a command line.
set +x
umask 077
mkdir -p .local/tmdb/run-01
go run ./cmd/tmdb mapping > .local/tmdb/run-01/mapping.json
```

Edit that private JSON: supply each selected `tmdbId`, confirm `matchTitle`, set `reviewed: true`, and retain only the explicitly selected subset. The full generated template has forty rows with unset IDs/review flags and cannot run until reviewed. Find IDs manually in the eligible account/provider interface. Check title, original identity and year against the frozen target, especially remakes and renamed releases; do not substitute a better-populated film. The CLI never guesses an ID.

```sh
# Read silently into the environment; do not echo or share the value.
read -r -s -p 'TMDB API Read Access Token: ' TMDB_READ_ACCESS_TOKEN
export TMDB_READ_ACCESS_TOKEN
export TMDB_ACCESS_APPROVED=1
export TMDB_TERMS_REFERENCE='YOUR_PRIVATE_ACCEPTED_TERMS_REFERENCE'
export TMDB_RETAIN_UNTIL='YYYY-MM-DD' # replace with the actual permitted deadline

go run ./cmd/tmdb import \
  --mapping .local/tmdb/run-01/mapping.json \
  --checkpoint .local/tmdb/run-01/checkpoint.json \
  --out .local/tmdb/run-01/catalog.json --limit 5
```

A limit of five intentionally returns an incomplete/nonzero result if more than five IDs are selected. Repeating the same command attempts the next incomplete rows, including rejected rows that need resolution. Use `--limit 40` for all remaining selected rows; total selection never exceeds forty. The per-run summary exposes counts and `artifactReady`, not movie content. Use a fresh output directory for a refreshed catalog so an old complete artifact cannot be mistaken for this run's output.

```sh
# Safe structural status report; no title/prose/provider response dump.
go run ./cmd/tmdb report --checkpoint .local/tmdb/run-01/checkpoint.json
# Inspect identity_or_metadata_rejected and access/retry codes privately.
# On access_denied, resolve legitimate account/terms eligibility rather than retrying through another origin.
# For a revised mapping or retention policy, start a fresh explicit run/checkpoint after resolving the cause.
unset TMDB_READ_ACCESS_TOKEN TMDB_ACCESS_APPROVED
```

A failed or partial run is not a smaller accepted catalog. To choose a smaller subset, explicitly review a new mapping/run; do not edit success/error codes to bypass validation. Records and the snapshot must meet the actual agreed retention policy. `.local/` is ignored by git, not an access-control or licensing mechanism. Do not back up, share or retain it beyond those permissions.

## 2. Isolated PostgreSQL staging and migration plan

Use a **dedicated local or staging database**, never the current protected Preview database. Configure `TMDB_STAGING_DATABASE_URL` privately, with verified TLS remotely or explicit plaintext on loopback under the existing database policy. Do not use a PUBLIC-prefixed variable or paste a URL containing credentials into chat. Obtain/configure this URL through the operator's normal private process; no database credential is needed to develop the code.

```sh
# TMDB_STAGING_DATABASE_URL must already identify the dedicated disposable/staging database.
go run ./cmd/tmdb stage --artifact .local/tmdb/run-01/catalog.json --isolated-database
```

The artifact includes the frozen manifest hash and the exact serialized projection. Its revision is `tmdb-<SHA256 of projection bytes>`; aliases/provenance/timestamps/retention participate in the hash. A fully validated artifact creates `tmdb_<first 40 hash characters>`, sets a transaction-local search path to that schema only, applies migrations there, writes all rows/genres/extras and a readiness manifest, then commits once. A failure rolls back schema creation and rows together. The complete existing schema is immutable; an exact rerun is a readiness-checked no-op, not an upsert into the active synthetic snapshot.

Migration `000002_staging.sql` permits a paired TMDB/non-synthetic source and adds extras/readiness tables. **The existing deployed synthetic schema does not need this migration.** Its queries never reference the new tables. Do not run `cmd/catalog migrate` or `seed` against the protected Preview to activate this work. No table in the original schema is deleted, replaced or renamed by `tmdb stage`.

## 3. Build and verify one matching private revision

```sh
export CATALOG_FILE=.local/tmdb/run-01/catalog.json
export CATALOG_REVISION="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.env.CATALOG_FILE,"utf8")).catalogRevision')"
npm run build
# Terminal A, with the same CATALOG_REVISION and TMDB_STAGING_DATABASE_URL:
go run ./cmd/server
# Terminal B, with the same CATALOG_FILE (for configuration) and revision:
npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock
```

The real-data server binds loopback unless publication has been explicitly acknowledged. Astro reads the private artifact only in server-side build code; it compiles the revision into browser code and prerenders all details from that snapshot. API reads use the matching immutable schema in a repeatable-read transaction and verify revision, row counts and retention. Browser requests include `X-Catalog-Revision`; wrong/missing headers in real mode fail with 409. Browser response validation and query-cache families also bind the revision. A file changed between build stages, an incomplete import, stale schema or revision mismatch fails closed. Existing UI filter/history/locale behavior is retained.

This is a **revision-pinned activation contract**, not a distributed transaction across a hosting provider: selecting incompatible static/runtime versions yields an unavailable/error state, never a mixed catalog. Use one verified artifact/revision in a single deployment/configuration change only after separate publication approval. Do not change a global DB pointer ahead of the static build.

```sh
curl --fail --silent http://127.0.0.1:8080/api/health
curl --fail --silent -H "X-Catalog-Revision: $CATALOG_REVISION" \
  'http://127.0.0.1:4321/api/movies?v=1' | \
  node -e 'let x="";process.stdin.on("data",d=>x+=d);process.stdin.on("end",()=>{const r=JSON.parse(x);console.log({revision:r.catalogRevision,total:r.total,pageSize:r.pageSize})})'
# Verify both locale pages' <meta name="catalog-revision"> matches health.
```

Privately check `/en/discover/` and `/fa/discover/`: matching titles/year, Persian fallback, source-labeled scores and unknown fields, owned placeholder, 12/page, aliases, filter URLs, sorting, Back/Forward/scroll, locale switching, details and Credits. No credential goes into the frontend. A mismatch must show recovery/error rather than silently serving another source.

## 4. Attribution and publication gate

TMDB-mode Credits includes the exact required English nonendorsement notice, a Persian explanation, source links, source-labeled community scores and the owned-art explanation. Before publication, obtain an **approved unmodified logo** through TMDB's official branding channel; do not draw a substitute or assume attribution clears poster/prose rights. Configure its private file path as `TMDB_APPROVED_LOGO`; the build copies it to an ignored generated `tmdb-logo.svg` and renders it smaller than the Frame mark, preserving its aspect ratio. No logo is fetched by the application.

Real-data builds/runtime on Vercel are blocked unless `TMDB_PUBLICATION_APPROVED=1`; builds also require an approved-logo input. This flag is an owner acknowledgement, not proof of licensing. Keep all real-data variables unset in the current protected Preview. A publication review must resolve the applicable eligibility/terms/retention/attribution decisions and include permitted coverage observations; this PR does not authorize that rollout or change Vercel/Neon configuration. No AI or LLM processing of actual provider payloads is authorized by this pipeline.

**Retention limitation:** API readiness and new builds refuse expired artifacts, but already generated static HTML and operator backups cannot delete themselves. Arrange refresh/removal of static pages, previous deployments, private checkpoints and backups before the agreed deadline, including on termination/takedown. Do not publish if those obligations cannot be met. This slice adds no background scheduler or automatic public deletion service.

## 5. Rollback, refresh and removal

Keep the original owned fixture and original database/schema intact. To return to the synthetic catalog:

```sh
# Stop only the local staging processes you started.
unset CATALOG_FILE CATALOG_REVISION TMDB_APPROVED_LOGO TMDB_PUBLICATION_APPROVED
unset TMDB_STAGING_DATABASE_URL TMDB_READ_ACCESS_TOKEN TMDB_ACCESS_APPROVED
npm run build
# Restart cmd/server with the original private DATABASE_URL and the default preview command.
```

No reseed, deletion or destructive migration is needed. A prior unexpired real revision can similarly be selected by its own artifact plus matching runtime revision/schema; do not overwrite it with different rows. A refresh uses a new private run/checkpoint, a newly hashed artifact and new immutable schema. Verify it before switching; retain/delete old artifacts, schemas and static output only as allowed by the accepted contract. To remove an expired staging schema, disconnect its runtime and use the dedicated staging database's ordinary administration to drop only the exact schema printed by `stage`, after checking it is not the current revision. There is no bulk schema deletion or production-cleanup command in this tool.

## 6. Reproducible verification without a credential

```sh
npm run verify
# With the prepared Go/sqlc tools:
go test ./...
go vet ./...
sqlc diff
# Set TEST_DATABASE_URL to a disposable local PostgreSQL database to execute integration tests.
```

Go tests use in-process self-authored transports: header/origin restrictions, payload bounds, nulls, identity/remake rejection, alias/Persian handling, 429/5xx retry/Retry-After, cancellation, token/body/transport redaction, 40-ID bounds, partial checkpoints, exact resume and immutable artifact hashes. PostgreSQL tests stage/lookup/read real-mode **self-authored** projections, check reruns, incomplete/expired/mismatched revisions and rollback to the untouched 32-film snapshot. A legacy-schema test removes staging-only tables and proves original health/search/title/detail queries still work.

The existing CI first runs the default tests/build/browser suite, then generates thirteen self-authored test records in `.local/`, stages them only in its ephemeral PostgreSQL service, builds TMDB mode and runs desktop/mobile English/Persian staging tests. It makes no TMDB request, needs no token and uploads no real-data artifacts. `tests/tmdb` is a test-only generator guarded by `TMDB_TEST_FIXTURE=1`, not a live-import substitute. An offline test build can additionally use `TMDB_TEST_NO_DATABASE=1`; it proves rendering only, not SQL readiness.

Before a real catalog is activated: legitimate holder access and accepted-term compliance; approved private retention; manually validated IDs and completed bounded import; isolated staging; matching build/API checks in both languages; owner review of real coverage/uncertainty; approved attribution/asset plan; explicit public-publication approval and operational removal plan. This task stops at the PR. The owner/ChatGPT reviews and merges, then verifies the existing protected **synthetic** Preview; Codex does not merge or deploy.
