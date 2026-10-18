import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { testHeaders } from './test-headers.mjs';
const base = process.argv[2];
if (!base) throw new Error('Pass the protected Preview URL');
const samples = [];
for (const kind of ['health', 'filter']) {
  for (let index = 0; index < 6; index++) {
    const route = kind === 'health' ? '/api/health' : '/api/movies?genres=drama&runtimeMax=110';
    const start = performance.now();
    const response = await fetch(new URL(route, base), { headers: testHeaders, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    assert.equal(response.status, 200);
    if (kind === 'health') assert.equal(body.database, 'connected');
    else {
      assert.equal(body.total, 10);
      assert.equal(body.items.length, 10);
      assert.ok(body.items.every(movie => movie.genres.includes('drama') && movie.runtime !== null && movie.runtime <= 110));
    }
    samples.push({ kind, index, elapsedMs: Math.round(performance.now()-start), status: response.status,
      cache: response.headers.get('x-vercel-cache'), age: response.headers.get('age'),
      vercelId: response.headers.get('x-vercel-id'), serverTiming: response.headers.get('server-timing') });
  }
}
const report = { timestamp: new Date().toISOString(), base, environment: { platform: os.platform(), node: process.version }, samples,
  errors: 0, scope: 'Client end-to-end, sequential, unthrottled. First health sample is first observed request; remaining five health requests are warm candidates. Filter includes edge caching when reported. No server instrumentation isolates Go initialization, SQL, or Neon wake-up.' };
await mkdir('.local', { recursive: true });
await writeFile(process.env.API_REPORT ?? '.local/remote-api.json', JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report, null, 2));
