import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { qk } from './query';
import type { SearchResponse } from './search/types';

const DEBOUNCE_MS = 150;

async function mockGet<T>(path: string): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    headers: { authorization: 'Bearer mock' },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

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
    queryFn: () =>
      mockGet<SearchResponse>(
        `/projects/${encodeURIComponent(slug ?? '')}/search?q=${encodeURIComponent(query)}`,
      ),
    placeholderData: keepPreviousData,
  });
}
