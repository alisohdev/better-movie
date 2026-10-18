import { z } from 'zod';

export const CATALOG_REVISION = 'synthetic-v1';
export const PAGE_SIZE = 12;
export const localeSchema = z.enum(['en', 'fa']);
export type Locale = z.infer<typeof localeSchema>;

export const movieSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).brand<'MovieId'>(),
  titleEn: z.string().min(1),
  titleFa: z.string().nullable(),
  originalTitle: z.string(),
  synopsisEn: z.string(),
  synopsisFa: z.string().nullable(),
  year: z.number().int().min(1888).max(2100).nullable(),
  runtime: z.number().int().min(1).max(600).nullable(),
  rating: z.number().min(0).max(10).nullable(),
  voteCount: z.number().int().nonnegative().nullable(),
  popularity: z.number(),
  genres: z.array(z.string().regex(/^[a-z-]+$/)),
  originalLanguage: z.string().nullable(),
  countries: z.array(z.string()),
  poster: z.string().regex(/^\/posters\/[a-z0-9-]+\.svg$/),
  source: z.literal('Synthetic studio'),
  synthetic: z.literal(true),
  releaseObservations: z.array(z.object({
    eventType: z.enum(['theatrical', 'digital', 'physical']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    country: z.string(),
    source: z.string(),
    checkedAt: z.iso.datetime(),
    verification: z.enum(['reported', 'confirmed']),
  }).strict()),
}).strict();

export type Movie = z.infer<typeof movieSchema>;
export const resultsSchema = z.object({
  items: z.array(movieSchema).max(PAGE_SIZE),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.literal(PAGE_SIZE),
  catalogRevision: z.literal(CATALOG_REVISION),
}).strict();
export type MovieResults = z.infer<typeof resultsSchema>;

export function movieTitle(movie: Pick<Movie, 'titleEn' | 'titleFa'>, locale: Locale) {
  return locale === 'fa' ? movie.titleFa ?? movie.titleEn : movie.titleEn;
}

export function copy(locale: Locale, en: string, fa: string) {
  return locale === 'fa' ? fa : en;
}

export const genreNames: Record<string, { en: string; fa: string }> = {
  action: { en: 'Action', fa: 'اکشن' },
  adventure: { en: 'Adventure', fa: 'ماجراجویی' },
  animation: { en: 'Animation', fa: 'انیمیشن' },
  comedy: { en: 'Comedy', fa: 'کمدی' },
  documentary: { en: 'Documentary', fa: 'مستند' },
  drama: { en: 'Drama', fa: 'درام' },
  horror: { en: 'Horror', fa: 'ترسناک' },
  mystery: { en: 'Mystery', fa: 'معمایی' },
  romance: { en: 'Romance', fa: 'عاشقانه' },
  'science-fiction': { en: 'Science fiction', fa: 'علمی‌تخیلی' },
  thriller: { en: 'Thriller', fa: 'دلهره‌آور' },
};

export function genreName(slug: string, locale: Locale) {
  return genreNames[slug]?.[locale] ?? slug;
}

export const titleSuggestionSchema = movieSchema.pick({ id: true, titleEn: true, titleFa: true, originalTitle: true, year: true });
export type TitleSuggestion = z.infer<typeof titleSuggestionSchema>;
export const titleLookupSchema = z.object({ items: z.array(titleSuggestionSchema).max(6), catalogRevision: z.literal(CATALOG_REVISION) }).strict();
