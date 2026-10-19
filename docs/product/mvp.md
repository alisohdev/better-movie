# Movie discovery MVP brief

M5b implementation decision, 2026-10-19: TMDB is selected for a bounded opt-in staging pipeline. The operator declares individual operation from Iran and a free, noncommercial purpose. Engineering with self-authored responses is approved now; the deployed synthetic catalog stays the default, and live account eligibility, accepted terms, retention and public publication remain gated. See [private activation and rollback](../engineering/tmdb-staging.md). References below to deferred provider integration concern public rollout and provider listings, not this authorized engineering work.

Status: approved prototype direction, updated October 18, 2026 from the master engineering and performance requirements. The first vertical slice uses a clearly labeled synthetic catalog. A real public catalog remains subject to data rights and eligibility.

Research date: October 18, 2026. Audience and usability assumptions below are untested. Effort ranges, catalog sizes, and acceptance thresholds are planning proposals, not measurements.

## 1. Product vision and target audience

Help a movie enthusiast in Iran turn a few preferences and exclusions into a film they would choose tonight. Start with a small, trustworthy bilingual discovery experience. Expand the catalog and recommendation methods only after people use that experience repeatedly.

The initial audience is Persian-speaking adults who already watch international films, use either Persian or English titles, and know some constraints but rarely have a specific title in mind. Being based in Iran describes the audience. It does not restrict the catalog to Iranian films. Iranian cinema belongs in the pilot alongside world cinema. This audience definition is a hypothesis to test with interviews.

The promise is a shorter decision process with understandable results. The app cannot promise personal enjoyment or that a film is accessible from Iran. It has neither personal viewing histories nor Iranian provider coverage in V1.

### Confirmed choices

- Publish Persian and English interfaces at launch. All product planning and documentation remain in English.
- Run a free validation pilot without ads or affiliate links. This choice does not itself establish eligibility for a noncommercial data license.
- Show sourced official-release information. Defer verified WEB-DL and Blu-ray file availability.
- Use Go with net/http, pgx, sqlc, and SQL migrations for the API. Use Astro, React, TypeScript, Tailwind, and TanStack Query for the frontend. Keep one backend, one frontend, and one PostgreSQL database. TanStack Start and Drizzle are superseded.
- Target $0 monthly infrastructure with Vercel Hobby and Neon Free, subject to current account eligibility and quotas. Do not enable paid services. Use synthetic metadata and original artwork until real-data permissions are established.
- Do not implement streaming, video hosting, provider scraping, or AI recommendations in V1.

### Assumptions worth challenging

| Assumption | Why it may fail | Evidence that would change the plan |
| --- | --- | --- |
| More filters lead to better choices. | A large form may increase indecision. | People choose faster with a few starting controls and visible exclusions. |
| Bilingual filtering earns a return visit. | Existing tools may already be sufficient. | Pilot users prefer this workflow over their usual tool on a real selection task. |
| Discovery is useful without Iranian provider links. | Finding a film may be secondary to locating an accessible copy. | Interviewees can complete discovery using their existing access methods. If access dominates, reconsider the product before adding more filters. |
| Ratings approximate taste. | Community scores favor established films and say little about an individual's preferences. | Users understand the score's source and can choose without treating it as a personal prediction. |
| Release information can be trustworthy at low cost. | Missing country records and stale dates may overwhelm the benefit. | The field audit finds enough dated, attributable events to justify the feature. |

## 2. Core user journeys

### Choose a film without knowing its title

Open discovery without signing in. Start with runtime, genre, and an optional exclusion. Keep year, language, country, rating, and release evidence behind an expanded filter panel. Offer a few literal starting recipes, such as films under 100 minutes or thrillers excluding horror. Recipes apply visible filters and make no promises about mood, pacing, or content safety.

Show a small first page of about 12 movie cards. Each card supplies a poster or placeholder, title, year, runtime, genres, and a clearly sourced score. Show active constraints above the results. Open a detail page, inspect a short synopsis and release evidence, and choose the film or return without losing the search. A decision confirmation can support pilot measurement. It is not a streaming button.

If nothing matches, preserve every constraint and explain the conflict. Offer explicit edits, such as removing the runtime cap. Never silently relax an exclusion or rating threshold. A missing-data message must differ from a network error or an empty result set.

### Find a known film by either title

Search English, original, and available Persian title aliases. Distinguish remakes by year and original title. Use the interface language for labels, with English and original-title fallbacks for movie content. A missing Persian title is a coverage gap, not evidence that the film is absent.

Make title lookup distinct from filtered discovery. A title suggestion may open its detail page directly. Explain that title lookup is not constrained by the discovery form. An empty lookup says the film may be outside this pilot catalog. V1 does not promise exhaustive catalog search, automatic transliteration, or typo correction.

### Understand release evidence without confusing it with availability

On the detail page, read a reported digital or physical release date together with its country, source, and last checked date. Distinguish a past reported date, a scheduled date, and missing information. None establishes that a particular file exists or that an Iranian service carries the film.

### Share a discovery session

Copy a URL containing filters, sort, page, and interface locale. Opening the link restores those choices without an account. Browser Back restores the previous results and scroll position. A recipient can change interface language while keeping the same constraints. Results may change as the catalog updates. A shared URL is not a permanent snapshot of movie IDs or an availability guarantee.

## 3. MVP scope and explicit non-goals

### The smallest useful public pilot

Propose 1,000 to 2,000 source-identified feature films selected around pilot participants' interests, with Iranian and international examples across several decades. Include narrative films, feature documentaries, and animation. Exclude series, episodes, shorts, and adult-designated titles. Define ambiguous source types during the data audit instead of inferring feature status from runtime alone.

Use an explicit pilot catalog label. This is not a comprehensive movie database. Do not impose a popularity or vote-count eligibility rule on the entire catalog, since that can erase Iranian and less mainstream films. Catalog size is a ceiling on initial operations, not a launch success metric. Start smaller if a representative catalog satisfies the user tasks.

| Capability | Public pilot commitment | Deliberate limit |
| --- | --- | --- |
| Genres | Include genres, exclude genres, and choose whether included genres match any or all. | Genre exclusions depend on source tagging. They are not verified content warnings. |
| Year and decade | One inclusive year range, with decade shortcuts that populate the same range. | Use the primary release year and Gregorian years in both interfaces. Do not add a separate calendar system. |
| Runtime | Inclusive minimum and maximum minutes. | Source-reported movie runtime, not a guarantee about every cut. |
| Language | Original-language filter, with multiple selected languages matching any. | No subtitle, dub, or spoken-language completeness claim. |
| Country | Source-reported production countries, with any selected country matching. | Not filming location, viewer country, or provider availability. |
| Ratings | One labeled TMDB community score, vote count, minimum score, and optional minimum votes, subject to licensing. | No IMDb, Rotten Tomatoes, or Letterboxd score dependency. |
| Release filter | No release filter, reported past digital release, or reported past physical release. | Scope is any recorded country, stated visibly. No Iranian availability or Blu-ray-format filter. |
| Title lookup | English, original, and permitted Persian aliases present in the catalog. | No claim of complete Persian coverage. |
| Results and details | Responsive cards, a concise detail page, keyboard support, loading states, and missing-data states. | No cast encyclopedia, trailers, reviews, or social feed. |
| Sorting | Popularity by default, highest rated, newest primary release year, and shortest runtime. | Call popularity popularity. Do not label it personalized or best match. |
| URLs | Versioned, validated filter URLs and browser navigation. | No saved accounts or synchronized watchlists. |
| Localization | Both interfaces, right-to-left Persian layout, left-to-right English layout, mixed-direction title handling, and preserved locale preference. | English fallback for missing metadata. No machine translation of synopses. |

Defer subgenres from the public MVP. TMDB's discovery contract offers genres and keywords. That does not establish a consistent subgenre taxonomy. A small editorial taxonomy becomes a later experiment only if users need it and someone owns its definitions and review burden. [TMDB discovery reference](https://developer.themoviedb.org/reference/discover-movie)

Keep upcoming-film browsing out of this pilot. The catalog focuses on already released films. A later home-release date for an already theatrical film can still appear as scheduled evidence. This narrows the original release-status request to a useful, supportable home-release filter.

### Filter behavior must be understandable

- Different filter groups combine with AND. Included genres default to matching any selected genre. The selected genre mode controls only included genres. V1 has no nested Boolean query builder.
- Excluded genres reject a film with any matching excluded tag. Prevent the same genre from being both included and excluded. Explain incomplete tagging instead of claiming a film contains no unwanted material.
- Missing runtime, year, original language, country, or rating cannot satisfy an active constraint on that field. Leave missing values visible when that constraint is inactive. Never substitute zero for unknown.
- A score threshold and a vote-count threshold are independent. Show both when active. Highest-rated sorting places unscored films last. Do not silently apply a vote floor. A visible suggested 100-vote floor is an experiment, not a universal quality rule.
- Release filters include only a relevant reported date on or before the current date. Future dates and absent records do not qualify. Reported physical evidence never implies Blu-ray or file evidence.
- Put unknown runtime last when sorting by shortest, and unknown year last when sorting by newest. Use a stable tie-breaker for pagination. Reset the page after changing filters.
- Validate impossible ranges and conflicting URL values. Keep parameter keys stable across both interface languages. Malformed links receive an explanation rather than an unannounced broader search.

An illustrative URL is `/en/discover?v=1&genres=crime,thriller&genreMode=all&excludeGenres=horror&runtimeMax=110&yearMin=2000&sort=popularity`. This describes a product contract, not implemented routes.

### Explicit non-goals

No AI search, model training, embeddings, vector database, personalization, provider integration, provider scraping, download links, torrents, streaming, video storage, subtitle discovery, or verified file badges. No accounts, user reviews, social graph, recommendation quiz, alerts, payments, advertisements, affiliate tracking, separate search service, microservices, native mobile app, or full multilingual synopsis catalog.

### Keep the implementation small

The approved stack is a portable Go HTTP API and Astro public pages with React islands for discovery. PostgreSQL remains authoritative for filtering. sqlc generates substantive query bindings. The [architecture decision](../architecture/0001-application.md) and [deployment assessment](../deployment/compatibility.md) own implementation and hosting decisions.

Prefer one Vercel project serving Astro's static output and Go function handlers, plus Neon PostgreSQL. Prove compatibility before expanding the app. Keep an ordinary Go server entry point for local development and later portability. Start with an idempotent synthetic seed. A permitted real-data importer and scheduled refresh come later. Keep credentials on the server. Maintain source IDs, provenance, and retention deadlines when integrating real data. Normalize title search without modifying displayed titles.

Do not build provider tables or an AI service now. Preserve the domain distinction between a movie, its localized titles, and country-specific release observations. Later provider listings will reference a movie separately and carry their own source, region, destination URL, checked time, and permissions. A provider's branding or claim of access must never overwrite canonical movie metadata.

## 4. Data-source feasibility and risks

The proposed technical source is TMDB, conditionally. Licensing clearance and an authenticated sample audit are unfinished. No API credentials were used, no sample film coverage was measured, and no provider was scraped during this research. Detailed source findings and the proposed 40-film audit are in [Data-source feasibility](data-source-feasibility.md).

| Source | MVP judgment | Principal limitation |
| --- | --- | --- |
| TMDB | Preferred single technical source, pending accepted terms and project eligibility. | Do not assume free product means permitted use, complete Persian metadata, accurate release events, or permanent storage rights. |
| IMDb | Optional outbound reference, not an MVP data dependency. | Its downloadable datasets have personal and noncommercial constraints. A public product must not assume a free right to republish them. [IMDb datasets](https://data.imdb.com/non-commercial-datasets/) |
| Wikidata | Possible later factual-ID or alias supplement if the audit shows a specific need. | Open structured data is not a complete poster, synopsis, score, or release service. Validate facts and preserve provenance. |
| OMDb or another score aggregator | Defer. | An extra API does not establish rights to redistribute every upstream rating or image. Resolve its contract before adding dependencies. |
| JustWatch and Iranian providers | V2 feasibility work only. | A consumer page or reachable endpoint does not grant integration rights or prove Iranian coverage. |

TMDB's FAQ permits noncommercial use with attribution and directs commercial projects to sales. That is not clearance for this particular pilot. Its official indexed API terms describe a six-month cache limit and broad restrictions on AI-connected use. Direct retrieval of the legal page failed during this research, and the available indexed text is older. Recheck the current accepted agreement and obtain provider clarification before storing or publishing a catalog. Future AI use is a separate rights gate. [TMDB FAQ](https://developer.themoviedb.org/docs/faq), [TMDB API terms, indexed official text](https://www.themoviedb.org/api-terms-of-use?language=en-CA)

Confirm whether the license permits this searchable projection, aliases and normalization, images, both locales, hosting location, and access by an operator serving Iran. Record deletion and refresh obligations. Public API documentation and a working key establish technical access, not all of those rights. Resolve jurisdiction-specific eligibility and legal questions with the source owner and appropriate legal advice. Do not infer approval or a blanket prohibition from nationality alone.

### Release claims need separate evidence levels

TMDB identifies digital as type 4 and physical as type 5. Its physical type does not specify Blu-ray rather than another physical format. V1 can display a source-reported event with a country and date. That is distinct from distributor confirmation, a live provider listing, and an independently verified file. [TMDB release-date reference](https://developer.themoviedb.org/reference/movie-release-dates)

Prefer a label such as "Digital release reported in US, October 1, 2026. Source: TMDB. Checked October 18, 2026." This is an illustrative label, not a claim about a film. A missing event says "No release information recorded." A future date says "Scheduled." Never turn missing data into "Not released," or a reported date into "Available in Iran."

Release information is supplementary. If the audit finds poor coverage, omit the release filter from the public pilot and retain clearly labeled observations on detail pages. Record that reduction as a product decision. Do not manufacture certainty to preserve the original feature list.

### V2 and V3 depend on evidence

The only selected future providers are Zarfilm, Avamovie, 30nama, and Digimovie. Filimo and Namava are explicitly excluded. Add no other provider without user approval. Investigate each selected service's permission, reliability, identifier matching, linking rules, and reuse rights before any automated integration. These remain future product considerations, not V1 implementation work. Neither access rights nor catalog coverage are established.

For AI-assisted language input or personalization, first demonstrate repeated demand and confirm that the data license permits the intended AI connection. Even an AI layer that only turns language into filters requires that review. Do not upload metadata, build embeddings, or train a model under an assumed permission. Retain a deterministic filter experience if AI rights or quality cannot be justified.

## 5. Differentiation and monetization

| Existing product | Evidence of existing capability | Focus this MVP can test |
| --- | --- | --- |
| IMDb | Advanced title search includes exclusions. Its help describes negative query parameters. [IMDb advanced search help](https://origin-help.imdb.com/article/imdb/discover-watch/using-the-advanced-search-feature/GLUEUYWPQNPTEVPU) | A clearer bilingual decision flow, visible constraints, and fewer steps on mobile. Do not claim exclusion support is novel. |
| TMDB | Its movie discovery API documents extensive filters and AND or OR combinations. [TMDB discovery reference](https://developer.themoviedb.org/reference/discover-movie) | Better guidance for uncertain viewers and carefully explained missing data. Its source catalog and filters alone provide little defensible differentiation. |
| Letterboxd | Its paid tier includes preferred streaming-service filtering and watchlist availability notifications. [Letterboxd paid subscriptions](https://letterboxd.com/about/pro/) | Immediate account-free selection in two interface languages. Do not compete with its community, diary, or lists in V1. |
| JustWatch | It centers legal viewing destinations and filters for selected services and offer types. [JustWatch provider filters](https://support.justwatch.com/article/understanding-provider-filters-in-the-just-watch-app) | A discovery-first workflow for the pilot audience. V1 does not replace its availability function. |

These are proposed areas to test, not proven advantages or assertions that competitors lack Persian support. The outside check against official IMDb and TMDB documentation rejects the initial assumption that powerful filters alone distinguish the product. None of the research establishes a durable business advantage yet.

Keep the pilot free as agreed. Test whether people voluntarily use it for a second real selection session before asking what they would pay. Free competitor functionality makes a subscription for basic filters a weak starting assumption. User interviews, rather than a hypothetical willingness-to-pay survey alone, should reveal repeated selection problems.

Later possibilities include paid saved searches or release alerts, or permitted provider referrals. Each requires separate evidence of value, licensing review, and payment or partnership feasibility for the actual operator. Do not add those systems now. Ads, donations, sponsorship, and affiliate revenue can change the licensing assessment. No sustainable revenue or licensing price has been demonstrated.

The initial infrastructure ceiling is $0 monthly. Use a free hosting subdomain and no purchased domain. Free-tier quotas and cold starts are constraints, not an uptime or latency guarantee. A proposed maintenance target is two operator hours per week after setup. This target is unmeasured. Paid data rights remain a possible blocker for a later real catalog, not permission to add a paid service.

## 6. Prioritized milestone roadmap

The engineering prototype uses 32 owned synthetic films. Requirements reconciliation, two architectural candidates with an independent judge, the local deployment spike, and the first implementation are recorded in the [engineering plan](../engineering/plan.md). Actual completed checks belong in [verification results](../verification/results.md). A local build is not a remote deployment.

| Priority and milestone | Deliverable | Exit condition |
| --- | --- | --- |
| P0. Close the remote deployment gate. | One eligible Vercel Hobby project, Neon Free database, and the existing synthetic slice. | Verify routing, React interactions, verified database TLS, bounded connections, failure behavior, and genuine cold/warm measurements without paid services. Record Iranian access separately after a consenting tester checks it. |
| P0, parallel. Validate the real-data path. | Current accepted source terms, operator eligibility, and a representative 40-film audit. | Permission covers local projection, retention, images, bilingual display, corrections, and removal. The source audit establishes actual coverage before real-data ingestion or publication. This does not block synthetic development. |
| P1. Add bilingual title lookup. | Normalized Persian/Arabic characters and English/Persian aliases, without changing displayed source titles. | SQL and browser tests cover aliases, normalization, missing translations, URL round trips, and debounced canceled requests. |
| P1. Add one filter increment. | Original language and country, followed by source-labeled minimum rating and optional vote count. | Each increment has documented missing-value semantics, URL support, real SQL cases, and usable mobile controls. |
| P1. Establish a permitted catalog. | Bounded import, source identities, title aliases, refresh/removal rules, and static-build revision activation. | Rights and coverage gates pass; repeat imports do not duplicate movies; a failed publication cannot mix catalog revisions. |
| P1. Refine official release evidence. | Clearly scheduled or reported digital/physical observations, with source, territory, and check time. | Unknown remains unknown. Add a release filter only if the audit supports it. No inferred WEB-DL, Blu-ray file, or Iranian accessibility claims. |
| P1. Validate the selection experience and operate the pilot. | Five to eight interviews, six usability tasks, a two-week free pilot with roughly ten to fifteen participants, and a database restore exercise. | Apply the behavior criteria below, review both interfaces with a bilingual tester, measure on actual target networks, and document maintenance effort. |
| Later. Evaluate V2 or V3. | One permitted selected-provider integration or one rights-cleared AI experiment. | Repeated user need, viable permissions, and an operating budget justify that specific addition. No automatic phase progression. |

Do not begin these increments as part of the current first-slice delivery. Schedule them after the deployment gate and the relevant permissions are understood. Interviews and the audit run alongside engineering, not as invented prerequisites for owned synthetic UX work. No delivery date is promised before the developer's available hours are known.

Do not recover schedule by dropping one required interface or hiding uncertain release claims. Cut optional catalog breadth, subgenres, and release filtering first. Bilingual UI is a confirmed requirement and belongs in the original effort estimate.

### Pilot decisions must use observed behavior

Use the selection session, not page views, as the unit of value. Record time to a chosen film and task completion. A detail-page visit alone is not success. Ask participants later whether they watched the film and enjoyed it. Treat those answers as voluntary self-reports, not verified viewing or a statistical proof of recommendation quality.

Proposed progression criteria are at least four of six successful usability tasks and at least five of ten pilot participants making an unprompted second selection visit within two weeks. Also require no unsupported availability claims or unlabeled scheduled dates in audited pages, a working filter URL round trip, and acceptable maintenance effort. These small samples guide the next decision. They do not estimate population retention.

Collect only the minimum consented data needed to test the hypothesis. Do not log raw search text or persistent viewing profiles by default. Manual follow-up can replace a new analytics integration. Keep recruitment and usability findings separate from technical coverage measurements.

If people need provider access before they can choose, revisit positioning or investigate one permitted provider before further discovery work. If they choose quickly but never return, improve catalog relevance or the decision flow before adding AI. If alias gaps dominate failure, repair that narrow catalog gap before adding more controls.

## 7. Open decisions requiring your input

These decisions remain open. The defaults are proposals, not approvals.

| Decision | Proposed starting point | Needed by |
| --- | --- | --- |
| Initial audience and catalog balance | Iranian-based world-cinema enthusiasts, with a representative Iranian-cinema subset. Recruit from communities you can reach. | Before interviews and the film audit. |
| Noncommercial eligibility and operator jurisdiction | Ask TMDB to classify the real-data pilot and confirm applicable terms, territory, images, projection, and retention. | Before ingesting or publishing real third-party catalog data, not before the synthetic prototype. |
| Time budget | Infrastructure is capped at $0 monthly. Focused hours available each week remain unknown. | Before promising a delivery date. |
| Editorial responsibility | You own Persian UI wording and permitted alias corrections, with help from a bilingual tester. Review the prototype's wording and agree on English metadata fallback and a realistic correction budget. | Before the public pilot and real catalog import. |
| Minimum release-data quality | Accept detail-page evidence without a release filter if the proposed audit threshold fails. | After the audit, before public scope is fixed. |
| Rating and sorting defaults | One labeled TMDB score and popularity order. Test a visible minimum-vote suggestion without hiding less mainstream films. | During the selection-flow test. |
| Pilot recruitment and follow-up | Recruit ten to fifteen reachable viewers and obtain consent for basic task measurement and optional viewing follow-up. | Before the pilot. |

The interface languages, free pilot without ads or affiliate links, and deferral of verified file availability are already decided. Synthetic UX and engineering work can proceed in parallel with real-data feasibility. Real-data ingestion and public publication require the corresponding permissions first.

## 8. Performance is part of the first slice

Deliver meaningful Astro HTML and hydrate only interactive discovery. Keep controls synchronous, requests cancelable, query keys canonical, cached results reusable, and result dimensions stable. Preserve URL filters and scroll on Back. Ship an intentional, adaptive card-intent prefetch rather than fetching the catalog speculatively.

The deployed goals are LCP at most 2.5 seconds, INP at most 200 milliseconds, and CLS at most 0.1 at the 75th percentile. These are targets, not measured claims. Track production-build JavaScript, request counts, filter latency, SQL duration, navigation, cache hits, prefetch usefulness, and cold versus warm hosting behavior. Local lab measurements cannot establish deployed field percentiles or Iranian-network accessibility.

Use bounded HTTP and Query caches with explicit freshness. Never represent a stale release observation as a fresh availability check. A manifest and a small offline fallback can be evaluated incrementally. A service worker, full offline catalog, and synchronization engine do not block the deployment spike. See [performance contract](../engineering/performance.md).
