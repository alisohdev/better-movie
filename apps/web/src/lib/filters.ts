import { z } from 'zod';

export const sortSchema = z.enum(['popularity', 'rating', 'newest', 'runtime']);
export const modeSchema = z.enum(['any', 'all']);
const filtersSchema = z.object({
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
  return { genres: [], excludeGenres: [], genreMode: 'any', yearMin: null, yearMax: null, runtimeMin: null, runtimeMax: null, sort: 'popularity', page: 1 };
}

const allowedParams = new Set(['v', 'genres', 'excludeGenres', 'genreMode', 'yearMin', 'yearMax', 'runtimeMin', 'runtimeMax', 'sort', 'page']);
const integer = /^\d+$/;

export function parseFilters(search: string, knownGenres: string[]): FilterResult {
  const params = new URLSearchParams(search);
  const errors: string[] = [];
  for (const name of new Set(params.keys())) {
    if (!allowedParams.has(name)) errors.push(`Unknown filter: ${name}.`);
    if (params.getAll(name).length > 1) errors.push(`Filter ${name} is repeated.`);
  }
  if (params.has('v') && params.get('v') !== '1') errors.push('This filter link uses an unsupported version.');
  const list = (name: string) => {
    const raw = params.get(name);
    if (raw === null) return [];
    const values = raw.split(',');
    if (values.some((value) => !knownGenres.includes(value))) errors.push(`Unknown or empty genre in ${name}.`);
    if (new Set(values).size !== values.length) errors.push(`A genre is repeated in ${name}.`);
    return [...new Set(values)].sort();
  };
  const number = (name: string): number | null => {
    const raw = params.get(name);
    if (raw === null) return null;
    if (!integer.test(raw)) { errors.push(`${name} must be a whole number.`); return null; }
    return Number(raw);
  };
  const candidate = {
    genres: list('genres'), excludeGenres: list('excludeGenres'), genreMode: params.get('genreMode') ?? 'any',
    yearMin: number('yearMin'), yearMax: number('yearMax'), runtimeMin: number('runtimeMin'), runtimeMax: number('runtimeMax'),
    sort: params.get('sort') ?? 'popularity', page: params.has('page') ? number('page') : 1,
  };
  const result = filtersSchema.safeParse(candidate);
  if (!result.success) errors.push(...result.error.issues.map((issue) => issue.message));
  return errors.length || !result.success ? { kind: 'invalid', errors } : { kind: 'valid', filters: result.data };
}

export function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams({ v: '1' });
  if (filters.genres.length) params.set('genres', [...filters.genres].sort().join(','));
  if (filters.excludeGenres.length) params.set('excludeGenres', [...filters.excludeGenres].sort().join(','));
  if (filters.genreMode !== 'any') params.set('genreMode', filters.genreMode);
  for (const name of ['yearMin', 'yearMax', 'runtimeMin', 'runtimeMax'] satisfies (keyof Filters)[]) {
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
