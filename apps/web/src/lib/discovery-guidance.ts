import { defaultFilters, type Filters } from './filters';
import { copy, genreName, type Locale } from './model';

// Literal starting points, not recommendations. Applying one replaces the selection.
export const recipes = [
  { id: 'short', en: '100 minutes or less', fa: '۱۰۰ دقیقه یا کمتر', filters: { runtimeMax: 100 } },
  { id: 'thriller', en: 'Thrillers, without horror', fa: 'دلهره‌آور، بدون ترسناک', filters: { genres: ['thriller'], excludeGenres: ['horror'] } },
  { id: 'nineties', en: 'From 1990 to 1999', fa: 'از ۱۹۹۰ تا ۱۹۹۹ میلادی', filters: { yearMin: 1990, yearMax: 1999 } },
] satisfies { id: string; en: string; fa: string; filters: Partial<Filters> }[];

export function recipeFilters(recipe: typeof recipes[number]): Filters {
  return { ...defaultFilters(), ...recipe.filters };
}

export interface RecoveryEdit { id: string; label: string; filters: Filters; }

// No speculative requests or fixture scan. Each option removes exactly one named
// constraint and starts at page one; all other constraints and sorting survive.
// These are possible next edits, never promises that the edit will find a match.
export function recoveryEdits(filters: Filters, locale: Locale): RecoveryEdit[] {
  const edits: RecoveryEdit[] = [];
  const number = (value: number) => new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
  const add = (id: string, label: string, change: Partial<Filters>) => edits.push({ id, label, filters: { ...filters, ...change, page: 1 } });
  if (filters.runtimeMax !== null) add('runtimeMax', copy(locale, `Remove maximum runtime (${number(filters.runtimeMax)} min)`, `حذف حداکثر زمان فیلم (${number(filters.runtimeMax)} دقیقه)`), { runtimeMax: null });
  if (filters.runtimeMin !== null) add('runtimeMin', copy(locale, `Remove minimum runtime (${number(filters.runtimeMin)} min)`, `حذف حداقل زمان فیلم (${number(filters.runtimeMin)} دقیقه)`), { runtimeMin: null });
  if (filters.yearMax !== null) add('yearMax', copy(locale, `Remove latest year (${number(filters.yearMax)})`, `حذف سال پایان (${number(filters.yearMax)})`), { yearMax: null });
  if (filters.yearMin !== null) add('yearMin', copy(locale, `Remove earliest year (${number(filters.yearMin)})`, `حذف سال آغاز (${number(filters.yearMin)})`), { yearMin: null });
  for (const genre of filters.excludeGenres) add(`exclude:${genre}`, copy(locale, `Stop excluding ${genreName(genre, locale)}`, `حذف محدودیت ژانر ${genreName(genre, locale)}`), { excludeGenres: filters.excludeGenres.filter((value) => value !== genre) });
  // Removing one included genre from an ANY selection could narrow it. Clear the
  // named selection instead, preserving genre mode for the next deliberate edit.
  if (filters.genres.length) add('genres', copy(locale, 'Clear included genres', 'پاک کردن ژانرهای دلخواه'), { genres: [] });
  if (filters.languages.length) add('languages', copy(locale, 'Clear original-language selection', 'پاک کردن انتخاب زبان اصلی'), { languages: [] });
  if (filters.countries.length) add('countries', copy(locale, 'Clear production-country selection', 'پاک کردن انتخاب کشور تولیدکننده'), { countries: [] });
  if (filters.ratingMin !== null) add('ratingMin', copy(locale, `Remove minimum score (${number(filters.ratingMin)})`, `حذف حداقل امتیاز (${number(filters.ratingMin)})`), { ratingMin: null });
  if (filters.voteCountMin !== null) add('voteCountMin', copy(locale, `Remove minimum vote count (${number(filters.voteCountMin)})`, `حذف حداقل تعداد رأی (${number(filters.voteCountMin)})`), { voteCountMin: null });
  return edits.slice(0, 2);
}
