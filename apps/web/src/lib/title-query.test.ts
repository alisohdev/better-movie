import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { titleQuery } from './query-client';
import { CATALOG_REVISION, movieTitle, titleLookupSchema } from './model';

const item = { id: 'orbit-of-two', titleEn: 'Orbit of Two', titleFa: null, originalTitle: 'Orbit of Two', year: 2024 };
afterEach(() => vi.unstubAllGlobals());

describe('bounded title lookup', () => {
  it('validates the compact response, revision and safe destination IDs', () => {
    expect(titleLookupSchema.parse({ items: [item], catalogRevision: CATALOG_REVISION }).items).toHaveLength(1);
    expect(movieTitle(item, 'fa')).toBe('Orbit of Two');
    for (const items of [Array(7).fill(item), [{ ...item, id: '../unsafe' }]]) {
      expect(titleLookupSchema.safeParse({ items, catalogRevision: CATALOG_REVISION }).success).toBe(false);
    }
    expect(titleLookupSchema.safeParse({ items: [item], catalogRevision: 'future' }).success).toBe(false);
  });
  it('encodes mixed-direction input as a single parameter and reuses fresh results', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [item], catalogRevision: CATALOG_REVISION })));
    vi.stubGlobal('fetch', fetcher);
    const client = new QueryClient();
    const options = titleQuery('مدار Orbit & %_');
    await client.query(options);
    await client.query(options);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error('Expected one lookup request');
    const url = new URL(String(call[0]), 'https://example.test');
    expect(url.pathname).toBe('/api/titles');
    expect([...url.searchParams.keys()]).toEqual(['q', 'v']);
    expect(url.searchParams.get('q')).toBe('مدار Orbit & %_');
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
    client.clear();
  });
  it('aborts fetch when a lookup is canceled', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }));
    const client = new QueryClient();
    const options = titleQuery('orbit');
    const pending = client.query(options).catch(() => undefined);
    await client.cancelQueries({ queryKey: options.queryKey });
    await pending;
    expect(signal?.aborted).toBe(true);
    client.clear();
  });
});

it('bounds lookup cache independently without evicting discovery results', async () => {
  vi.stubGlobal('window', {});
  const { getQueryClient } = await import('./query-client');
  const client = getQueryClient();
  const discoveryKey = ['movies', CATALOG_REVISION, 'v=1'];
  client.setQueryData(discoveryKey, { marker: 'discovery' });
  for (let index = 0; index < 16; index++) {
    client.setQueryData(['titles', CATALOG_REVISION, `title-${index}`], { items: [item], catalogRevision: CATALOG_REVISION });
  }
  expect(client.getQueryCache().findAll({ queryKey: ['titles', CATALOG_REVISION] })).toHaveLength(8);
  expect(client.getQueryData(discoveryKey)).toEqual({ marker: 'discovery' });
  client.clear();
});
