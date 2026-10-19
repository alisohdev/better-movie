import { describe, expect, it } from 'vitest';
import { catalog, genres } from './catalog.server';
import { defaultFilters, parseFilters, serializeFilters, type Filters } from './filters';
import { recipes, recipeFilters, recoveryEdits } from './discovery-guidance';

describe('literal starting recipes', () => {
  it.each(recipes)('$id has a canonical URL and real fixture matches', (recipe) => {
    const filters = recipeFilters(recipe);
    expect(parseFilters(serializeFilters(filters), genres)).toEqual({ kind: 'valid', filters });
    expect(filters.page).toBe(1);
    expect(filters.sort).toBe('popularity');
    const matches = catalog.movies.filter((movie) =>
      (filters.runtimeMax === null || (movie.runtime !== null && movie.runtime <= filters.runtimeMax)) &&
      (filters.yearMin === null || (movie.year !== null && movie.year >= filters.yearMin)) &&
      (filters.yearMax === null || (movie.year !== null && movie.year <= filters.yearMax)) &&
      (!filters.genres.length || filters.genres.some((genre) => movie.genres.includes(genre))) &&
      !filters.excludeGenres.some((genre) => movie.genres.includes(genre)));
    expect(matches.length).toBeGreaterThan(0);
    expect(recipe.en.length).toBeGreaterThan(0);
    expect(recipe.fa).toMatch(/[\u0600-\u06ff]/);
  });
  it('constructs fresh selections without carrying previous filters', () => {
    const first = recipeFilters(recipes.find((recipe) => recipe.id === 'short')!);
    first.languages.push('fa');
    expect(recipeFilters(recipes.find((recipe) => recipe.id === 'short')!).languages).toEqual([]);
  });
});

describe('explicit recovery edits', () => {
  const base: Filters = { ...defaultFilters(), languages: ['ja'], countries: ['IR'], genres: ['drama'], excludeGenres: ['horror', 'thriller'], yearMin: 1990, yearMax: 1999, runtimeMin: 90, runtimeMax: 100, ratingMin: 9.5, voteCountMin: 1000, genreMode: 'all', sort: 'rating', page: 4 };
  it.each(['en', 'fa'] as const)('%s offers at most two single edits without changing other constraints', (locale) => {
    const edits = recoveryEdits(base, locale);
    expect(edits.map((edit) => edit.id)).toEqual(['runtimeMax', 'runtimeMin']);
    for (const edit of edits) {
      expect(edit.filters).toEqual({ ...base, [edit.id]: null, page: 1 });
      expect(parseFilters(serializeFilters(edit.filters), genres).kind).toBe('valid');
      expect(edit.label).toContain(locale === 'fa' ? 'زمان فیلم' : 'runtime');
    }
    expect(base.runtimeMax).toBe(100);
  });
  it('removes only the named exclusion, retaining scores and other exclusions', () => {
    const filters = { ...base, runtimeMin: null, runtimeMax: null, yearMin: null, yearMax: null };
    const edits = recoveryEdits(filters, 'en');
    expect(edits.map((edit) => edit.label)).toEqual(['Stop excluding Horror', 'Stop excluding Thriller']);
    expect(edits[0]!.filters).toEqual({ ...filters, excludeGenres: ['thriller'], page: 1 });
  });
  it.each(['genres', 'languages', 'countries', 'ratingMin', 'voteCountMin'] as const)('names an isolated %s edit, including zero thresholds', (key) => {
    const value = key === 'genres' ? ['drama', 'comedy'] : key === 'languages' ? ['fa', 'en'] : key === 'countries' ? ['IR', 'US'] : 0;
    const filters = { ...defaultFilters(), [key]: value, sort: 'newest', page: 3 } satisfies Filters;
    const edits = recoveryEdits(filters, 'en');
    expect(edits).toHaveLength(1);
    expect(edits[0]!.id).toBe(key);
    expect(edits[0]!.filters).toEqual({ ...filters, [key]: Array.isArray(value) ? [] : null, page: 1 });
    expect(edits[0]!.label).toMatch(/Clear|Remove/);
    expect(recoveryEdits(filters, 'fa')[0]!.label).not.toMatch(/[a-z]/i);
  });
  it('does not invent edits when no constraints are active', () => {
    expect(recoveryEdits(defaultFilters(), 'en')).toEqual([]);
  });
});
