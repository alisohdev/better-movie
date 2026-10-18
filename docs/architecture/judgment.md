# Architecture judgment

Choose [Candidate A](candidates/astro.md), Go with static Astro pages and a React discovery island. It meets the required initial bilingual HTML and keeps detail pages small. The SPA offers simpler navigation continuity, but client-rendered movie bodies fail the first-slice rendering requirement. Custom SPA prerendering recreates work Astro already owns.

Scores assess the proposals against this slice, not measured performance. Five is strongest.

| Criterion | Astro | SPA |
| --- | ---: | ---: |
| User value and performance | 4 | 3 |
| Free deployment plausibility | 3 | 3 |
| Solo maintenance | 4 | 4 |
| Correctness and portability | 4 | 3 |
| Crawlable HTML and SEO | 5 | 1 |
| Total | 20 | 14 |

Astro's performance score depends on proving cache continuity and mobile interactions. Both candidates share uncertain hosting eligibility, Go cold starts, and database wake-up. The SPA's contract drift reduces correctness despite its portable Go boundary. Synthetic pages remain `noindex`; crawlable HTML does not authorize indexing fictional films.

Transfer two policies from [Candidate B](candidates/spa.md):

1. Keep one QueryClient across Astro document transitions and explicitly cap inactive discovery results at twenty pages. Prove reuse after detail navigation. Keep A's sixty-second freshness and ten-minute inactive lifetime. Static details need no JSON detail cache.
2. Coalesce draft filter edits into one deliberate history entry. Replace URL normalization, reset pagination when constraints change, and never push during Back or Forward restoration. Verify filters, results, and scroll together.

The [API contract](../engineering/api-contract.md) overrides candidate differences. Use `/api/movies`, bilingual documents, `total`, `catalogRevision`, and `v=1`. Reject B's locale-dependent API, alternate response names, and stricter unknown-genre exclusion rule. Generate SQL and HTML from `catalog/movies.json` with matching revision and checksum. PostgreSQL owns live filtering. Display the unfiltered static baseline honestly until a filtered URL resolves.

Use `apps/web` and root `api/index.go` from the [compatibility assessment](../deployment/compatibility.md). Start with one pool per function instance, `MaxConns=2`, `MinConns=0`, and `MinIdleConns=0`. Proposed spike limits are two seconds for acquisition, two seconds for queries, and eight seconds overall beneath a ten-second function limit. Request cancellation must propagate.

Prefetch the HTML consumed by static detail navigation. JSON prefetch cannot accelerate an unused detail query. Defer next-page speculation, service workers, SSR, Redis, revision history, and multiple projects until evidence requires them.

This independent native GPT-6.1 Sol judgment compares completed candidates from the same model family. It provides no provider diversity. The local spike may begin. No Neon credential, remote deployment success, measured native-like behavior, or Iranian-network accessibility is established.
