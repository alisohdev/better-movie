import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readCatalogInput } from '../../apps/web/scripts/catalog-input.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');

test('default build stays owned; private staging needs matching content/sample revision and publication gate', () => {
  assert.equal(readCatalogInput({}).catalogRevision, 'synthetic-v1');
  const dir = mkdtempSync(join(tmpdir(), 'tmdb-build-'));
  try {
    // Self-authored test projection. It is not a provider observation.
    const movie = { id: 'tmdb-900000001', synthetic: false, source: 'TMDB', synopsisEn: '', synopsisFa: null, poster: '/posters/placeholder.svg', releaseObservations: [], provenance: { providerId: 900000001, retainUntil: '2099-12-31' } };
    const projection = JSON.stringify([movie]);
    const artifact = { catalogRevision: `tmdb-${hash(projection)}`, sampleHash: hash(readFileSync('docs/audit/sample.json')), projection };
    const file = join(dir, 'private.json'); writeFileSync(file, JSON.stringify(artifact));
    assert.equal(readCatalogInput({ CATALOG_FILE: file }).movies.length, 1);
    assert.throws(() => readCatalogInput({ CATALOG_FILE: file, VERCEL: '1' }), /publication/);
    writeFileSync(file, JSON.stringify({ ...artifact, projection: `${projection} ` }));
    assert.throws(() => readCatalogInput({ CATALOG_FILE: file }), /mismatch/);
    const leaked = JSON.stringify([{ ...movie, synopsisEn: 'Uncleared text' }]);
    writeFileSync(file, JSON.stringify({ ...artifact, catalogRevision: `tmdb-${hash(leaked)}`, projection: leaked }));
    assert.throws(() => readCatalogInput({ CATALOG_FILE: file }), /boundary/);
    const expired = JSON.stringify([{ ...movie, provenance: { ...movie.provenance, retainUntil: '2000-01-01' } }]);
    writeFileSync(file, JSON.stringify({ ...artifact, catalogRevision: `tmdb-${hash(expired)}`, projection: expired }));
    assert.throws(() => readCatalogInput({ CATALOG_FILE: file }), /boundary/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
