import { z } from 'zod';
import { readCatalogInput } from '../../scripts/catalog-input.mjs';
import { CATALOG_REVISION, PAGE_SIZE, movieSchema, type MovieResults } from './model';

// This module is imported only by Astro frontmatter; the full fixture never enters a client bundle.
export const catalog = z.object({
  catalogRevision: z.literal(CATALOG_REVISION),
  notice: z.string(),
  movies: CATALOG_REVISION === 'synthetic-v1' ? z.array(movieSchema).length(32) : z.array(movieSchema).min(1).max(40),
}).strict().parse(readCatalogInput());

export const genres = [...new Set(catalog.movies.flatMap((movie) => movie.genres))].sort();
export const initialResults: MovieResults = {
  items: [...catalog.movies].sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id)).slice(0, PAGE_SIZE),
  total: catalog.movies.length,
  page: 1,
  pageSize: PAGE_SIZE,
  catalogRevision: CATALOG_REVISION,
};
