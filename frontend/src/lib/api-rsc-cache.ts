import 'server-only';
import { cache } from 'react';

import {
  getAssetHistory as _getAssetHistory,
  getMSTRHistory as _getMSTRHistory,
  getPortfolioHistory as _getPortfolioHistory,
  getPortfolioAllocation as _getPortfolioAllocation,
  getPortfolioSummary as _getPortfolioSummary,
} from './api';

// React `cache()` dedupes within a single render pass. Wrap every
// fetcher invoked from more than one Server Component so that the
// page tree never issues two identical backend calls in one render.
export const getAssetHistoryCached = cache(_getAssetHistory);
export const getMSTRHistoryCached = cache(_getMSTRHistory);
export const getPortfolioHistoryCached = cache(_getPortfolioHistory);
export const getPortfolioAllocationCached = cache(_getPortfolioAllocation);
export const getPortfolioSummaryCached = cache(_getPortfolioSummary);
