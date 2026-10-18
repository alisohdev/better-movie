import { describe, expect, it } from 'vitest';
import { languageCodes, countryCodes, optionName } from './discovery-options';
import { catalog } from './catalog.server';
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

describe('advanced discovery URLs', () => {
  it('canonicalizes multi selections and preserves independent zero thresholds', () => {
    const parsed = parseFilters('v=1&languages=fa,en&countries=US,IR&ratingMin=0&voteCountMin=0&page=3', genres);
    expect(parsed.kind).toBe('valid');
    if (parsed.kind === 'valid') {
      expect(parsed.filters).toMatchObject({ languages: ['en', 'fa'], countries: ['IR', 'US'], ratingMin: 0, voteCountMin: 0, page: 3 });
      expect(parseFilters(serializeFilters(parsed.filters), genres)).toEqual(parsed);
    }
  });
  it.each(['0', '10', '8.25'])('accepts inclusive score %s without a vote floor', (score) => {
    const result = parseFilters(`ratingMin=${score}`, genres);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') expect(result.filters.voteCountMin).toBeNull();
  });
  it.each([
    'languages=xx', 'languages=EN', 'languages=en,en', 'languages=en&languages=fa', 'languages=',
    'countries=ZZ', 'countries=ir', 'countries=IR,', 'countries=IR,IR', 'countries=IR&countries=US',
    'ratingMin=-1', 'ratingMin=10.001', 'ratingMin=NaN', 'ratingMin=Infinity', 'ratingMin=1e1', 'ratingMin=',
    'ratingMin=8&ratingMin=9', 'voteCountMin=-1', 'voteCountMin=0.5', 'voteCountMin=2147483648',
    'voteCountMin=0&voteCountMin=2', 'countries=%zz', 'countries=%FF', 'ratingMin=0;page=1',
    `ratingMin=${'0'.repeat(4097)}`,
  ])('rejects malformed advanced link %s', (query) => {
    expect(parseFilters(query, genres).kind).toBe('invalid');
  });
});

it('offers every fixture language and country with human-readable bilingual names', () => {
  expect(languageCodes).toEqual([...new Set(catalog.movies.flatMap((m) => m.originalLanguage ? [m.originalLanguage] : []))].sort());
  expect(countryCodes).toEqual([...new Set(catalog.movies.flatMap((m) => m.countries))].sort());
  for (const group of ['languages', 'countries'] as const) {
    for (const code of group === 'languages' ? languageCodes : countryCodes) {
      for (const locale of ['en', 'fa'] as const) {
        expect(optionName(group, code, locale)).not.toBe(code);
        expect(optionName(group, code, locale).length).toBeGreaterThan(1);
      }
    }
  }
});
