# M5b verification and review notes

Date: 2026-10-19. Based on main `cc7ef7858b555ee6f458554d5c0a868886faed3f`. No live provider request, credential, actual provider payload, deployed database operation or Vercel configuration change was used.

Local verification:

- `go test ./...`: PASS with `TEST_DATABASE_URL` unset. Database integration tests are present but skipped locally; no local PostgreSQL service was running. New in-process HTTP mocks test mappings/identity, nullable fields, preserved original/aliases, Persian conflict/fallback, rights exclusions, fixed origin/header, body bound, access-denial/redirect stop, 429/5xx backoff and Retry-After, cancellation, secret/body/transport redaction, 40-film bounds, partial/resume and no-request reruns.
- `go vet ./...`, `sqlc generate` followed by `sqlc diff`, and `git diff --check`: PASS. Generated query bindings are committed. Migration 000002 is exercised only in disposable tests/new staging schemas; the deployed synthetic API does not require it.
- `npm run verify`: PASS: one native Node build-gate test; Astro checks with no diagnostics; 69 frontend tests; 12 audit-tool tests; default synthetic production build and useful-HTML/JS gates.
- Credential-free self-authored TMDB-mode build: PASS using `TMDB_TEST_FIXTURE=1 TMDB_TEST_NO_DATABASE=1 go run ./tests/tmdb`, then `CATALOG_FILE=.local/tmdb-test-artifact.json npm run build`. This generates only test metadata, not measured provider records. Thirteen records yield 31 static pages and twelve first-page cards in each locale. Default mode yields 69 pages (the existing 67 plus two Credits pages).
- All built JS gzip: synthetic **125,266 bytes**, versus M5a main **124,340** (+926 bytes, about 0.75%); test TMDB mode **125,343 bytes**. Both stay below 150 KiB. No npm module/version was added; existing x/text is now classified direct because title matching uses its existing normalization code. No claim about real TMDB latency, field quality, Iranian network access or deployed performance is made.
- React review: source/missing-state branches add no hooks, new fetch waterfalls, listeners or cache lifecycle. Existing keyboard/touch controls and navigation stay in place; query keys and response/header checks bind the build revision. Scores, placeholders and attribution have locale-aware labels; blank Persian titles fall back safely.

The PR CI runs real PostgreSQL integration and the existing default desktop/mobile suite, followed by a separately built TMDB-mode desktop/mobile English/Persian suite. Its test-only generator stages self-authored records in an isolated schema; no token is configured and no provider network is required. CI status/results are recorded in the PR rather than asserted in advance here.

Review-critical invariants:

1. A private checkpoint cannot publish an incomplete selection. Content/sample hashes, fixed sample identities and unexpired projection validation precede staging/building.
2. Staging schema creation, migrations, rows, extras, revision and readiness commit together; completed revisions are immutable. Existing synthetic tables are preserved. Integration tests verify no duplication, source/provenance/alias reads, mismatch/expiry refusal and rollback to 32 original films. A legacy-schema test drops staging-only tables and still exercises original health/search/title/detail queries.
3. Static HTML and compiled browser code share one revision; API reads verify the same revision/schema and readiness. Wrong/missing real-mode revision headers fail closed, and browser response validators reject another revision/source. Cache families include the revision; real responses are no-store.
4. Source prose, poster files and release observations are excluded. The HTTP adapter is not linked into the public API handler: `go list -deps ./api` includes neither `internal/tmdb` nor `docs/audit`. The public runtime cannot initiate a TMDB request.
5. Public real mode requires separate approval and an operator-supplied approved logo. Existing protected Preview remains synthetic with its current variables/database. The normal Preview deploy workflow performs no migration or seed.

Remaining risks: live account/territory eligibility and current agreement are NOT VERIFIED; private storage/retention, media/prose, future commercialization/AI conditions, actual coverage and access remain operator decisions/evidence. Static HTML/backups do not expire themselves: publication requires an enforceable refresh/removal procedure. Switching incompatible app/runtime revisions briefly produces an error rather than mixing data; this is not a distributed hosting transaction. Manually reviewed IDs/titles/year remain essential, and a source year discrepancy rejects the row rather than guessing.

Use the [activation and rollback runbook](../engineering/tmdb-staging.md). No real-catalog publication is implied by passing tests, merging this code, or verifying the protected synthetic Preview.
