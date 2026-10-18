import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const assets = new URL('_astro/', dist);
const scripts = [];
for (const name of await readdir(assets)) {
  if (!name.endsWith('.js')) continue;
  const content = await readFile(new URL(name, assets));
  scripts.push({ file: name, bytes: content.length, gzipBytes: gzipSync(content).length });
}
const routes = [];
for (const locale of ['en', 'fa']) {
  const html = await readFile(new URL(`${locale}/discover/index.html`, dist), 'utf8');
  const cards = (html.match(/data-testid="movie-card"/g) ?? []).length;
  if (cards !== 12) throw new Error(`${locale} discovery must contain exactly 12 server-rendered cards, found ${cards}`);
  if (html.includes('the-last-projection')) throw new Error('Discovery HTML contains a movie outside the bounded first page.');
  routes.push({ locale, htmlBytes: Buffer.byteLength(html), htmlGzipBytes: gzipSync(html).length, serverRenderedCards: cards });
}
const totalJavaScriptGzipBytes = scripts.reduce((sum, file) => sum + file.gzipBytes, 0);
if (totalJavaScriptGzipBytes > 150 * 1024) throw new Error(`All generated JavaScript exceeds the conservative 150 KiB gzip ceiling: ${totalJavaScriptGzipBytes}`);
console.log(JSON.stringify({ environment: 'local production Astro build; all generated JavaScript is a conservative route ceiling', scripts, totalJavaScriptGzipBytes, routes }, null, 2));
