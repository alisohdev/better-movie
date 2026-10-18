import { QueryClient, queryOptions } from '@tanstack/react-query';
import { CATALOG_REVISION, resultsSchema } from './model';
import { serializeFilters, type Filters } from './filters';

let browserClient: QueryClient | undefined;
const MAX_INACTIVE_RESULTS = 8;

export function getQueryClient() {
  if (typeof window !== 'undefined' && browserClient) return browserClient;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 300_000, retry: false, refetchOnWindowFocus: false } } });
  if (typeof window !== 'undefined') {
    browserClient = client;
    client.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' && event.type !== 'observerRemoved') return;
      const inactive = client.getQueryCache().findAll({ queryKey: ['movies', CATALOG_REVISION], type: 'inactive', fetchStatus: 'idle' })
        .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
      for (const query of inactive.slice(MAX_INACTIVE_RESULTS)) client.removeQueries({ queryKey: query.queryKey, exact: true });
    });
  }
  return client;
}

export function movieQuery(filters: Filters) {
  const canonical = serializeFilters(filters);
  return queryOptions({
    queryKey: ['movies', CATALOG_REVISION, canonical],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/movies?${canonical}`, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(response.status === 400 ? 'The server rejected these filters.' : 'The catalog could not be reached.');
      return resultsSchema.parse(await response.json());
    },
    staleTime: 60_000,
  });
}
