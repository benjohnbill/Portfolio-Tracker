import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { fetchMacroContext } from './api';

const fetchMacroContextWithDataCache = unstable_cache(
  async () => fetchMacroContext(),
  ['macro-context'],
  { revalidate: 86400, tags: ['macro-context'] },
);

// React `cache()` dedupes within a single render pass; `unstable_cache`
// persists across requests with tag-based invalidation. Both are required:
// without `cache()`, each <Suspense> child would re-enter unstable_cache.
export const getMacroContextCached = cache(fetchMacroContextWithDataCache);
