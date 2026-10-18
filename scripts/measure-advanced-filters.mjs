import assert from 'node:assert/strict';
import { chromium, devices, expect } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values, median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2, range: [sorted[0], sorted.at(-1)] };
};
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, channel: process.env.PLAYWRIGHT_CHANNEL });
const surfaces = [];
try {
  for (const locale of ['en', 'fa']) {
    const fa = locale === 'fa';
    const context = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errors = [], titleRequests = [], requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      const target = new URL(r.url());
      if (target.pathname === '/api/titles') titleRequests.push(r.url());
      if (target.pathname === '/api/movies') requests.push(r.url());
    });
    await page.goto(`${base}/${locale}/discover/`, { waitUntil: 'networkidle' });
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.locator('.filter-toggle').click();
    await page.locator('.advanced-filters > summary').click();
    for (const disclosure of await page.locator('.advanced-options > summary').all()) await disclosure.click();
    const panel = page.locator('.advanced-filters');
    const apply = panel.getByRole('button', { name: fa ? 'اعمال امتیازها' : 'Apply scores', exact: true });
    const operations = [
      () => panel.getByRole('checkbox', { name: fa ? 'انگلیسی' : 'English', exact: true }).check(),
      () => panel.getByRole('checkbox', { name: fa ? 'فارسی' : 'Persian', exact: true }).check(),
      () => panel.getByRole('checkbox', { name: fa ? 'ایران' : 'Iran', exact: true }).check(),
      () => panel.getByRole('checkbox', { name: fa ? 'ایالات متحده' : 'United States', exact: true }).check(),
      async () => { await panel.getByLabel(fa ? 'حداقل امتیاز (۰ تا ۱۰)' : 'Minimum score (0–10)', { exact: true }).fill('8'); await apply.click(); },
      async () => { await panel.getByLabel(fa ? 'حداقل تعداد رأی (اختیاری)' : 'Minimum vote count (optional)', { exact: true }).fill('200'); await apply.click(); },
    ];
    const times = [];
    for (const operation of operations) {
      const result = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/movies');
      const start = performance.now();
      await operation();
      const response = await result;
      const body = await response.json();
      assert.equal(response.status(), 200);
      await expect(page.getByTestId('results')).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByTestId('movie-card')).toHaveCount(body.items.length);
      times.push(Math.round((performance.now() - start) * 100) / 100);
    }
    assert.equal(requests.length, 6);
    assert.equal(titleRequests.length, 0);
    assert.deepEqual(errors, []);
    surfaces.push({ locale, mobile: 'Pixel 7 emulation', throttle: '4x CPU, 150ms latency, 1.6Mbps down / 750Kbps up', discoveryRequests: requests.length, titleRequests: titleRequests.length, editToResultsMs: summary(times), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), pageErrors: errors });
    await context.close();
  }
} finally { await browser.close(); }
const times = [];
for (let i = 0; i < 12; i++) {
  const start = performance.now();
  const response = await fetch(`${base}/api/movies?v=1&languages=en,fa&countries=IR,US&ratingMin=7.8&voteCountMin=200`);
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.total, 7); assert.equal(body.items.length, 7);
  assert.ok(body.items.every((m) => ['en', 'fa'].includes(m.originalLanguage) && m.countries.some((c) => ['IR', 'US'].includes(c)) && m.rating >= 7.8 && m.voteCount >= 200));
  times.push(Math.round((performance.now() - start) * 100) / 100);
}
let gzipBytes = 0;
for (const file of await readdir('apps/web/dist/_astro')) if (file.endsWith('.js')) gzipBytes += gzipSync(await readFile(`apps/web/dist/_astro/${file}`)).length;
assert.ok(gzipBytes < 150 * 1024);
const report = {
  environment: 'Linux, system Chromium, Astro production preview proxy to local Go API and PostgreSQL 18.6 Docker, unchanged 32 synthetic movies',
  baselineMainSHA: '6701181970873581bfb13151e2ca8c9ff7be599a',
  allBuiltJavaScriptGzipBytes: gzipBytes, baselineMainJavaScriptGzipBytes: 120686, deltaJavaScriptGzipBytes: gzipBytes - 120686,
  surfaces, api: { firstObservedMs: times[0], warmElapsedMs: summary(times.slice(1)), scope: 'Sequential unthrottled HTTP through local preview proxy; already running Go process and warm database, no browser HTTP cache.' },
  limitations: ['Local shared runner lab only; no deployment, Neon wake-up, Iranian network or field p75 measurement.', 'Browser samples include Playwright input, scrolling, transport and assertion overhead, with six distinct uncached combinations per locale.', 'Small sample and 32 movies do not establish scalability, LCP, INP or CLS.'],
};
await writeFile('docs/verification/advanced-filters.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
