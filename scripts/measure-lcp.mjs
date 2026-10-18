import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import { chromium, expect } from '@playwright/test';
import { testHeaders } from './test-headers.mjs';

// Repeat --target=label,URL to interleave equivalent fresh-context samples.
const args = process.argv.slice(2);
const targets = args.filter(arg => arg.startsWith('--target=')).map(arg => {
  const value = arg.slice('--target='.length);
  const comma = value.indexOf(',');
  assert.ok(comma > 0, 'Use --target=label,URL');
  const label = value.slice(0, comma);
  assert.match(label, /^[a-z0-9-]+$/);
  return { label, base: new URL(value.slice(comma + 1)).origin };
});
assert.ok(targets.length, 'At least one --target=label,URL is required');
const samples = Number(args.find(arg => arg.startsWith('--samples='))?.split('=')[1] ?? 5);
assert.ok(Number.isInteger(samples) && samples > 0 && samples <= 20);
const trace = args.includes('--trace');
const output = args.find(arg => arg.startsWith('--output='))?.slice('--output='.length) ?? '.local/lcp';
await mkdir(output, { recursive: true });
const settings = { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', cpuRate: 4, latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 93750 };
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const observations = [];
try {
  for (let sample = 1; sample <= samples; sample++) {
    for (const target of targets) {
      const context = await browser.newContext({ viewport: settings.viewport, reducedMotion: settings.reducedMotion, extraHTTPHeaders: testHeaders });
      try {
        const page = await context.newPage();
        const errors = [];
        const badResponses = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
        await page.addInitScript(() => {
          window.__lcpLab = { candidates: [], cls: 0, longTasks: [] };
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              const el = entry.element;
              window.__lcpLab.candidates.push({ time: entry.startTime, renderTime: entry.renderTime, loadTime: entry.loadTime, size: entry.size, url: entry.url,
                element: el ? { tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 160), src: el.currentSrc, rect: el.getBoundingClientRect().toJSON() } : null });
            }
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__lcpLab.cls += entry.value;
          }).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) window.__lcpLab.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }).observe({ type: 'longtask', buffered: true });
        });
        const session = await context.newCDPSession(page);
        await session.send('Network.enable');
        await session.send('Network.emulateNetworkConditions', { offline: false, latency: settings.latencyMs, downloadThroughput: settings.downloadBytesPerSecond, uploadThroughput: settings.uploadBytesPerSecond });
        await session.send('Emulation.setCPUThrottlingRate', { rate: settings.cpuRate });
        if (trace) await session.send('Tracing.start', { transferMode: 'ReturnAsStream', categories: 'devtools.timeline,v8.execute,blink.user_timing,loading,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack' });
        const response = await page.goto(new URL('/fa/discover/', target.base).href, { waitUntil: 'networkidle', timeout: 60000 });
        assert.equal(response?.status(), 200);
        await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page.getByTestId('movie-card')).toHaveCount(12);
        const metrics = await page.evaluate(() => ({ ...window.__lcpLab,
          navigation: performance.getEntriesByType('navigation')[0].toJSON(),
          resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
          paints: performance.getEntriesByType('paint').map(entry => entry.toJSON()),
          fonts: { status: document.fonts.status, faces: document.fonts.size },
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        }));
        if (args.includes('--probe-full-page')) {
          await page.screenshot({ path: `${output}/${target.label}-${sample}-full.png`, fullPage: true });
          const afterScreenshot = await page.evaluate(() => ({ ...window.__lcpLab, viewport: { width: innerWidth, height: innerHeight } }));
          metrics.screenshotProbe = afterScreenshot;
        }
        assert.ok(metrics.candidates.length, 'LCP candidate must be observed');
        assert.deepEqual(errors, []);
        assert.deepEqual(badResponses, []);
        assert.equal(metrics.horizontalOverflow, false);
        let tracePath = null;
        if (trace) {
          const complete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
          await session.send('Tracing.end');
          const { stream } = await complete;
          let contents = '';
          for (;;) {
            const chunk = await session.send('IO.read', { handle: stream });
            contents += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
            if (chunk.eof) break;
          }
          await session.send('IO.close', { handle: stream });
          // Loading traces can contain request headers. Never persist the test credential.
          for (const secret of Object.values(testHeaders)) contents = contents.replaceAll(secret, '[REDACTED]');
          tracePath = `${output}/${target.label}-${sample}.trace.json.gz`;
          await writeFile(tracePath, gzipSync(contents));
        }
        await page.screenshot({ path: `${output}/${target.label}-${sample}.png` });
        const lcp = metrics.candidates.at(-1);
        const resource = metrics.resources.find(item => item.name === lcp.url);
        const ttfb = metrics.navigation.responseStart;
        const breakdown = { ttfbMs: ttfb, resourceLoadDelayMs: resource ? Math.max(0, resource.startTime - ttfb) : 0,
          resourceLoadDurationMs: resource ? resource.responseEnd - Math.max(resource.startTime, ttfb) : 0,
          renderDelayMs: lcp.time - (resource ? resource.responseEnd : ttfb) };
        observations.push({ target: target.label, base: target.base, sample, lcpMs: lcp.time, cls: metrics.cls, breakdown, tracePath, errors, badResponses, ...metrics });
        await writeFile(`${output}/report.json`, JSON.stringify({ timestamp: new Date().toISOString(), browser: browser.version(), settings, trace,
          environment: { platform: os.platform(), cpu: os.cpus()[0]?.model, logicalCores: os.availableParallelism(), node: process.version },
          scope: 'Fresh browser context per observation; interleaved target order. CDN may remain warm. Traced runs diagnose causes only; use untraced runs for comparisons.', observations }, null, 2) + '\n');
        console.log(JSON.stringify({ target: target.label, sample, lcpMs: lcp.time, element: lcp.element, breakdown, cls: metrics.cls, tracePath }));
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
