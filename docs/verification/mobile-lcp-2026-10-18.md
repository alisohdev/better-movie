# Mobile Persian LCP investigation — October 18, 2026

## Result

The earlier **2,844 ms mobile LCP median was contaminated by full-page screenshots**. It is superseded for first-viewport analysis. The unchanged application measured **966 ms median over ten untraced loads**, range 880–4,384 ms. Nine loads were at or below 1,116 ms; the 4,384 ms load included 3,716 ms TTFB. No application speedup is claimed from correcting the measurement.

A one-setting CSS-inlining experiment did not reproduce its initial gain. It was reverted. The retained changes fix measurement ordering, record the LCP element, and add repeatable Chrome trace capture. Rendering code is identical to PR #1; no product feature, infrastructure, cache layer, JavaScript-budget change, or production deployment was introduced.

## Why the original measurement was wrong

`scripts/measure.mjs` previously took a `fullPage: true` screenshot before reading the live LCP observer. Two diagnostic captures on the same protected deployment establish the error:

| Capture | Before screenshot: visible heading | After full-page capture: poster |
| --- | --- | --- |
| 1 | 960 ms; H1 at y=160, height=128 | 2,780 ms; `orbit-of-two.svg` at y=1,205 |
| 2 | 1,120 ms; same H1 | 2,636 ms; same below-fold poster |

The original viewport was 390×844. The poster was outside it. Full-page capture introduced a larger LCP candidate; `innerHeight` was back at 844 when subsequently inspected. The existing harness also reproduced screenshot-contaminated readings of 2,484–2,572 ms in this investigation. The corrected harness freezes measurements before any screenshot and records candidate identity. The dedicated trace harness also measures before capture; its optional `--probe-full-page` retains both observations for diagnosis.

## Rendering path and measured delays

The discovery route is Astro-prerendered HTML containing the Persian heading, controls, and 12 film cards. The React island hydrates with `client:load`. Its default result is supplied in the HTML; no API request or Neon query appears on the initial discovery resource path. Filter requests remain real PostgreSQL-backed API calls.

The actual first-viewport LCP is `h1#discovery-title`, the Persian two-line heading, about 33,111 painted square pixels. It uses system fonts. The browser reports zero downloadable font faces and no font requests. Poster SVGs are small and the first has eager/high priority, but neither poster loading nor font downloading gates this text LCP. Those settings were left unchanged.

Two baseline Chrome traces give this breakdown (traced runs diagnose causes; they are excluded from timing comparisons):

| Trace | LCP | TTFB | LCP resource delay | LCP resource duration | Element render delay |
| --- | --- | --- | --- | --- | --- |
| 1 | 964 ms | 314.9 ms | 0 | 0 | 649.1 ms |
| 2 | 964 ms | 235.2 ms | 0 | 0 | 728.8 ms |

Resource phases are zero because the LCP is text using system fonts. Critical CSS and layout fall within element render delay in the [LCP subpart model](https://web.dev/articles/optimize-lcp#lcp_breakdown); they must not be counted again as an LCP image/font request.

The 7,274-byte Brotli stylesheet is render-blocking. It takes 220.3/247.1 ms in these traces and finishes at 659.8/605.6 ms. Main-thread trace events before LCP show 267.0/316.1 ms in `Layout`, 12.8/19.5 ms in `UpdateLayoutTree`, and 4.7/4.0 ms in `EvaluateScript`. These event sums describe categories on the renderer main thread, including frame work; they are not an additive partition of LCP. Main-thread task wall time is 417.0/486.8 ms. CPU slowdown is applied, so wall duration differs from thread CPU time.

The large React bundles finish loading after the heading paints. The observed later long tasks occur after LCP. There is no evidence here for replacing or delaying hydration, changing image priority, adding font preloads, or treating Neon wake-up as this page's LCP cause. The trace identifies real CSS/layout work within an already sub-target initial viewport, not a demonstrated 2.8-second user-visible paint delay.

## Reversible CSS experiment

Candidate commit `55e0746793d95f9a4b9f3d6fb2d8fb5837dac295` used [Astro's stylesheet-inlining setting](https://docs.astro.build/en/reference/configuration-reference/#buildinlinestylesheets), `build.inlineStylesheets: 'always'`, to remove the external blocking request. This added about 6.4 KiB gzip to each HTML document and prevented that stylesheet from being shared through browser caching across pages. The JavaScript ceiling remained 118,979 gzip bytes. Persian document gzip grew from about 8,845 to 15,401 bytes; measured Brotli response bodies grew from 9,269 to 16,510 bytes.

Both targets used the same production application and database, differing only in the stylesheet setting. Every final LCP candidate was the same H1 with the same rectangle. No HTTP failure, console/page error, or horizontal overflow occurred in these runs. All samples are retained, including the high-TTFB outlier.

| Untraced batch | Target order per pair | Baseline median (range) | Inline CSS median (range) |
| --- | --- | --- | --- |
| Initial five per target | baseline, candidate | 924 ms (888–4,384) | 700 ms (668–1,052) |
| Confirmation five per target | candidate, baseline | 992 ms (880–1,116) | 1,004 ms (704–1,124) |
| Combined ten per target | balanced across batches | 966 ms (880–4,384) | 862 ms (668–1,124) |

The confirmation did not reproduce the gain. Only six of ten paired loads improved, and ranges overlap. Combined median differences are not a reliable speedup claim. Candidate traces still show substantial variable layout work, including a 394.9 ms layout event in one capture, after the CSS request is removed. Inlining can move saved network time into rendering delay. Given the extra HTML cost, the result is **inconclusive**, and commit `c042f32` reverts the setting.

## Environment and reproduction

Protected baseline: [deployment ccd8d06](https://frame-movie-discovery-2fklc3yxk-alirezaconstantins-projects.vercel.app), Vercel Hobby, function region iad1. Rejected candidate: [deployment 55e0746](https://frame-movie-discovery-lnoeolomq-alirezaconstantins-projects.vercel.app), same project and plan. Vercel reports the candidate's committed SHA and clean metadata; Preview protection remains enabled. The existing CLI-authorized automation header was supplied privately. No credential is stored in the report or artifact bundle.

Client: Windows x64, Intel Core i3-10100, eight logical cores, Chrome 155.0.8059.80, Node 24.19.0. Pre-run CPU load was 18%; this is a shared workstation. Each load gets a fresh browser context: Persian discovery, 390×844, reduced motion, 4× CPU slowdown, 150 ms additional latency, 200,000 bytes/s down (1.6 Mbps), 93,750 bytes/s up (0.75 Mbps). Browser cache is fresh per context; CDN warmth is not forced. Target order is interleaved and reversed in the confirmation. Traced runs are separate. No sustained load or paid resources were used.

Supply the existing private `VERCEL_AUTOMATION_BYPASS_SECRET` through your shell, and optionally set `PLAYWRIGHT_CHANNEL=chrome`. Without that override, the harness uses installed Playwright Chromium. Set `BASELINE_URL` and `CANDIDATE_URL` to the exact deployments above:

```sh
node scripts/measure-lcp.mjs --target=baseline,$BASELINE_URL --samples=2 --trace --output=.local/lcp-traces
node scripts/measure-lcp.mjs --target=baseline,$BASELINE_URL --samples=2 --trace --probe-full-page --output=.local/lcp-screenshot-probe
node scripts/measure-lcp.mjs --target=baseline,$BASELINE_URL --target=candidate,$CANDIDATE_URL --samples=5 --output=.local/lcp-comparison
node scripts/measure-lcp.mjs --target=candidate,$CANDIDATE_URL --target=baseline,$BASELINE_URL --samples=5 --output=.local/lcp-confirmation
```

The harness writes sample reports, viewport screenshots, and optional gzip Chrome traces. Traces can be loaded into Chrome's Performance panel. The test credential is redacted before trace persistence. [Distilled measurements](mobile-lcp-2026-10-18.json) retain per-load timing, candidate, critical resources, trace totals, and screenshot-probe results. Full local traces/reports are packaged separately as `.local/mobile-lcp-artifacts.zip`.

## Verification and uncertainty

After reverting the CSS experiment, `npm run verify` passed: zero Astro diagnostics, all 18 unit tests, the static build, 12 server-rendered cards per locale, and the unchanged 118,979-byte gzip JavaScript ceiling. `go test ./... -count=1` and `go vet ./...` passed against the existing local scratch database. The complete [Actions pipeline passed on c042f32](https://github.com/alisohdev/better-movie/actions/runs/39135873157), including verified pinned sqlc generation and all browser checks.

All 20 local desktop/mobile tests passed with isolated output (`npm run test:e2e -- --output=.local/lcp-local-test-results`). One earlier local run reported missing trace files because local and remote Playwright processes shared `test-results`; no product assertion failed. The isolated rerun resolved that artifact collision. All 20 remote tests and supplemental English/Persian loading, induced-error recovery, cache, history, and zero healthy-operation JavaScript-error checks passed on the unchanged protected application. The corrected existing measurement harness returned mobile H1 LCP samples 888, 884, 900, 900, and 1,140 ms (median 900 ms); CLS stayed about 0.000505. These five validate the repaired harness and are separate from the paired comparison sample set.

Independent Open Pstack review used configured native GPT-6.1 Sol at max effort with read-only work, after checking effective danger-full-access/approval-never permissions. It found the CSS benefit was not reproducible and recommended reverting; this was accepted. It found no additional correctness or security issue. The local artifact bundle contains six parseable Chrome traces, full timing reports and screenshots; a literal credential scan passed over all reports and decompressed traces.

The corrected median meets the 2,500 ms lab target. It does not establish field p75, INP, real mobile-device performance, or Iranian-network access. The high-TTFB outlier remains real; its network/CDN/server origin cannot be attributed with these browser traces alone. CPU and network noise, browser/font-cache behavior, and deployment-edge differences remain possible contributors to the CSS experiment's variation. No app optimization was retained without repeatable evidence.
