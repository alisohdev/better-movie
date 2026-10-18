import { describe, expect, it } from 'vitest';
import { defaultFilters, parseFilters, parseRangeDraft, serializeFilters } from './filters';

const genres = ['drama', 'thriller', 'horror'];
describe('shareable discovery filters', () => {
  it('round trips every supported constraint with stable order', () => {
    const filters = { ...defaultFilters(), genres: ['thriller', 'drama'], excludeGenres: ['horror'], genreMode: 'all', yearMin: 1990, yearMax: 2024, runtimeMin: 80, runtimeMax: 120, sort: 'rating', page: 2 };
    const parsed = parseFilters('v=1&sort=rating&genres=thriller,drama&excludeGenres=horror&genreMode=all&yearMin=1990&yearMax=2024&runtimeMin=80&runtimeMax=120&page=2', genres);
    expect(parsed.kind).toBe('valid');
    if (parsed.kind === 'valid') expect(serializeFilters(parsed.filters)).toBe(serializeFilters({ ...filters, genreMode: 'all', sort: 'rating' }));
  });
  it.each([
    'yearMin=2025&yearMax=1990', 'runtimeMin=120&runtimeMax=90', 'genres=drama&excludeGenres=drama',
    'genres=unknown', 'yearMin=20.5', 'yearMax=', 'runtimeMax=-1', 'sort=personalized', 'page=0', 'page=1&page=2',
    'yearMin=1887', 'runtimeMax=601', 'title=hello', 'v=2', 'genres=drama,drama', 'genres=',
  ])('rejects malformed links without broadening: %s', (search) => {
    expect(parseFilters(search, genres).kind).toBe('invalid');
  });
  it('treats cleared numeric inputs as absent but preserves exclusions', () => {
    const result = parseRangeDraft({ yearMin: '', yearMax: '', runtimeMin: '', runtimeMax: '100' }, { ...defaultFilters(), excludeGenres: ['horror'], yearMin: 2000, page: 3 }, genres);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') expect(result.filters).toMatchObject({ excludeGenres: ['horror'], yearMin: null, runtimeMax: 100, page: 1 });
  });
});
