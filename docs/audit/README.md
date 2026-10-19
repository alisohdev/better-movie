# Offline 40-film audit kit

Milestone 5a, sample frozen **2026-10-19**, before any provider outcome was inspected. This is a readiness tool, **not an importer or a permission grant**. It reads local JSON and writes JSON to stdout using Node.js 24 built-ins. It has no network client, credential handling, database access or application dependency. No third-party observations are committed here.

Read the [source decision and gate](../product/data-source-feasibility.md) and [unsent provider inquiry](../product/provider-inquiry.md) first. Do not query providers or retain their metadata until the owner explicitly approves that access under confirmed applicable terms. Public title/year references below identify the sampling targets only; they do not authorize retention of other content.

## Frozen selection

[sample.json](sample.json) is the canonical manifest: forty distinct title/year targets, five groups of eight, and twelve fixed release-check flags. Each entry records a reason, ambiguity note and public identity lookup reference. Provider IDs, match results and release observations are deliberately absent. These are editorial targets, not verified provider records.

The sample is purposive, not random or representative. “Recent mainstream” is fixed to 2022–2024 broad-audience examples at this freeze. Other groups deliberately exercise older records, world cinema, Iranian cinema and independent/documentary coverage. Group membership is an exclusive editorial assignment, not a claim that film categories cannot overlap; Iranian-cinema grouping does not establish production-country values. No film occupies two slots. No audience requests were collected, and no provider-completeness ranking influenced selection.

| Group | Eight frozen title/year identities |
| --- | --- |
| Recent mainstream | Dune: Part Two (2024); Inside Out 2 (2024); Oppenheimer (2023); Barbie (2023); The Batman (2022); Top Gun: Maverick (2022); Avatar: The Way of Water (2022); Mission: Impossible – Dead Reckoning Part One (2023). |
| Older mainstream | Jurassic Park (1993); Titanic (1997); The Matrix (1999); Gladiator (2000); The Departed (2006); King Kong (2005); Planet of the Apes (1968); Dune (1984). |
| International | Parasite (2019); Drive My Car (2021); Another Round (2020); Anatomy of a Fall (2023); Perfect Days (2023); Pan’s Labyrinth (2006); Spirited Away (2001); Seven Samurai (1954). |
| Iranian | A Separation (2011); About Elly (2009); Taste of Cherry (1997); Close-Up (1990); Children of Heaven (1997); Taxi (2015); The Seed of the Sacred Fig (2024); It Was Just an Accident (2025). |
| Independent/documentary | Moonlight (2016); Lady Bird (2017); The Florida Project (2017); Aftersun (2022); Past Lives (2023); All the Beauty and the Bloodshed (2022); Fire of Love (2022); Honeyland (2019). |

The release subset is **all eight recent-mainstream films**, plus **Anatomy of a Fall, Perfect Days, The Seed of the Sacred Fig and It Was Just an Accident**. Do not replace a difficult or missing target with a well-populated one. Original film years can differ from local release or restoration years; the ambiguity notes guide matching. Resolve feature/docufiction classification rather than assuming a feature based on runtime.

Public title/year reference research was checked on 2026-10-19. Examples include official pages for [Inside Out 2](https://movies.disney.com/inside-out-2), [Oppenheimer](https://www.universalpicturesathome.com/movies/oppenheimer), [King Kong (2005)](https://www.universalpicturesathome.com/movies/king-kong-2005), [Planet of the Apes (1968)](https://www.20thcenturystudios.com/movies/planet-of-the-apes-1968), [Dune (1984)](https://www.universalpicturesathome.com/movies/dune), and NEON's pages for [Anatomy of a Fall](https://www.neonrated.com/film/anatomy-of-a-fall), [Perfect Days](https://www.neonrated.com/film/perfect-days), [The Seed of the Sacred Fig](https://www.neonrated.com/film/the-seed-of-the-sacred-fig) and [It Was Just an Accident](https://www.neonrated.com/film/it-was-just-an-accident). Other manifest links are public encyclopedia identity lookup aids. No synopsis, image, score or release date from these pages is copied into the sample or counted as an audit result. A reference URL is not a claim that its page was individually verified, nor that it grants reuse rights.

The manifest's semantic SHA-256 is `5b1757318405f276b46e2370e45184840ff65bad1199e48c5cfeb53b0e90e62c`. The template embeds it and reports reject another revision. The test pins it so editing titles, groups or release flags cannot silently change an audit. Corrections require a reviewed new sample revision before outcomes are inspected; do not rewrite a baseline after collection.

## Generate and validate the blank JSON template now

From the repository root, without credentials or a running app:

```sh
mkdir -p .local/catalog-audit
node scripts/catalog-audit.mjs init > .local/catalog-audit/day0.json
node scripts/catalog-audit.mjs report .local/catalog-audit/day0.json > .local/catalog-audit/day0-report.json
npm run test:audit
```

`init` is the JSON template generator; no application code needs editing. It produces forty rows in the fixed order, all observations unknown, without duplicating a large blank template in git. Its blank report must show `evaluatedRows: 0`, coverage counts `0/40`, release agreement `0/12`, and `NOT VERIFIED` criteria/recheck. That is validation of the kit, not a failed provider audit. Malformed input exits 1; valid input exits 0 even if a coverage criterion fails or is unverified. Read the report's statuses rather than treating exit 0 as clearance.

The JSON is intentionally plain and can be completed in a text/JSON editor. Keep real filled files, evidence, reports and screenshots private under an approved retention policy; `.local/` is ignored by git, but an ignore rule is not access control or storage permission. Never put a token, account password, raw API response, poster or synopsis into this repository or chat. Evidence URLs must be HTTPS without credentials, queries or fragments; put a query-free public movie/evidence page link in the row and keep permitted detailed request notes privately.

## How an authorized human conducts the audit

1. Obtain owner approval for **private audit access**, with a reference to the current applicable terms and provider confirmation, actual operator facts, permitted fields, retention deadlines and the scope of retained notes. The reference is not the agreement itself or a secret. If retention does not cover a seven-day repeat, resolve it before collecting data. A paid key or reachable endpoint does not satisfy this step.
2. Use your own approved account/credentials in your private provider tools. The CLI never uses them. Consult official documentation for [details](https://developer.themoviedb.org/reference/movie-details), [translations](https://developer.themoviedb.org/reference/movie-translations), [alternate titles](https://developer.themoviedb.org/reference/movie-alternative-titles) and [release events](https://developer.themoviedb.org/reference/movie-release-dates). Do not use a live Try It feature before approval. Audit the same forty targets; record missing or ambiguous identities instead of substituting films. For a Wikidata fallback use only the separately approved factual scope; do not pull linked media or upstream scores under assumed CC0 rights.
3. Set the top-level `provider` name and `permissionRecord` private reference. For each row fill the fields below. Preserve missing/unknown values. The reviewer—not this tool—determines factual correctness, usability, legal eligibility and the preferred Persian wording. Never generate a Persian synopsis to fill a gap.
4. Compare the twelve designated release rows against official studio/distributor or authorized-retailer evidence. A page that only says “now available” but supplies no qualifying event date cannot confirm country/type/date agreement. An old announcement does not prove an offer actually occurred; leave an unverifiable event unknown and explain it. Do not fetch images or publish metadata as part of this audit unless separately covered; recording that image rights are unresolved is sufficient.
5. Run `report` and review every criterion, group minimum, unknown, disagreement, rights state and file-claim check. Resolve identity conflicts and unsupported claims. Do not tune thresholds to the results. Any public synopsis/image/display decision remains subject to its own permission.

### Template field guide

| Field | How to fill it |
| --- | --- |
| `sampleId`, `group`, `releaseCheck` | Fixed. Forty rows exactly; no duplicates or missing IDs. Group and release assignment must match the manifest. |
| `sourceId`, `identity`, `identityNote`, `movieType` | ID within the named provider, or null if not established. Identity is `unknown`, `matched`, `mismatch` or `ambiguous`. A match needs a written title/year/remake check and an eligible `feature`, `documentary` or `animation` type. Series, shorts and adult/other types do not count. Duplicate source IDs are rejected for human resolution; do not fabricate another ID. |
| `fields` | Each named field is `unknown` (not checked), `missing` (checked and absent), `unusable` (present but unreliable/not appropriate) or `usable` (reviewer checked it). Fields are English/original/Persian titles, year, runtime, genres, original language, production countries, rating, votes, English/Persian synopsis and poster. No synopsis/poster body is stored in this audit. |
| `titleAlternatives` | Privately record only permitted alternate title strings; default `[]` means none recorded, not proof none exists. Their presence does not establish preferred Persian spelling. Explain aliases and conflicting years in `identityNote`/`uncertainty`. |
| `originalLanguage`, `productionCountries` | Actual checked original-language code and country-code array when their states are usable; otherwise null. Obtain the matching detail fields, not discovery's country-of-origin parameter or a festival/award nationality. The tool validates format, not ISO registry membership or factual truth. |
| `rating`, `voteCount` | Actual permitted score (0–10) and nonnegative vote count when usable; otherwise null. Zero is a real value, distinct from unknown. They are independent fields and have no implicit quality/vote floor. |
| `persianTitleReview` | `unknown`, `accepted` or `rejected`. Only an eligible match with a usable and reviewer-accepted Persian title counts toward 32/40. |
| `posterRights`, `posterRightsRecord` | `unknown`, `cleared` or `denied`. Cleared needs a usable poster and private evidence reference for that specific allowed use. A poster being present does not establish rights. Prefer placeholders. |
| `sourceUrl`, `checkedAt`, `retentionDeadline` | Evidence page, UTC timestamp such as `2026-10-19T09:00:00Z`, and approved expiry date `YYYY-MM-DD`. Any recorded observation requires these and the provider/permission reference. No default retention period is inferred from old terms. Expired rows are flagged; manage deletion/refresh according to the agreement. |
| `release.provider`, `release.official` | Only twelve designated rows have these. Each has `country`, `type` (`digital`/`physical`), `date`, `status`, `sourceUrl`, `checkedAt`. `observed` means the reviewer saw qualifying dated evidence **in that source**, not that the provider guarantees an actual release or file. `scheduled` is a dated future announcement. `missing` is a completed evidence search with no qualifying event (null tuple, source/check time retained). `unknown` stays entirely blank. Keep ambiguity or unsupported announcements in `uncertainty`, without making up an observed event. |
| `uncertainty` | Human explanation of missingness, conflicting dates, stale announcements, type ambiguity, corrections and evidence limits. Keep actual provider content out unless expressly permitted. |
| `unsupportedFileClaim` | `unknown`, `none` (reviewed, no unsupported assertion) or `present` (blocker to remove). Physical does not establish Blu-ray file availability; digital does not establish WEB-DL or accessibility in Iran. |
| `correctionMinutes` | Measured manual correction effort for this round. Null means not recorded; 0 means measured no correction work. Not a guess at future maintenance cost. |

A field's `usable` state alone never counts as a matched film. The tool counts core completeness only for eligible matches with a usable English **or** original title plus year/runtime/genres. Original-language/country coverage also requires eligible matches and both usable fields. All forty remain in every denominator. Per-field state totals are provided separately; those are reviewer reports, not independent verification of provider content.

## Thresholds and the seven-day repeat

The thresholds are fixed in the [source decision](../product/data-source-feasibility.md#fixed-40-film-audit-and-unchanged-decision-rules): 38/40 identities and no unresolved ambiguity; 36/40 core plus 6/8 each group; 36/40 original-language/country plus 6/8 each group; 32/40 accepted Persian titles; 10/12 release agreements and resolution of every disagreement. Failed Persian synopsis coverage keeps a permitted English fallback. Unsupported file assertions must be removed.

`PASS` means the numeric criterion is met, including its stated group/ambiguity check. `FAIL` means completed observations do not meet it. `NOT VERIFIED` means it is not met and unknown checks could still affect the outcome. A 10/12 release numeric PASS can still have two entries in `releaseDisagreements`; those block publication until resolved. Poster clearance, expired retention, unsupported claims, unknown file-claim checks and permission evidence are separate report fields. The report always says `ingestionAuthorization: NOT GRANTED BY THIS TOOL`.

After collecting the first round, preserve only the permitted private evidence. Generate a fresh second template, or privately copy the baseline as a checklist **without treating copied values/check times as new observations**. Revisit all forty films and twelve release comparisons at least seven days after their individual first checks. Record new check times even when unchanged, measured correction minutes, and disappearance or changes in `uncertainty`.

```sh
node scripts/catalog-audit.mjs init > .local/catalog-audit/day7.json
# Authorized reviewer completes day7.json after actually repeating the checks.
node scripts/catalog-audit.mjs report .local/catalog-audit/day7.json .local/catalog-audit/day0.json > .local/catalog-audit/day7-report.json
```

The second argument is the **baseline**, not the other way around. Providers/sample revisions must match. Each row and each designated source release check must be at least seven days newer; fields, rights/review and file-claim checks must be completed, and correction minutes recorded. The report lists changed observable fields/IDs, changed release dates, disappearing official offers and total correction minutes. It cannot detect unseen changes to synopsis text or verify a reviewer actually visited a source; record such permitted human findings separately. Unknown baseline or repeat observations cannot pass the recheck.

The next step is owner review of permissions, coverage and editorial cost, followed by **explicit M5b approval**. This kit never enables an import, writes to Neon/Vercel, changes the protected Preview, or publishes the privately collected data.
