/**
 * Server-only RSC fetchers for the Intelligence surface.
 *
 * Wraps shared fetch functions from `./api` with React's `cache()` primitive
 * so multiple RSC children in the same render pass share one backend call.
 * Mirrors the Phase 1a `friday-fetchers-rsc.ts` pattern.
 *
 * Import these in RSC async children (server components) on `/intelligence`
 * and its subroutes where the same fetcher is called from multiple sections.
 * Do NOT import in client components — `cache()` is server-only.
 */

import 'server-only';
import { cache } from 'react';

import {
  getIntelligenceAttributions,
  getIntelligenceRuleAccuracy,
  getIntelligenceOutcomes,
  getIntelligenceRegimeHistory,
} from './api';

export const getIntelligenceAttributionsCached = cache(getIntelligenceAttributions);
export const getIntelligenceRuleAccuracyCached = cache(getIntelligenceRuleAccuracy);
export const getIntelligenceOutcomesCached = cache(getIntelligenceOutcomes);
export const getIntelligenceRegimeHistoryCached = cache(getIntelligenceRegimeHistory);
