import { testHeaders } from './test-headers.mjs';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const discovery = '/en/discover/?v=1&genres=drama&runtimeMax=110';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', extraHTTPHeaders: testHeaders });
  const page = await context.newPage();
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/api/movies') apiRequests.push(request.url()); });
  const resultResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/movies');
  await page.goto(new URL(discovery, base).href);
  const response = await resultResponse;
  const result = await response.json();
  if (!response.ok() || result.items.length !== 10 || !result.items.every((movie) => movie.genres.includes('drama') && movie.runtime !== null && movie.runtime <= 110)) throw new Error('Expected correct SQL-filtered starting results.');
  await expect(page.getByTestId('movie-card')).toHaveCount(10);
  const firstLink = page.getByTestId('movie-card').first().getByRole('link').first();
  const prefetched = page.waitForResponse((item) => item.url().includes('/en/movies/the-space-between/'));
  const prefetchStart = performance.now();
  await firstLink.focus();
  await (await prefetched).finished();
  const prefetchMs = performance.now() - prefetchStart;
  const samples = [];
  for (let index = 0; index < 5; index++) {
    const detailStart = performance.now();
    await firstLink.click();
    await expect(page).toHaveURL(/\/en\/movies\/the-space-between\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Space Between');
    const detailMs = performance.now() - detailStart;
    const backStart = performance.now();
    await page.goBack();
    await expect(page).toHaveURL(new URL(discovery, base).href);
    await expect(page.getByTestId('movie-card')).toHaveCount(10);
    await expect(page.getByLabel('Runtime maximum', { exact: true })).toHaveValue('110');
    samples.push({ detailMs: Math.round(detailMs), backMs: Math.round(performance.now() - backStart) });
  }
  if (errors.length || apiRequests.length !== 1) throw new Error(`Expected zero browser errors and one reused initial result: ${JSON.stringify({ errors, apiRequests: apiRequests.length })}`);
  const summary = (key) => {
    const values = samples.map((sample) => sample[key]).toSorted((a, b) => a - b);
    return { medianMs: values[2], rangeMs: [values[0], values.at(-1)] };
  };
  const report = { timestamp: new Date().toISOString(), browser: browser.version(), base, fixture: 'synthetic-v1, 32 movies', scope: 'Production deployment or local preview selected by base; one completed intentional prefetch, five warm detail/Back cycles, reduced motion, no throttling.', prefetchMs: Math.round(prefetchMs), samples, detail: summary('detailMs'), back: summary('backMs'), apiRequests: apiRequests.length, errors, limitations: ['Browser-driver and assertion overhead is included.', 'No comparative speedup, throughput, or field INP claim; remote timings include network RTT.', 'Cold starts and database wake-up are not isolated; the catalog has 32 records.', 'Prefetch body reuse and Save-Data suppression have separate browser regression tests.'] };
  await mkdir('.local', { recursive: true });
  await writeFile('.local/navigation.json', JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
  await browser.close();
}
