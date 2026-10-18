import { z } from 'zod';
import type { Locale } from './model';
import { languageCodes, countryCodes } from './discovery-options';

export const sortSchema = z.enum(['popularity', 'rating', 'newest', 'runtime']);
export const modeSchema = z.enum(['any', 'all']);
const filtersSchema = z.object({
  languages: z.array(z.string()),
  countries: z.array(z.string()),
  ratingMin: z.number().min(0).max(10).nullable(),
  voteCountMin: z.number().int().min(0).max(2147483647).nullable(),
  genres: z.array(z.string()),
  excludeGenres: z.array(z.string()),
  genreMode: modeSchema,
  yearMin: z.number().int().min(1888).max(2100).nullable(),
  yearMax: z.number().int().min(1888).max(2100).nullable(),
  runtimeMin: z.number().int().min(1).max(600).nullable(),
  runtimeMax: z.number().int().min(1).max(600).nullable(),
  sort: sortSchema,
  page: z.number().int().min(1).max(10000),
}).strict().superRefine((value, ctx) => {
  if (value.yearMin !== null && value.yearMax !== null && value.yearMin > value.yearMax) {
    ctx.addIssue({ code: 'custom', message: 'The first year must not be after the last year.' });
  }
  if (value.runtimeMin !== null && value.runtimeMax !== null && value.runtimeMin > value.runtimeMax) {
    ctx.addIssue({ code: 'custom', message: 'Minimum runtime must not exceed maximum runtime.' });
  }
  if (value.genres.some((genre) => value.excludeGenres.includes(genre))) {
    ctx.addIssue({ code: 'custom', message: 'A genre cannot be included and excluded.' });
  }
});

export type Filters = z.infer<typeof filtersSchema>;
export type FilterResult = { kind: 'valid'; filters: Filters } | { kind: 'invalid'; errors: string[] };

export function defaultFilters(): Filters {
  return { languages: [], countries: [], ratingMin: null, voteCountMin: null, genres: [], excludeGenres: [], genreMode: 'any', yearMin: null, yearMax: null, runtimeMin: null, runtimeMax: null, sort: 'popularity', page: 1 };
}

const allowedParams = new Set(['languages', 'countries', 'ratingMin', 'voteCountMin', 'v', 'genres', 'excludeGenres', 'genreMode', 'yearMin', 'yearMax', 'runtimeMin', 'runtimeMax', 'sort', 'page']);
const integer = /^\d+$/;

export function parseFilters(search: string, knownGenres: string[]): FilterResult {
  const params = new URLSearchParams(search);
  const errors: string[] = [];
  if (new TextEncoder().encode(search.replace(/^\?/, "")).length > 4096) errors.push("The filter link is too long.");
  try { decodeURIComponent(search.replace(/\+/g, " ")); } catch { errors.push("The query string is malformed."); }
  if (search.includes(";")) errors.push("The query string is malformed.");
  for (const name of new Set(params.keys())) {
    if (!allowedParams.has(name)) errors.push(`Unknown filter: ${name}.`);
    if (params.getAll(name).length > 1) errors.push(`Filter ${name} is repeated.`);
  }
  if (params.has('v') && params.get('v') !== '1') errors.push('This filter link uses an unsupported version.');
  const list = (name: string, supported = knownGenres) => {
    const raw = params.get(name);
    if (raw === null) return [];
    const values = raw.split(',');
    if (values.some((value) => !supported.includes(value))) errors.push(`Unknown or empty code in ${name}.`);
    if (new Set(values).size !== values.length) errors.push(`A code is repeated in ${name}.`);
    return [...new Set(values)].sort();
  };
  const number = (name: string): number | null => {
    const raw = params.get(name);
    if (raw === null) return null;
    if (!(name === 'ratingMin' ? /^\d+(?:\.\d+)?$/ : integer).test(raw)) { errors.push(name === 'ratingMin' ? 'ratingMin must be a decimal score from 0 to 10.' : `${name} must be a whole number.`); return null; }
    return Number(raw);
  };
  const candidate = {
    languages: list('languages', languageCodes), countries: list('countries', countryCodes), ratingMin: number('ratingMin'), voteCountMin: number('voteCountMin'),
    genres: list('genres'), excludeGenres: list('excludeGenres'), genreMode: params.get('genreMode') ?? 'any',
    yearMin: number('yearMin'), yearMax: number('yearMax'), runtimeMin: number('runtimeMin'), runtimeMax: number('runtimeMax'),
    sort: params.get('sort') ?? 'popularity', page: params.has('page') ? number('page') : 1,
  };
  const result = filtersSchema.safeParse(candidate);
  if (!result.success) errors.push(...result.error.issues.map((issue) => issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message));
  return errors.length || !result.success ? { kind: 'invalid', errors } : { kind: 'valid', filters: result.data };
}

export function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams({ v: '1' });
  for (const name of ['languages', 'countries'] as const) {
    if (filters[name].length) params.set(name, [...filters[name]].sort().join(','));
  }
  if (filters.genres.length) params.set('genres', [...filters.genres].sort().join(','));
  if (filters.excludeGenres.length) params.set('excludeGenres', [...filters.excludeGenres].sort().join(','));
  if (filters.genreMode !== 'any') params.set('genreMode', filters.genreMode);
  for (const name of ['yearMin', 'yearMax', 'runtimeMin', 'runtimeMax', 'ratingMin', 'voteCountMin'] satisfies (keyof Filters)[]) {
    const value = filters[name];
    if (value !== null) params.set(name, String(value));
  }
  if (filters.sort !== 'popularity') params.set('sort', filters.sort);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}

export function isDefaultFilters(filters: Filters) {
  return serializeFilters(filters) === 'v=1';
}

export function parseRangeDraft(values: { yearMin: string; yearMax: string; runtimeMin: string; runtimeMax: string }, current: Filters, genres: string[]): FilterResult {
  const params = new URLSearchParams(serializeFilters({ ...current, page: 1 }));
  for (const [name, value] of Object.entries(values)) {
    if (value.trim() === '') params.delete(name);
    else params.set(name, value.trim());
  }
  return parseFilters(params.toString(), genres);
}

// Invalid shared links must explain the correction in the interface language.
export function filterErrorText(error: string, locale: Locale): string {
  if (locale === 'en') return error;
  if (error.includes('languages')) return 'زبان‌های اصلی باید از گزینه‌های پشتیبانی‌شده و بدون تکرار انتخاب شوند.';
  if (error.includes('countries')) return 'کشورهای تولیدکننده باید از گزینه‌های پشتیبانی‌شده و بدون تکرار انتخاب شوند.';
  if (error.includes('ratingMin')) return 'حداقل امتیاز باید عددی از ۰ تا ۱۰ باشد و فقط یک بار تعیین شود.';
  if (error.includes('voteCountMin')) return 'حداقل تعداد رأی باید عدد صحیحی از ۰ تا ۲۱۴۷۴۸۳۶۴۷ باشد و فقط یک بار تعیین شود.';
  if (error.includes('version')) return 'نسخهٔ این پیوند پشتیبانی نمی‌شود.';
  if (error.includes('too long')) return 'این پیوند بیش از حد طولانی است.';
  if (error.includes('malformed')) return 'ساختار پیوند نامعتبر است.';
  return 'فیلترهای پیوند را بررسی کن؛ هر فیلتر باید فقط یک بار، با مقدار معتبر و بدون بازهٔ متناقض تعیین شود.';
}
