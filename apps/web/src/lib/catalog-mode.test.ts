import { describe, expect, it } from 'vitest';
import { CATALOG_REVISION, movieTitle, resultsSchema } from './model';
import { catalog } from './catalog.server';

describe('catalog source isolation', () => {
  it('treats blank Persian text as absent and retains English fallback', () => {
    expect(movieTitle({ titleEn: 'Self-authored test', titleFa: '  ' }, 'fa')).toBe('Self-authored test');
  });
  it('rejects another revision and provider records in a synthetic browser build', () => {
    const sample = catalog.movies[0]!;
    const page = { items: [sample], total: 1, page: 1, pageSize: 12, catalogRevision: CATALOG_REVISION };
    expect(resultsSchema.safeParse(page).success).toBe(true);
    expect(resultsSchema.safeParse({ ...page, catalogRevision: 'tmdb-other' }).success).toBe(false);
    expect(resultsSchema.safeParse({ ...page, items: [{ ...sample, synthetic: false, source: 'TMDB' }] }).success).toBe(false);
  });
});
