import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { readCatalogInput } from './scripts/catalog-input.mjs';
import { copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.env.BETTER_MOVIE_BUILD_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const input = readCatalogInput();
const real = input.catalogRevision !== 'synthetic-v1';
if (real && process.env.TMDB_APPROVED_LOGO) copyFileSync(process.env.TMDB_APPROVED_LOGO, new URL('./public/tmdb-logo.svg', import.meta.url));
else rmSync(new URL('./public/tmdb-logo.svg', import.meta.url), { force: true });
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  server: { host: '127.0.0.1', port: 4321 },
  integrations: [react()],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    define: { 'import.meta.env.PUBLIC_CATALOG_REVISION': JSON.stringify(input.catalogRevision) },
    plugins: [tailwind()],
    server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
    preview: { proxy: { '/api': 'http://127.0.0.1:8080' } },
  },
});
