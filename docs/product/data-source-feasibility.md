# Movie data feasibility for the validation pilot

Research date: 2026-10-18. This note explains which data can support an Iranian-first movie discovery MVP and which promises require more evidence.

Engineering update, October 18, 2026. These rights checks apply before ingesting or publicly publishing real third-party metadata. They do not block a non-public prototype using original synthetic titles, descriptions, ratings, release observations, and artwork. A film audit is optional evidence before real integration, not an engineering prerequisite. The approved stack is Go with pgx/sqlc/PostgreSQL and Astro/React/TypeScript. Initial infrastructure must remain free.

The confirmed scope is a free validation pilot without advertisements or affiliate links. Persian and English interfaces are required at launch. Verified WEB-DL and Blu-ray file availability can wait. Interface translation does not establish Persian movie-title or synopsis coverage.

The recommended starting point is TMDB for a small discovery catalog, subject to current terms and provider eligibility confirmation. Present release information as a source's observation about a release event. No credible licensed source for verified WEB-DL or Blu-ray files was identified in the provider documentation reviewed here. This is a research limit, not a claim that no such source exists.

## Evidence and source register

The following twelve first-party documents support this note. Documentation facts appear with citations. Product choices and audit thresholds are proposals. Film coverage, regional connectivity, provider acceptance, and response quality remain unmeasured. This research used public documentation, not authenticated film API calls, credentials, or scraped catalogs.

| Source | What it establishes |
| --- | --- |
| [TMDB FAQ](https://developer.themoviedb.org/docs/faq) | Noncommercial use, commercial definition, attribution, images, and service limitations. |
| [TMDB API terms, indexed English version](https://www.themoviedb.org/api-terms-of-use?language=en-CA) | Contract restrictions, with the freshness limitation below. |
| [TMDB movie discovery](https://developer.themoviedb.org/reference/discover-movie) | Filter vocabulary and regional release-date behavior. |
| [TMDB movie translations](https://developer.themoviedb.org/reference/movie-translations) | A separate endpoint for movie translations. |
| [TMDB alternative titles](https://developer.themoviedb.org/reference/movie-alternative-titles) | Alternative titles and country filtering. |
| [TMDB release dates](https://developer.themoviedb.org/reference/movie-release-dates) | Six release-event types. |
| [TMDB watch providers](https://developer.themoviedb.org/reference/movie-watch-providers) | Country-based offers and JustWatch attribution. |
| [JustWatch partner API](https://apis.justwatch.com/docs/api/) | Contract access, branded links, and published locales. |
| [IMDb noncommercial datasets](https://data.imdb.com/non-commercial-datasets/) | Available fields and dataset structure. |
| [IMDb software reuse conditions](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX) | Limits on public database reuse. |
| [Wikidata introduction](https://www.wikidata.org/wiki/Wikidata:Introduction) | CC0 data, multilingual records, and references. |
| [OMDb](https://www.omdbapi.com/) | API purpose and stated content license. |

## Licensing comes before a public catalog

TMDB says its API is free for noncommercial purposes with attribution. Its FAQ defines a commercial project by a primary purpose of creating revenue for its owner and directs commercial users to sales. A free pilot therefore needs classification against its actual purpose, not its current price alone. The FAQ also disclaims an SLA. [TMDB FAQ](https://developer.themoviedb.org/docs/faq)

The indexed official API terms require a written commercial agreement, limit caching to six months, require deletion on termination, and restrict API content in connection with ML or AI applications. The indexed document says it was updated on October 20, 2023. The search crawl was approximately 1.3 years old, and direct retrieval failed during this review. These are warning signals from an official indexed version, not confirmation of today's accepted contract. [TMDB API terms](https://www.themoviedb.org/api-terms-of-use?language=en-CA)

Before integration, record the current accepted terms and ask the provider to resolve applicable restrictions. Keep AI recommendations, embeddings, and training outside the proposed pilot until explicit rights cover that use. A paid key or a noncommercial label alone would not resolve broad AI wording.

TMDB requires an approved logo and a prominent nonendorsement notice in an About or Credits section. Its FAQ says TMDB does not claim ownership of the supplied images or data. Attribution therefore must not be treated as blanket ownership clearance. Confirm poster display, resizing, CDN use, storage, refresh, and takedown obligations for this product. [TMDB FAQ](https://developer.themoviedb.org/docs/faq)

The proposed implementation would retain source, retrieval time, and refresh deadline for imported values. It would separate product-authored text from provider content and support removal by provider ID. Those are design recommendations pending the current contract, not a claim that permanent local copies are permitted.

## Field feasibility and bilingual behavior

TMDB discovery documents filters for genres, keywords, runtime, original language, country of origin, votes, and release types. This supports a hypothesis that a small deterministic discovery flow is feasible. Endpoint availability does not measure completeness or relevance. [TMDB movie discovery](https://developer.themoviedb.org/reference/discover-movie)

| Product field | Proposed pilot treatment | Evidence still needed |
| --- | --- | --- |
| Identity, title, and year | Use a provider ID. Check remakes and films with the same title. | Correct matches in the fixed sample. |
| Runtime and broad genres | Offer a few filters with an explicit unknown state. | Missingness and useful results per audience segment. |
| Rating | Use one clearly labeled TMDB score with its vote count, if licensed. | Adequate votes for the selected catalog. |
| Persian title | Prefer a reviewed Persian value. Retain the original title. | Coverage and correctness, not merely a nonempty string. |
| Persian synopsis | Show sourced Persian text when available, otherwise an explicit English fallback. | Coverage, translation quality, and reuse permission. |
| Poster | Show only under confirmed rights and provider conditions. | Availability, broken links, and deletion handling. |
| Subgenre or mood | Defer public filters. | A tested taxonomy and enough correctly tagged films. |

Translations and alternative titles are distinct TMDB resources. Alternative titles can be filtered by country. Neither document promises that each film has a Persian translation or that an Iranian alternative title is the preferred Persian title. Measure both resources independently. [TMDB translations](https://developer.themoviedb.org/reference/movie-translations), [TMDB alternative titles](https://developer.themoviedb.org/reference/movie-alternative-titles)

For the Persian interface, the proposed fallback order is reviewed Persian title, sourced Persian title, then English or original title. The English interface prefers English and then original titles. Label the displayed language. Translate buttons, filters, empty states, and source explanations into both interface languages even when catalog text falls back. Do not generate an unreviewed Persian synopsis and present it as provider metadata.

Genres and keywords are separate filters. The API documentation does not establish that keywords form a consistent subgenre hierarchy. Treat a mapping such as a keyword to "psychological thriller" as an editorial hypothesis. A missing keyword must not mean the film lacks that characteristic. [TMDB movie discovery](https://developer.themoviedb.org/reference/discover-movie)

## Release events do not verify files

TMDB distinguishes premiere, limited theatrical, theatrical, digital, physical, and TV events, using types 1 through 6 respectively. Physical is type 5. The type alone does not distinguish DVD, Blu-ray, or an Ultra HD edition. [TMDB release dates](https://developer.themoviedb.org/reference/movie-release-dates)

A generic release date or a top-level "Released" status is insufficient evidence for digital availability. For regional discovery, TMDB documents that `region` changes which date applies. The order in `with_release_type` can change the selected date. Preserve the country and event type with the date instead of reducing all events to one "available" flag. [TMDB movie discovery](https://developer.themoviedb.org/reference/discover-movie)

The distinction is an inference from the documented event schema. A recorded physical release date does not establish that a verified Blu-ray file exists. A digital event does not verify a WEB-DL file, its authenticity, quality, language, or accessibility in Iran. A planned date is not evidence that an event occurred, and a past date alone does not provide a fresh check.

Use wording such as "TMDB records a digital release in the United States dated YYYY-MM-DD. Checked YYYY-MM-DD." Preserve unknown dates and disagreements. Reserve "confirmed by distributor" for evidence checked against that distributor. A database record about an official release is not itself an authoritative distributor confirmation.

The reviewed sources describe metadata, release events, or provider offers. This review found no licensed feed with documented evidence that would justify a "verified WEB-DL file available" or "verified Blu-ray file available" badge. Keep those badges absent until a provider supplies suitable evidence and contractual reuse rights. An official disc listing would still establish the disc offer rather than a particular downloadable file.

## Alternatives do not remove the rights question

IMDb datasets include localized titles with language and region fields, runtime, up to three genres, a weighted rating, and vote count. The documented schema has no promise of Persian coverage and no digital or physical release-event dates. An AKA row marked `dvd` describes an alternative title type, not a dated disc-availability record. [IMDb datasets](https://data.imdb.com/non-commercial-datasets/)

IMDb's software conditions restrict use to personal and noncommercial purposes and prohibit republishing or repurposing the data into a movie-information database, apart from individual personal use. They also prohibit website scraping. A public pilot cannot assume the downloadable datasets grant its intended reuse. Exclude an IMDb rating dependency unless a suitable agreement covers it. [IMDb reuse conditions](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)

Wikidata permits commercial reuse of its structured data under CC0. Its multilingual items can connect labels, aliases, external identifiers, and referenced statements. It is useful for carefully checked enrichment. The community-maintained model supplies no catalog-wide Persian completeness or release-freshness guarantee. A linked image or external website requires its own rights review. [Wikidata introduction](https://www.wikidata.org/wiki/Wikidata:Introduction)

OMDb accepts IMDb-ID lookups, but its site labels all content CC BY-NC 4.0 and disclaims affiliation with IMDb. It does not establish commercial redistribution rights for IMDb-branded ratings. Do not treat an OMDb subscription as proof of those rights. Keep OMDb optional pending provider clarification. Letterboxd ratings are also outside this pilot because this review establishes no reuse permission. [OMDb](https://www.omdbapi.com/)

## Regional offers and country eligibility remain separate

TMDB's JustWatch-powered endpoint reports streaming, rental, and purchase availability by country and provider. It requires JustWatch attribution and supplies a TMDB link rather than full content deep links. Such offers do not establish file availability or access for an Iranian resident. [TMDB watch providers](https://developer.themoviedb.org/reference/movie-watch-providers)

Direct JustWatch partner API access follows a contract and uses a partner token. Its documentation requires branded links and publishes a locale table that did not list Iran during this review. That is a coverage gap to verify, not proof that Iranian contracting or service is categorically prohibited. Defer where-to-watch features and do not scrape a substitute feed. [JustWatch partner API](https://apis.justwatch.com/docs/api/)

Four checks remain independent: developer-country eligibility, permitted audience countries, data coverage for `IR`, and actual network access. An accepted country parameter does not prove all four. Obtain official provider verification about Iran, contracting, payment, hosting, and applicable sanctions terms before commercial integration. Independent legal advice must resolve the legal position for the actual parties and services. This note reaches no sanctions-law conclusion.

The only selected future movie-provider sites are Zarfilm, Avamovie, 30nama, and Digimovie. Filimo and Namava are explicitly excluded. No additional site is approved. No provider integration or automated provider scraping belongs in V1. Provider listings will remain separate from canonical metadata and official release observations.

## Proposed repeatable 40-film audit

No film audit has been run. The following sample and thresholds are proposed decision rules, not measured results.

1. Freeze forty titles before querying the provider. Select eight recent mainstream films, eight older mainstream films, eight international films, eight Iranian films, and eight independent films or documentaries. Make the groups disjoint and record IDs, years, and selection reasons. Use audience requests and distributor catalogs to avoid selecting only well-populated provider records.
2. Record title match, Persian and English titles, synopsis languages, runtime, genres, original language, production countries, score and vote count, poster, and missing values. Preserve each source URL and check time. Record a reviewed Persian title separately from a merely available translation. Original language and production countries must come from the matching detail fields, rather than assuming discovery's country-of-origin field is equivalent.
3. Preselect twelve films for release checks. Use the eight recent mainstream films and four recent titles chosen from the Iranian and international groups when freezing the sample. Compare event country, type, and date against official distributor, studio, or authorized retailer evidence. Keep future announcements separate from observed offers. Mark unavailable evidence as unknown.
4. Repeat the same checks seven days later. Record changed dates, disappearing offers, and manual correction time. Retain audit evidence only as the applicable terms permit. Record unknowns in the denominator instead of dropping difficult films.

| Proposed criterion | Proposed action |
| --- | --- |
| At least 38 of 40 identities correct, with no unresolved remake confusion | Continue the candidate import approach. |
| At least 36 of 40 have usable title, year, runtime, and genre, and at least six of eight in each group | Continue broad discovery. Otherwise narrow the initial catalog and repeat. |
| At least 36 of 40 have usable original-language and production-country values, with at least six of eight in each group | Keep those filters. Otherwise reduce the catalog or explicitly revisit their public scope. |
| At least 32 of 40 have reviewer-accepted Persian titles | Continue provider-first Persian titles. Otherwise test whether a curated launch catalog is affordable. |
| Persian synopsis absent or unreliable | Keep a visible English fallback. Bilingual interface support remains required. |
| At least ten of twelve release checks agree on country, type, and date | Consider release observations after resolving every disagreement. This threshold grants no file-availability claim. |
| Any unsupported available-file assertion | Remove the assertion and correct its rule before release. |

A separate optional subgenre exercise can use twelve manually labeled examples. Measure whether a proposed keyword mapping finds the intended films and wrongly includes others. A large keyword list alone is not a passing result.

Proceed with bilingual interface planning and a small catalog experiment after obtaining the necessary access and rights. Gate live provider integration on current terms, eligibility, and the audit. Defer commercial monetization, AI use of provider content, IMDb and Letterboxd scores, subgenre promises, and verified-file claims until their specific evidence and permissions exist.
