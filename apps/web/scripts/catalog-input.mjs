import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const moduleRoot = fileURLToPath(new URL('../../../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');

// Build-time only. Neither this module nor the private artifact enters a client import.
export function readCatalogInput(env = process.env) {
  const root = env.BETTER_MOVIE_BUILD_ROOT || moduleRoot;
  if (!env.CATALOG_FILE) return JSON.parse(readFileSync(resolve(root, 'catalog/movies.json'), 'utf8'));
  const file = readFileSync(resolve(root, env.CATALOG_FILE), 'utf8');
  if (Buffer.byteLength(file) > 4 * 1024 * 1024) throw new Error('Catalog artifact exceeds build bound');
  const artifact = JSON.parse(file);
  if (typeof artifact.projection !== 'string' || artifact.catalogRevision !== `tmdb-${hash(artifact.projection)}` || artifact.sampleHash !== hash(readFileSync(resolve(root, 'docs/audit/sample.json')))) throw new Error('Catalog artifact revision/sample mismatch');
  if (env.VERCEL && (env.TMDB_PUBLICATION_APPROVED !== '1' || !env.TMDB_APPROVED_LOGO)) throw new Error('Real-data publication and approved-logo gates are closed');
  const movies = JSON.parse(artifact.projection);
  const today = new Date().toISOString().slice(0, 10);
  if (!Array.isArray(movies) || !movies.length || movies.length > 40 || new Set(movies.map(m => m.id)).size !== movies.length) throw new Error('Incomplete catalog artifact');
  for (const m of movies) {
    if (m.synthetic !== false || m.source !== 'TMDB' || m.synopsisEn !== '' || m.synopsisFa !== null || m.poster !== '/posters/placeholder.svg' || !Array.isArray(m.releaseObservations) || m.releaseObservations.length || !m.provenance || m.id !== `tmdb-${m.provenance.providerId}` || !/^\d{4}-\d{2}-\d{2}$/.test(m.provenance.retainUntil) || m.provenance.retainUntil < today) throw new Error('Catalog projection violates staging/retention boundary');
  }
  return { catalogRevision: artifact.catalogRevision, notice: 'TMDB metadata · private staging catalog', movies };
}
