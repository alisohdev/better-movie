# M5a offline catalog-audit verification

Verified 2026-10-19 against main `847eff1442e2bbfd409d4232f292692e12caf0e3` (merged M4). Node.js 24.19.0; prepared Go/sqlc tools from the managed environment. No live provider, credentials, production configuration or application data was used or changed.

| Check | Local result |
| --- | --- |
| `npm run verify` | PASS: Astro checks (0 errors/warnings), 67 frontend unit tests, 12 audit-tool tests, 67 static pages, useful-HTML and JS-budget gates. |
| `npm run test:audit` | PASS: 12 deterministic cases using self-authored responses. Covers frozen sample/hash, duplicate/remake mapping, groups/subset, provenance/retention, independent missing ratings/votes, exact threshold and group boundaries, Persian review, release country/type/date differences and schedules, seven-day check times, copied release evidence, corrections, expired retention and unsupported file claims. |
| `go test ./...` with `TEST_DATABASE_URL` unset | PASS; real PostgreSQL integration cases skipped as configured. This environment has no running local database, and none was started for this offline change. |
| `go vet ./...` | PASS. |
| `sqlc diff` | PASS; no SQL/generated binding changes. |
| `git diff --check` | PASS. |
| CLI `init`, then `report` using a temporary local file | PASS: 40 rows, 12 designated release checks, zero evaluated observations; identity/core/language-country/Persian `0/40`, release `0/12`, every criterion and recheck NOT VERIFIED. |

The audit tests are included in `npm run verify`, so the existing verification workflow executes them without a workflow change. PostgreSQL-backed Go/browser checks are delegated to the existing PR CI; their actual status is recorded in the PR rather than claimed in advance here. No local E2E run or new mobile-latency measurement was needed for these offline scripts/docs; application source, catalog, assets and SQL are unchanged.

All built JavaScript remains **124,340 bytes gzip**, matching the M4 main baseline (delta **0 bytes**); the offline kit is not imported into the app. Both locale routes still prerender twelve movie cards. No dependency or lockfile change was required.

Research refreshed current first-party public documentation. Direct TMDB legal-page retrieval was robots-blocked; its older indexed text is explicitly unverified as today's contract. The Wikidata structured-data CC0 statement was directly verified; linked media/prose and project-specific eligibility remain separate. See the [source gate](../product/data-source-feasibility.md), [inquiry](../product/provider-inquiry.md) and [reproducible runbook](../audit/README.md).

There are **no actual source coverage results** in this PR. No numerical test outcome clears data-provider rights. The next action is owner confirmation of operator/purpose and provider outreach; a private authorized audit and its seven-day repeat precede explicit M5b implementation approval. No merge or deployment is authorized by this verification note.
