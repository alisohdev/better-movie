import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'always' },
  server: { host: '127.0.0.1', port: 4321 },
  integrations: [react()],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    plugins: [tailwind()],
    server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
    preview: { proxy: { '/api': 'http://127.0.0.1:8080' } },
  },
});
