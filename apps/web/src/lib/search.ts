import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from './api';
import { qk } from './query';
import type { SearchResponse } from './search/types';

const DEBOUNCE_MS = 150;

/** Returns a value that lags `value` by DEBOUNCE_MS — used to coalesce
 *  fast keystrokes into one query. */
function useDebounced<T>(value: T, ms = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Search hook. Internally debounces the query so each keystroke doesn't
 *  fire a request. Returns the previous result while a new one is in flight,
 *  so the UI doesn't flash empty while typing. */
export function useSearch(slug: string | undefined, rawQuery: string) {
  const query = useDebounced(rawQuery.trim());
  return useQuery({
    queryKey: slug ? qk.projects.search(slug, query) : ['search', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/search', {
        params: { path: { slug: slug ?? '' }, query: { q: query } },
      });
      if (error || !data) throw new Error('search failed');
      return data as unknown as SearchResponse;
    },
    placeholderData: keepPreviousData,
  });
}
