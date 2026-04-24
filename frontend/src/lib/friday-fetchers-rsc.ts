/**
 * Server-only RSC fetchers for the Friday surface.
 *
 * Wraps shared fetch functions from `./api` with React's `cache()` primitive
 * so multiple RSC children in the same render pass share one backend call.
 * This solves the D3 issue where FridayReportSection + FridaySleeveSection
 * both needed `getFridayCurrent()` and hit the backend twice.
 *
 * Import these in RSC async children (server components). Do NOT import in
 * client components — `cache()` is server-only.
 */

import 'server-only';
import { cache } from 'react';

import { getFridayCurrent, getFridaySleeveHistory, getFridaySnapshots } from './api';

export const getFridayCurrentCached = cache(getFridayCurrent);
export const getFridaySleeveHistoryCached = cache(getFridaySleeveHistory);
export const getFridaySnapshotsCached = cache(getFridaySnapshots);
