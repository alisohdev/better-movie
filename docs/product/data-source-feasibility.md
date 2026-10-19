# Real-catalog feasibility and permission gate

Reviewed **2026-10-19** for Milestone 5a. This supersedes the October 18 research note; the fixed audit thresholds below are unchanged. **No provider eligibility or film coverage has been verified. M5a is not clearance for M5b.** No authenticated API requests, metadata imports, poster downloads, scraping, account registrations or outreach occurred. The app still uses 32 owned fictional films.

Better Movie proposes a $0 validation pilot without ads or affiliate links, serving movie enthusiasts in Iran through Persian RTL and English LTR interfaces. The actual operator, jurisdiction, contracting entity and future business purpose require the owner's confirmation. Neither the audience's language nor this chat's timezone establishes those facts. See [PRODUCT.md](../../PRODUCT.md) and the [MVP brief](mvp.md).

## Verified documentation, with freshness limits

All access dates in this register are **2026-10-19**. “Verified” means the stated documentation was accessible; it does not mean this project's intended use has been approved. No movie API was called using a documentation example or Try It control.

| Official source | Retrieval and supported finding |
| --- | --- |
| [TMDB FAQ](https://developer.themoviedb.org/docs/faq) | Directly retrieved. Describes free noncommercial API use with attribution, defines commercial purpose by revenue intent, and directs commercial projects to sales. Requires approved branding and a nonendorsement notice in About/Credits. Disclaims ownership of supplied content and an SLA. |
| [TMDB API terms](https://www.themoviedb.org/api-terms-of-use?language=en-CA) | Direct legal-page retrieval was blocked by robots. Official indexed text still identifies an October 20, 2023 update and a roughly 1.3-year-old crawl. It describes a six-month cache ceiling, purge on termination, written commercial agreement and a broad prohibition involving ML/AI applications. **This is historical indexed evidence, not verification of the current accepted contract.** |
| [Movie details](https://developer.themoviedb.org/reference/movie-details), [translations](https://developer.themoviedb.org/reference/movie-translations), [alternative titles](https://developer.themoviedb.org/reference/movie-alternative-titles) | Directly retrieved API documentation. Details, translations and country-filterable alternate titles are distinct resources. Endpoint existence does not establish Persian coverage or reuse permission. |
| [Release dates](https://developer.themoviedb.org/reference/movie-release-dates) | Directly retrieved. Digital is type 4; physical is type 5. The event vocabulary supplies no verified downloadable-file claim. |
| [Image basics](https://developer.themoviedb.org/docs/image-basics) | Directly retrieved. Documents constructing image URLs; a technical URL recipe is not an image license. No images were fetched. |
| [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) | Directly retrieved. Structured data in its specified data namespaces is CC0. Other namespace text has different licensing. This distinction matters for prose copied from project pages or linked sites. |
| [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access) | Directly retrieved. Describes public access methods and access practices. Structured-data attribution is appreciated rather than required under CC0. Endpoint operation/limits and coverage remain separate questions. |
| [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) | Directly retrieved. Individual media files can have different attribution and license requirements. A Wikidata image link does not transfer the structured-data license to the image. |

### Reconciling TMDB's FAQ and indexed terms

The FAQ's general noncommercial offer does not establish this operator's classification or override the applicable agreement. A free key, a free app, and attribution are each insufficient evidence of complete permission. The older restrictions must remain open questions until the owner obtains the current agreement and project-specific clarification. Do not implement a six-month cache merely because the old index mentions that ceiling; an applicable contract may require a shorter period, refresh or removal.

The preferred candidate remains **TMDB, CONDITIONAL**. The fallback is **Wikidata structured facts, GO for its documented CC0 copyright permission only**, with product suitability and operator/access review still CONDITIONAL. A fallback would be a smaller factual catalog, potentially without ratings, posters, synopses or reliable release observations. Switching providers requires an owner decision; it is not automatic authorization to ingest.

## Field-level comparison and recommendation

These are capability/rights distinctions, not measured coverage. All 40 provider matches and all twelve release comparisons remain NOT VERIFIED.

| Field class | TMDB candidate | Wikidata fallback | Recommendation |
| --- | --- | --- | --- |
| Identity, year, runtime, broad genres, original language, production countries | Candidate detail fields under the applicable API agreement; public documentation is not a blanket reuse grant. | CC0 structured statements where present, with references and conflicting statements requiring review. | Audit identity first. Preserve source IDs and provenance; do not infer feature status from runtime or production countries from audience region. |
| Persian/English titles and aliases | Translation and alternate-title resources need separate coverage and permitted-use review. A country-tagged alias is not automatically a preferred Persian title. | Structured labels/aliases fall within CC0 data scope; presence and preferred spelling are unmeasured. | Require bilingual review. Missing Persian text is a coverage gap, not evidence the film is absent. |
| Synopses and translations of prose | Copyrighted expression may carry conditions or third-party rights not settled here. | Do not treat linked Wikipedia articles, external descriptions or other-namespace prose as CC0 structured facts. | Do not copy, translate with an LLM, or publish prose without its own permission. Retain a visible permitted English fallback if Persian coverage fails. |
| Community ratings and vote counts | Use a clearly labeled TMDB score only if licensed; fields and counts require a coverage check. | No assumed equivalent score service; external rating links do not license the upstream rating database. | Record scores/votes independently. Unknown is not zero; never add an implicit vote floor. IMDb, Letterboxd and OMDb ratings remain outside this increment. |
| Posters | Technical image access does not settle poster copyright, CDN use, resizing, storage or removal. | Each linked Commons/external file needs an individual license review. | Prefer owned placeholders until the specific asset rights and display conditions are documented. |
| Country/type/date release evidence | Documented event types do not prove an event occurred, a file exists, or Iranian access. | Structured dates/qualifiers may be incomplete or refer to another event; verify meaning and reference. | Compare twelve fixed films with official studio/distributor or authorized-retailer evidence, recording territory and uncertainty. |

The only selected future provider sites remain Zarfilm, Avamovie, 30nama and Digimovie. Filimo and Namava are excluded. No provider offers, scraping, JustWatch integration, subgenre taxonomy, AI recommendation or external rating dependency is introduced. None of these deferred sources supplies permission for this PR.

## Explicit decision gate

**GO** means documented prerequisites for that specific use are satisfied; **CONDITIONAL** means an unresolved fact blocks that use; **NO-GO** means a denial, incompatible obligation or unsupported claim prevents proceeding. Unknown permission is not a legal finding of prohibition, but it does block this project's real-data work.

| Gate | Current evidence / status | Required before GO; NO-GO condition |
| --- | --- | --- |
| Operator jurisdiction and entity | NOT VERIFIED / CONDITIONAL | Owner supplies the actual operator/entity, residence and contracting/hosting facts; appropriate provider/legal confirmation covers those facts. NO-GO on an applicable restriction or refusal. No sanctions-law certainty is asserted here. |
| Commercial classification and $0 pilot | NOT VERIFIED / CONDITIONAL | Owner states actual purpose including future monetization; provider confirms the applicable classification and free permitted scope. If required licensing costs exceed the approved $0 budget, NO-GO until an explicit budget/scope decision. |
| Projection, storage/cache, refresh, removal | Current accepted agreement NOT VERIFIED / CONDITIONAL | Written evidence covers the searchable local projection, aliases/normalization, static HTML, backups, retained audit snapshots and aggregate reports. Record retention deadlines, refresh duties and removal/termination procedure. NO-GO if required storage or removal obligations cannot be met. |
| Posters and prose | Specific rights NOT VERIFIED / CONDITIONAL | Identify permitted display, transformations, hosting/CDN and asset-specific conditions. NO-GO for unlicensed assets; a placeholder-only scope may proceed separately if approved. |
| Iranian operator/audience/access | NOT VERIFIED / CONDITIONAL | Confirm operator eligibility, audience territory permissions, `IR` data coverage and actual target-network access separately. A country parameter or successful request proves neither eligibility nor legal access. NO-GO on a verified applicable restriction. |
| API credentials | Not requested or used / CONDITIONAL for live access | Only the owner/authorized human obtains credentials under accepted terms and approves private audit use. Keep them out of git, audit files, screenshots and chat. A working key is technical access, not clearance. No key is required for this offline kit. |
| Attribution | General TMDB instructions verified; implementation deferred / CONDITIONAL | Agree approved logo, notice placement, source labeling and bilingual wording before displaying permitted content. Attribution alone never clears other gates. Wikidata CC0 facts do not require attribution, but provenance is recommended. |
| AI / LLM connection | Historical broad API restriction; applicability NOT VERIFIED / CONDITIONAL | Ask about deterministic apps built with AI-assisted coding as well as metadata sent to LLMs, embeddings, training, recommendations and natural-language filters. Keep actual provider payloads out of AI tools until explicitly covered. NO-GO for an incompatible AI use; no AI feature is needed for the pilot. |
| Coverage and operational effort | NOT VERIFIED / CONDITIONAL | Complete the frozen audit and seven-day repeat; review the thresholds, disagreements and correction effort below. NO-GO for unsupported available-file assertions. Reduce scope explicitly when coverage fails. |

**Current project decision: GO for this offline M5a kit; no authorization for M5b access, ingestion or publication.** Numeric audit passes cannot change that decision. See the [copyable inquiry](provider-inquiry.md); it has not been sent.

## Fixed 40-film audit and unchanged decision rules

The [audit runbook](../audit/README.md) and [frozen sample](../audit/sample.json) implement the approved method: five disjoint groups of eight; eight recent-mainstream and four Iranian/international release checks fixed before provider outcomes; and the same checks at least seven days later. The selection is purposive and editorial, not a claim of audience demand or a random estimate of catalog coverage. No observed provider results accompany the real-title sample. All test responses are self-authored synthetic observations in the audit tests.

| Existing criterion (unchanged) | Decision for an authorized reviewer |
| --- | --- |
| At least 38/40 correct identities, with no unresolved remake confusion | Continue candidate identity mapping only after resolving ambiguities. |
| At least 36/40 usable title, year, runtime and genre, and at least 6/8 in each group | Continue broad discovery; otherwise narrow the catalog and repeat. |
| At least 36/40 usable original language and production countries, and at least 6/8 in each group | Retain those filters; otherwise reduce catalog or explicitly revise public scope. |
| At least 32/40 reviewer-accepted Persian titles | Continue provider-first titles; otherwise assess a permitted curated catalog and correction budget. |
| Missing/unreliable Persian synopsis | Keep a permitted English fallback and bilingual interface. |
| At least 10/12 country/type/date release agreements | Consider release observations only after resolving **every disagreement**. A numeric pass with disagreements is not readiness. |
| Any unsupported available-file assertion | Remove it and correct the rule before publication. Digital is not WEB-DL; physical is not a verified Blu-ray file; neither implies access in Iran. |
| Repeat after seven days | Review changed dates, disappearing offers, missing values, retention limits and correction minutes on the same sample. A copied first-round file is not a recheck. |

Unknowns stay in the denominator. Presence, reviewer acceptance and permissions are separate. The optional subgenre exercise remains deferred.

## Exact handoff to M5b

1. **Owner decision:** supply actual operator/jurisdiction and business purpose; select the candidate and intended field/asset scope; approve the provider inquiry or send it personally. The draft asks about both a private audit and a public catalog. No email or account action is implied by this PR.
2. **External confirmation:** obtain the current accepted agreement and written responses covering unresolved gates, including Iran, retained evidence and AI-assisted tooling. Record a private permission reference, allowed fields, territories and deadlines. Resolve legal questions with qualified advice for the actual parties. If no compatible $0 path exists, choose a narrower approved fallback or stop.
3. **Owner authorization for the private audit:** an authorized human uses their own credentials outside this CLI, fills the generated audit, repeats after seven days and reviews numeric results plus every disagreement. Keep snapshots/results private according to the approved retention policy; do not send provider payloads to this coding assistant without the relevant permission.
4. **Owner review:** approve the resulting catalog/field scope, attribution, editorial owner, correction effort and fallback decisions. Coverage failure never triggers a silent provider or scope change.
5. **Explicit M5b implementation approval:** then implement one bounded, idempotent import under confirmed rights, preserving IDs/provenance, missing values, refresh/removal and retention rules, with staging validation and atomic catalog-revision activation. Use owned placeholders where images are not licensed. No paid service, production change or deployment follows automatically; review and approve that PR separately.

Codex can finish offline code, tests, documentation and PR review now. Operator facts, provider correspondence, credentials, legal assessment, real observations and M5b approval require the owner/authorized parties. This note requests no present access and grants no permission by itself.
