import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const results = [];
async function check(path, expectedStatus, verify) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
  const value = await response.json();
  assert.equal(response.status, expectedStatus, path);
  verify(value);
  results.push({ path, status: response.status, elapsedMs: Math.round(performance.now() - start) });
}
await check('/api/health', 200, (value) => {
  assert.equal(value.database, 'connected');
  assert.equal(value.catalogRevision, 'synthetic-v1');
});
await check('/api/movies', 200, (value) => {
  assert.equal(value.total, 32);
  assert.equal(value.items.length, 12);
  assert.ok(value.items.every((movie) => movie.synthetic && movie.source === 'Synthetic studio'));
});
await check('/api/movies?genres=drama&excludeGenres=horror&runtimeMax=110&sort=runtime', 200, (value) => {
  assert.ok(value.items.length > 0);
  assert.ok(value.items.every((movie) => movie.genres.includes('drama') && !movie.genres.includes('horror') && movie.runtime !== null && movie.runtime <= 110));
  assert.deepEqual(value.items.map((movie) => movie.runtime), value.items.map((movie) => movie.runtime).toSorted((a, b) => a - b));
});
await check('/api/movies?genres=drama,comedy&genreMode=all', 200, (value) => {
  assert.ok(value.items.length > 0);
  assert.ok(value.items.every((movie) => movie.genres.includes('drama') && movie.genres.includes('comedy')));
});
await check('/api/movies?genres=horror&excludeGenres=horror', 400, (value) => assert.ok(value.error.message));
await check('/api/movies?runtimeMin=120&runtimeMax=90', 400, (value) => assert.ok(value.error.message));
await check('/api/movies?unknown=true', 400, (value) => assert.ok(value.error.message));
await check('/api/movies/the-space-between', 200, (value) => {
  assert.equal(value.movie.titleEn, 'The Space Between');
  assert.equal(value.movie.synthetic, true);
  assert.equal(value.movie.releaseObservations[0].verification, 'reported');
});
await check('/api/movies/not-a-film', 404, (value) => assert.ok(value.error.message));
process.stdout.write(JSON.stringify({ base, verdict: 'pass', checks: results, timingScope: 'single functional smoke observations, not a performance benchmark' }, null, 2) + '\n');
