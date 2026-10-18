import { chromium } from '@playwright/test';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, channel: process.env.PLAYWRIGHT_CHANNEL });
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values, median: sorted[Math.floor(sorted.length / 2)], range: [sorted[0], sorted.at(-1)] };
};
const surfaces = [];
await mkdir('.local/screenshots', { recursive: true });
for (const mobile of [false, true]) {
  for (const locale of ['en', 'fa']) {
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/titles') requests.push(r.url()); });
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.goto(`${base}/${locale}/discover/`, { waitUntil: 'networkidle' });
    if (requests.length) throw new Error('Title lookup requested before input');
    const input = page.getByRole('combobox', { name: locale === 'fa' ? 'جست‌وجوی عنوان فیلم' : 'Search movie titles' });
    await input.scrollIntoViewIfNeeded();
    await input.click();
    const noticeTop = await page.locator('.catalog-notice').evaluate((e) => e.getBoundingClientRect().top);
    const times = [];
    for (const query of ['the', 'orbit', 'paper', 'last', 'space']) {
      const result = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/titles' && new URL(r.url()).searchParams.get('q') === query);
      const start = performance.now();
      await input.fill(query);
      const response = await result;
      const body = await response.json();
      if (!response.ok() || !body.items.length || body.items.length > 6) throw new Error('Unsuccessful/unbounded lookup');
      await page.getByRole('listbox').getByRole('option').first().waitFor();
      times.push(Math.round((performance.now() - start) * 100) / 100);
      if (query === 'the') await page.screenshot({ path: `.local/screenshots/title-${mobile ? 'mobile' : 'desktop'}-${locale}.png` });
    }
    const displacement = await page.locator('.catalog-notice').evaluate((e, top) => e.getBoundingClientRect().top - top, noticeTop);
    if (errors.length || requests.length !== 5 || displacement !== 0) throw new Error(`Browser errors, extra requests or collection movement: ${JSON.stringify({ errors, requests: requests.length, displacement })}`);
    surfaces.push({ locale, mobile, throttle: mobile ? '4x CPU, 150ms RTT, 1.6Mbps down' : 'none', titleRequests: requests.length, inputToSuggestionsMs: summary(times), collectionDisplacementPx: displacement, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), pageErrors: errors });
    await context.close();
  }
}
await browser.close();
const timings = [], bytes = [];
for (let i = 0; i < 5; i++) {
  const start = performance.now();
  const response = await fetch(`${base}/api/titles?q=the&v=1`, { headers: { 'Cache-Control': 'no-cache' } });
  const text = await response.text();
  const payload = JSON.parse(text);
  if (!response.ok || payload.items.length !== 6) throw new Error('API timing did not return six suggestions');
  timings.push(Math.round((performance.now() - start) * 100) / 100);
  bytes.push(Buffer.byteLength(text));
}
let gzipBytes = 0;
for (const name of await readdir('apps/web/dist/_astro')) {
  if (name.endsWith('.js')) gzipBytes += gzipSync(await readFile(`apps/web/dist/_astro/${name}`)).length;
}
const report = {
  environment: { platform: os.platform(), cpu: os.cpus()[0]?.model, node: process.version, postgres: '18 local Docker', catalog: '32 owned synthetic movies, synthetic-v1', build: 'Astro production output, local Go API via preview proxy' },
  allBuiltJavaScriptGzipBytes: gzipBytes,
  baselineMainJavaScriptGzipBytes: 118979,
  deltaJavaScriptGzipBytes: gzipBytes - 118979,
  surfaces,
  api: { scope: 'five successful warm local HTTP + Go + PostgreSQL responses, no HTTP response cache', elapsedMs: summary(timings), responseBytes: bytes },
  limitations: ['Local lab only; no deployment, Neon wake-up, Iranian network or field p75 measurement.', 'Browser timings include the intentional 200ms debounce and Playwright driver/assertion overhead.', 'Five samples per surface and 32 movies do not establish catalog scalability or robust INP.', 'Collection displacement is measured within an interaction; it is not a page-level CLS measurement.'],
};
await writeFile('docs/verification/title-lookup.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
