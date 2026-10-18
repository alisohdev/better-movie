import { testHeaders } from './test-headers.mjs';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
await mkdir('.local/screenshots', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const observations = [];
for (let sample = 0; sample < 5; sample++) {
for (const surface of [
  { name: 'desktop-en', locale: 'en', width: 1440, height: 1000, throttle: false },
  { name: 'mobile-fa', locale: 'fa', width: 390, height: 844, throttle: true },
]) {
  const context = await browser.newContext({ viewport: { width: surface.width, height: surface.height }, reducedMotion: 'reduce', extraHTTPHeaders: testHeaders });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__lab = { lcpMs: null, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lab.lcpMs = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__lab.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  if (surface.throttle) {
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto(new URL(`/${surface.locale}/discover/`, base).href, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `.local/screenshots/${surface.name}.png`, fullPage: true });
  observations.push({ sample: sample + 1, surface: surface.name, scope: surface.throttle ? 'fresh browser context, 4x CPU, 150ms latency, 1.6Mbps down' : 'fresh browser context, unthrottled', errors, ...await page.evaluate(() => ({ ...window.__lab, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, resourceRequests: performance.getEntriesByType('resource').length, jsResources: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('.js')).length })) });
  await context.close();
}
}
await browser.close();

const js = [];
for (const name of await readdir('apps/web/dist/_astro')) {
  if (!name.endsWith('.js')) continue;
  const bytes = await readFile(path.join('apps/web/dist/_astro', name));
  js.push({ name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
}
const timings = [];
for (let sample = 0; sample < 5; sample++) {
  const start = performance.now();
  const response = await fetch(new URL('/api/movies?genres=drama&runtimeMax=110', base), { headers: { ...testHeaders, 'Cache-Control': 'no-cache' } });
  const body = await response.json();
  if (!response.ok || !Array.isArray(body.items) || !body.items.length || !body.items.every((movie) => movie.genres.includes('drama') && movie.runtime !== null && movie.runtime <= 110)) throw new Error('Timing sample did not perform the correct successful filtering work');
  timings.push(Math.round((performance.now() - start) * 100) / 100);
}
const sorted = timings.toSorted((a, b) => a - b);
const report = {
  timestamp: new Date().toISOString(), base, build: 'Astro production static output; endpoint selected by base', fixture: '32 owned synthetic movies, synthetic-v1',
  environment: { platform: os.platform(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCores: os.availableParallelism(), memoryGiB: Math.round(os.totalmem() / 1024 ** 3), node: process.version },
  observations, js, totalBuiltJsGzipBytes: js.reduce((sum, file) => sum + file.gzipBytes, 0),
  filter: { successfulSamples: 5, failures: 0, elapsedMs: timings, medianMs: sorted[2], rangeMs: [sorted[0], sorted.at(-1)] },
  limitations: ['Lab only, not field p75. Five fresh-context samples per viewport; host may remain warm.', 'INP not established by this capture.', 'Function cold starts and Neon wake-up cannot be isolated by this script. Iranian network and catalog scalability not established.', 'Timing includes HTTP, network, possible edge cache, SQL and JSON; bottleneck not profiled, so no comparative speedup claim.', 'Other development processes may share this workstation.'],
};
await writeFile('.local/performance.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ report: '.local/performance.json', screenshots: observations.map((item) => `.local/screenshots/${item.surface}.png`), totalBuiltJsGzipBytes: report.totalBuiltJsGzipBytes, filter: report.filter }, null, 2) + '\n');
