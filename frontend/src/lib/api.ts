import type { EnvelopeStatus } from './envelope';

export interface AbsoluteHistoryPoint {
  date: string;
  absolute_wealth: number;
  invested_capital?: number;
  cash_balance?: number;
  net_cashflow?: number;
}

export interface PerformanceHistoryPoint {
  date: string;
  performance_value: number;
  benchmark_value: number;
  alpha: number;
  daily_return: number;
}

export interface PortfolioHistoryData {
  period: string;
  archive: {
    series: AbsoluteHistoryPoint[];
  };
  performance: {
    coverage_start: string | null;
    status: 'ready' | 'partial' | 'unavailable';
    series: PerformanceHistoryPoint[];
  };
}

export interface WeeklyReportEnvelope {
  status: EnvelopeStatus;
  report: WeeklyReport | null;
}

// Phase UX-1a D3 — per-panel envelopes for /friday page streaming.
// Shapes mirror what the backend returns after envelope wrapping; inner fields
// are the same keys the underlying services produce (see briefing_service /
// friday_service). The envelope adds `status` at the root and preserves shape
// across ready/unavailable so UI skeletons match loaded views.
/**
 * Envelope spreads the briefing service's inner fields at the root
 * (since, sinceDate, regimeTransitions, maturedOutcomes, alertHistory,
 * lastSnapshotComment). Other envelope types in this file NEST data
 * under a named key (e.g., `report`, `snapshots`) — briefing is the
 * exception because its service already returns a flat dict and the
 * envelope wraps via `**` spread on the backend. Do not add a field
 * named `status` to the inner briefing dict — it would collide with
 * the envelope's reserved key.
 */
export interface FridayBriefingEnvelope extends FridayBriefingData {
  status: EnvelopeStatus;
}

export interface FridaySleeveHistoryEnvelope {
  status: EnvelopeStatus;
  sleeves: SleeveHistoryData;
}

// Structurally identical to WeeklyReportEnvelope. Shared contract: one
// backend endpoint serves the "latest weekly report" envelope shape for
// both /api/reports/weekly/latest and /api/v1/friday/current. Aliased to
// prevent silent drift if the envelope gains new fields.
export type FridayCurrentEnvelope = WeeklyReportEnvelope;

export interface FridaySnapshotsEnvelope {
  status: EnvelopeStatus;
  count: number;
  snapshots: FridaySnapshotSummary[];
}

export interface FridaySnapshotCoverage {
  portfolio: boolean;
  macro: boolean;
  rules: boolean;
  decisions: boolean;
  slippage: boolean;
  comment: boolean;
}

export interface FridaySnapshotEnvelope {
  status: EnvelopeStatus;
  date: string;
  coverage: FridaySnapshotCoverage;
  snapshot: FridaySnapshot | null;
}

export interface NDXHistoryPoint {
  date: string;
  price: number;
  ma_250: number | null;
}

export interface MSTRHistoryPoint {
  date: string;
  z_score: number | null;
  mnav_ratio: number;
}

export interface PortfolioAllocationData {
  asset: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  weight: number;
  source: string;
  account_type: string;
  account_silo?: string;
}

export interface Asset {
  id: number;
  symbol: string;
  name: string;
  code: string;
  source: string;
}

export type TradeTransactionCreate = {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  date?: string;
  account_type?: 'ISA' | 'OVERSEAS' | 'PENSION';
  account_silo?: 'ISA_ETF' | 'OVERSEAS_ETF' | 'BRAZIL_BOND';
};

export type CashflowTransactionCreate = {
  type: 'DEPOSIT' | 'WITHDRAW';
  total_amount: number;
  date?: string;
  account_type: 'ISA' | 'OVERSEAS' | 'PENSION';
  account_silo?: 'ISA_ETF' | 'OVERSEAS_ETF' | 'BRAZIL_BOND';
  note?: string;
};

export type TransactionCreate = TradeTransactionCreate | CashflowTransactionCreate;

export interface Transaction {
  id: number;
  symbol?: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  quantity?: number;
  price?: number;
  total_amount: number;
  date?: string;
  account_type?: 'ISA' | 'OVERSEAS' | 'PENSION';
  account_silo?: 'ISA_ETF' | 'OVERSEAS_ETF' | 'BRAZIL_BOND';
  note?: string;
}

// Temporary Mock Data strictly adhering to Backend API schema
// [{ date: '2024-01-01', total_value: 10000000 }, ...]
export const mockPortfolioHistory: PortfolioHistoryData = {
  period: 'all',
  archive: {
    series: [
      { date: '2024-01-01', absolute_wealth: 10000000 },
      { date: '2024-01-02', absolute_wealth: 10150000 },
      { date: '2024-01-03', absolute_wealth: 10120000 },
      { date: '2024-01-04', absolute_wealth: 10250000 },
      { date: '2024-01-05', absolute_wealth: 10400000 },
      { date: '2024-01-08', absolute_wealth: 10350000 },
      { date: '2024-01-09', absolute_wealth: 10500000 },
    ],
  },
  performance: {
    coverage_start: '2024-01-01',
    status: 'ready',
    series: [
      { date: '2024-01-01', performance_value: 10000000, benchmark_value: 10000000, alpha: 0, daily_return: 0 },
      { date: '2024-01-02', performance_value: 10150000, benchmark_value: 10090000, alpha: 0.006, daily_return: 0.015 },
      { date: '2024-01-03', performance_value: 10120000, benchmark_value: 10110000, alpha: 0.001, daily_return: -0.00296 },
    ],
  },
};

export interface PortfolioSummary {
  total_value: number;
  invested_capital: number;
  metrics: {
    total_return: number;
    cagr: number;
    mdd: number;
    volatility: number;
    sharpe_ratio: number;
  };
  valuation?: {
    as_of: string | null;
    source: string;
    version: string;
    period: string;
    history_points: number;
    calculated_at: string;
  };
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export interface SignalVXN {
  current_vxn: number;
  ma_50: number;
  threshold_90: number;
  is_vix_spike: boolean;
}

export interface SignalMSTR {
  current_mnav: number;
  current_mnav_ratio: number;
  rolling_mean: number;
  rolling_std: number;
  z_score: number;
  last_updated: string;
}

export interface SignalNDX {
  current_price: number;
  ma_250: number;
  is_above_ma: boolean;
}

export interface SignalAsset {
  price: number;
  ma_250: number;
  rsi: number;
}

export interface SignalData {
  vxn: SignalVXN | null;
  mstr: SignalMSTR | null;
  ndx: SignalNDX | null;
  gldm: SignalAsset;
  tlt: SignalAsset;
  timestamp: string;
}

export interface AccountAction {
  asset: string;
  action: string;
  reason: string;
  rule_id?: string;
  inputs?: {
    z_score?: number;
    mnav_ratio?: number;
    vxn_current?: number;
    vxn_threshold?: number;
    ndx_price?: number;
    ndx_ma250?: number;
    thresholds?: Record<string, number>;
    triggered_by?: string;
  };
  logic_version?: string;
}

export interface ActionReport {
  signals: SignalData;
  account_status: Record<string, number>;
  actions: AccountAction[];
}

export interface WeeklyBucketSummary {
  bucket: string;
  state: 'supportive' | 'neutral' | 'adverse' | string;
  confidence: string;
  summary: string;
}

export interface WeeklyIndicator {
  key: string;
  bucket: string;
  label: string;
  value: number | null;
  unit: string;
  trend: string;
  state: string;
  source: string;
  observationDate: string | null;
  releaseDate: string | null;
  knownAsOf: string;
}

export interface WeeklyReport {
  weekEnding: string;
  generatedAt: string;
  logicVersion: string;
  status: string;
  dataFreshness: {
    portfolioAsOf: string | null;
    portfolioValuation?: {
      asOf: string | null;
      source: string;
      version: string;
      period: string;
      calculatedAt: string;
    };
    signalsAsOf: string | null;
    macroKnownAsOf: string | null;
    staleFlags: string[];
  };
  portfolioSnapshot: {
    totalValueKRW: number;
    investedCapitalKRW: number;
    metrics: {
      totalReturn: number;
      cagr: number;
      mdd: number;
      volatility: number;
      sharpeRatio: number;
    };
    allocation: PortfolioAllocationData[];
    targetDeviation: {
      category: string;
      currentWeight: number;
      targetWeight: number;
      deviation: number;
      needsRebalance: boolean;
      score: number;
      max: number;
    }[];
  };
  macroSnapshot: {
    overallState: string;
    buckets: WeeklyBucketSummary[];
    indicators: WeeklyIndicator[];
    knownAsOf: string;
  };
  signalsSnapshot: {
    vxn: { current: number | null; ma50: number | null; threshold90: number | null; isSpike: boolean | null };
    ndxTrend: { currentPrice: number | null; ma250: number | null; isAboveMA: boolean | null };
    mstr: { zScore: number | null; mnavRatio: number | null };
    stressTest: { worstScenario: string | null; worstReturn: number | null; worstMdd: number | null; alphaVsSpy: number | null };
  };
  score: {
    total: number;
    fit: number;
    alignment: number;
    postureDiversification: number;
    bucketBreakdown: { name: string; score: number; max: number; state: string; explanation: string }[];
    positives: string[];
    negatives: string[];
  };
  triggeredRules: {
    ruleId: string;
    severity: string;
    source: string;
    message: string;
    affectedSleeves: string[];
    inputs?: Record<string, unknown>;
    logicVersion?: string;
  }[];
  recommendation: {
    stance: string;
    actions: AccountAction[];
    rationale: string[];
  };
  eventAnnotations: {
    eventId: string;
    level: number;
    status: string;
    title: string;
    summary: string;
    affectedBuckets: string[];
    affectedSleeves: string[];
    duration: string | null;
    decisionImpact: string | null;
  }[];
  userAction: unknown;
  outcomeWindow: unknown;
  notes: unknown;
  llmSummary: null | {
    provider: string;
    model: string;
    generatedAt: string;
    headline: string;
    keyChanges: string[];
    whyScoreChanged: string;
    actionFocus: string;
    watchItems: string[];
  };
}

export interface ExecutionSlippage {
  id: number;
  decisionId: number;
  createdAt: string | null;
  executedAt: string | null;
  executedPrice: number | null;
  executedQty: number | null;
  notes: string | null;
}

export interface FridayDecision {
  id: number;
  snapshotId: number;
  createdAt: string | null;
  decisionType: string;
  decision_type?: string;
  assetTicker: string | null;
  note: string;
  // Phase D A3 — 3-scalar confidence. Primary required; the other two optional until A3 UI saturates.
  confidenceVsSpyRiskadj: number;
  confidenceVsCash: number | null;
  confidenceVsSpyPure: number | null;
  // Phase D A4 — structured invalidation.
  invalidation: string | null;
  expectedFailureMode: string | null;
  triggerThreshold: number | null;
  slippageEntries: ExecutionSlippage[];
}

export interface FridaySnapshotSummary {
  id: number;
  snapshotDate: string;
  createdAt: string | null;
  metadata: {
    coverage?: Record<string, boolean>;
    partial?: boolean;
    errors?: Record<string, string>;
    snapshotWeekEnding?: string;
  };
  // Phase D A7 — optional per-freeze observation; echoed on archive cards and Discord briefing.
  comment: string | null;
  decisions: FridayDecision[];
  score?: number | null;
  status?: string | null;
}

export interface FridaySnapshot extends FridaySnapshotSummary {
  frozenReport: WeeklyReport;
}

export interface FridayBriefingData {
  sinceDate: string | null;
  regimeTransitions: Array<{
    bucket: string;
    from: string;
    to: string;
  }>;
  maturedOutcomes: Array<{
    decisionId: number;
    horizon: string;
    outcomeDeltaPct: number | null;
    scoreDelta: number | null;
    evaluatedAt: string | null;
    decisionType: string | null;
    assetTicker: string | null;
  }>;
  alertHistory: {
    success: number;
    failed: number;
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
  };
  lastSnapshotComment: {
    snapshotDate: string | null;
    comment: string;
  } | null;
}

export type SleeveHistoryData = Record<
  'NDX' | 'DBMF' | 'BRAZIL' | 'MSTR' | 'GLDM' | 'BONDS-CASH',
  number[]
>;

export interface FridayComparison {
  snapshotA: FridaySnapshot;
  snapshotB: FridaySnapshot;
  deltas: {
    score_total: number;
    total_value: number;
    regime_change: { from: string | null; to: string | null };
    rules_added: string[];
    rules_removed: string[];
    holdings_changed: Array<{
      symbol: string;
      weight_a: number;
      weight_b: number;
      delta: number;
    }>;
  };
}

export interface FridayCompareEnvelope {
  status: EnvelopeStatus;
  a: string;
  b: string;
  comparison: FridayComparison | null;
}

// Phase UX-1b Task 1 — Intelligence root-panel envelopes.
// Shapes mirror the wrap_response() output from main.py for
// /api/intelligence/{attributions,rules/accuracy,outcomes}. Each preserves
// the collection shape across ready/unavailable so UI skeletons match.
export interface IntelligenceAttributionsEnvelope {
  status: EnvelopeStatus;
  date_from: string | null;
  date_to: string | null;
  attributions: AttributionData[];
}

export interface IntelligenceRulesAccuracyEnvelope {
  status: EnvelopeStatus;
  rules: RuleAccuracyData[];
}

export interface IntelligenceOutcomesEnvelope {
  status: EnvelopeStatus;
  horizon: string | null;
  outcomes: DecisionOutcomeData[];
}

export interface IntelligenceRegimeHistoryEnvelope {
  status: EnvelopeStatus;
  transitions: RegimeTransitionData[];
}

const emptyPortfolioHistory = (period: string): PortfolioHistoryData => ({
  period,
  archive: { series: [] },
  performance: {
    coverage_start: null,
    status: 'unavailable',
    series: [],
  },
});

const emptyWeeklyReportEnvelope: WeeklyReportEnvelope = {
  status: 'unavailable',
  report: null,
};

const emptyIntelligenceAttributionsEnvelope: IntelligenceAttributionsEnvelope = {
  status: 'unavailable',
  date_from: null,
  date_to: null,
  attributions: [],
};

const emptyIntelligenceRulesAccuracyEnvelope: IntelligenceRulesAccuracyEnvelope = {
  status: 'unavailable',
  rules: [],
};

const emptyIntelligenceOutcomesEnvelope = (
  horizon?: string | null,
): IntelligenceOutcomesEnvelope => ({
  status: 'unavailable',
  horizon: horizon ?? null,
  outcomes: [],
});

const emptyIntelligenceRegimeHistoryEnvelope: IntelligenceRegimeHistoryEnvelope = {
  status: 'unavailable',
  transitions: [],
};

type LegacyPortfolioHistoryPoint = {
  date: string;
  total_value: number;
  invested_capital?: number;
  cash_balance?: number;
  daily_return?: number;
  benchmark_value?: number;
  alpha?: number;
};

function normalizePortfolioHistoryResponse(payload: unknown, period: string): PortfolioHistoryData {
  if (Array.isArray(payload)) {
    const archiveSeries: AbsoluteHistoryPoint[] = payload
      .filter((point): point is LegacyPortfolioHistoryPoint => !!point && typeof point === 'object' && 'date' in point && 'total_value' in point)
      .map((point) => ({
        date: point.date,
        absolute_wealth: point.total_value,
        invested_capital: point.invested_capital,
        cash_balance: point.cash_balance,
      }));

    return {
      period,
      archive: { series: archiveSeries },
      performance: {
        coverage_start: null,
        status: 'unavailable',
        series: [],
      },
    };
  }

  if (!payload || typeof payload !== 'object') {
    return emptyPortfolioHistory(period);
  }

  const data = payload as PortfolioHistoryData;
  return {
    period: data.period ?? period,
    archive: {
      series: Array.isArray(data.archive?.series) ? data.archive.series : [],
    },
    performance: {
      coverage_start: data.performance?.coverage_start ?? null,
      status: data.performance?.status ?? 'unavailable',
      series: Array.isArray(data.performance?.series) ? data.performance.series : [],
    },
  };
}

/**
 * Fetches split archive/performance portfolio history from the backend.
 */
export async function getPortfolioHistory(period: string = 'all'): Promise<PortfolioHistoryData> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/portfolio/history?period=${period}`, {
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch from backend');
    return normalizePortfolioHistoryResponse(await res.json(), period);
  } catch (error) {
    console.error('API Error:', error);
    return emptyPortfolioHistory(period);
  }
}

/**
 * Fetches current portfolio allocation (current holdings).
 */
export async function getPortfolioAllocation(): Promise<PortfolioAllocationData[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/portfolio/allocation`, {
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch from backend');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

/**
 * Fetches all available assets.
 */
export async function getAssets(): Promise<Asset[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/assets`, {
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch assets');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

/**
 * Creates a new transaction.
 */
export async function createTransaction(data: TransactionCreate): Promise<Transaction> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || 'Failed to create transaction');
  }
  
  return res.json();
}

/**
 * Fetches portfolio summary metrics.
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/portfolio/summary`, {
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return {
      total_value: 0,
      invested_capital: 0,
      metrics: {
        total_return: 0,
        cagr: 0,
        mdd: 0,
        volatility: 0,
        sharpe_ratio: 0,
      }
    };
  }
}

export async function getNDXHistory(period: string = '1y'): Promise<NDXHistoryPoint[]> {
  return getAssetHistory('QQQ', period);
}

export async function getAssetHistory(ticker: string, period: string = '1y'): Promise<NDXHistoryPoint[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/signals/history?ticker=${ticker}&period=${period}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getMSTRHistory(period: string = '1y'): Promise<MSTRHistoryPoint[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/signals/mstr-history?period=${period}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getPortfolioPageData(period: string = 'all'): Promise<{
  history: ApiResult<PortfolioHistoryData>;
  allocation: ApiResult<PortfolioAllocationData[]>;
  summary: ApiResult<PortfolioSummary>;
  ndxHistory: NDXHistoryPoint[];
  mstrHistory: MSTRHistoryPoint[];
}> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchJson = async <T>(path: string): Promise<ApiResult<T>> => {
    try {
      const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
      if (!res.ok) {
        return { data: null, error: `Request failed (${res.status})` };
      }

      return { data: await res.json(), error: null };
    } catch (error) {
      console.error('API Error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown API error',
      };
    }
  };

  const [history, allocation, summary, ndxHistory, mstrHistory] = await Promise.all([
    getPortfolioHistory(period).then((data) => ({ data, error: null as string | null })).catch((error) => ({ data: null, error: error instanceof Error ? error.message : 'Unknown API error' })),
    fetchJson<PortfolioAllocationData[]>('/api/portfolio/allocation'),
    fetchJson<PortfolioSummary>('/api/portfolio/summary'),
    getNDXHistory(period),
    getMSTRHistory(period),
  ]);

  return { history, allocation, summary, ndxHistory, mstrHistory };
}

/**
 * Fetches trade recommendations based on market signals and current allocation.
 */
export async function getActionReport(): Promise<ActionReport> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/algo/action-report`, {
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch action report');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    // Return a default empty report to avoid UI crashes
    return {
      signals: {
        vxn: null,
        mstr: null,
        ndx: null,
        gldm: { price: 0, ma_250: 0, rsi: 0 },
        tlt: { price: 0, ma_250: 0, rsi: 0 },
        timestamp: new Date().toISOString()
      },
      account_status: {},
      actions: []
    };
  }
}

export async function getLatestWeeklyReport(): Promise<WeeklyReportEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly/latest`, { cache: 'no-store' });
    if (!res.ok) return emptyWeeklyReportEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyWeeklyReportEnvelope;
    }
    return data as WeeklyReportEnvelope;
  } catch {
    return emptyWeeklyReportEnvelope;
  }
}

export async function getWeeklyReports(limit: number = 24): Promise<Array<{ weekEnding: string; generatedAt: string | null; logicVersion: string; status: string; score: number | null }>> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly?limit=${limit}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch weekly reports');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getWeeklyReport(weekEnding: string): Promise<WeeklyReport | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly/${weekEnding}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch weekly report by week');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

const emptyFridayCurrentEnvelope: FridayCurrentEnvelope = emptyWeeklyReportEnvelope;

export async function getFridayCurrent(): Promise<FridayCurrentEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/current`, {
      cache: 'no-store'
    });
    if (!res.ok) return emptyFridayCurrentEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridayCurrentEnvelope;
    }
    return data as FridayCurrentEnvelope;
  } catch (error) {
    console.error('API Error:', error);
    return emptyFridayCurrentEnvelope;
  }
}

const emptyFridaySnapshotsEnvelope: FridaySnapshotsEnvelope = {
  status: 'unavailable',
  count: 0,
  snapshots: [],
};

export async function getFridaySnapshots(): Promise<FridaySnapshotsEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/snapshots`, {
      cache: 'no-store'
    });
    if (!res.ok) return emptyFridaySnapshotsEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridaySnapshotsEnvelope;
    }
    return data as FridaySnapshotsEnvelope;
  } catch (error) {
    console.error('API Error:', error);
    return emptyFridaySnapshotsEnvelope;
  }
}

const emptyFridaySnapshotEnvelope = (date: string): FridaySnapshotEnvelope => ({
  status: 'unavailable',
  date,
  coverage: {
    portfolio: false,
    macro: false,
    rules: false,
    decisions: false,
    slippage: false,
    comment: false,
  },
  snapshot: null,
});

export async function getFridaySnapshot(snapshotDate: string): Promise<FridaySnapshotEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/snapshot/${snapshotDate}`, {
      cache: 'no-store',
    });
    if (!res.ok) return emptyFridaySnapshotEnvelope(snapshotDate);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridaySnapshotEnvelope(snapshotDate);
    }
    return data as FridaySnapshotEnvelope;
  } catch (error) {
    console.error('API Error:', error);
    return emptyFridaySnapshotEnvelope(snapshotDate);
  }
}

const emptyFridayBriefingEnvelope: FridayBriefingEnvelope = {
  status: 'unavailable',
  sinceDate: null,
  regimeTransitions: [],
  maturedOutcomes: [],
  alertHistory: { success: 0, failed: 0, lastFailureAt: null, lastFailureMessage: null },
  lastSnapshotComment: null,
};

export async function getFridayBriefing(since?: string): Promise<FridayBriefingEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await fetch(`${API_BASE}/api/v1/friday/briefing${qs}`, { cache: 'no-store' });
    if (!res.ok) return emptyFridayBriefingEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridayBriefingEnvelope;
    }
    return data as FridayBriefingEnvelope;
  } catch (error) {
    console.error('API Error:', error);
    return emptyFridayBriefingEnvelope;
  }
}

const emptyFridaySleeveHistoryEnvelope: FridaySleeveHistoryEnvelope = {
  status: 'unavailable',
  sleeves: {
    NDX: [],
    DBMF: [],
    BRAZIL: [],
    MSTR: [],
    GLDM: [],
    'BONDS-CASH': [],
  },
};

export async function getFridaySleeveHistory(weeks: number = 4): Promise<FridaySleeveHistoryEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/sleeve-history?weeks=${weeks}`, { cache: 'no-store' });
    if (!res.ok) return emptyFridaySleeveHistoryEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridaySleeveHistoryEnvelope;
    }
    return data as FridaySleeveHistoryEnvelope;
  } catch (error) {
    console.error('API Error:', error);
    return emptyFridaySleeveHistoryEnvelope;
  }
}

const emptyFridayCompareEnvelope = (a: string, b: string): FridayCompareEnvelope => ({
  status: 'unavailable',
  a,
  b,
  comparison: null,
});

export async function compareFridaySnapshots(a: string, b: string): Promise<FridayCompareEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/compare?a=${a}&b=${b}`, {
      cache: 'no-store',
    });
    if (!res.ok) return emptyFridayCompareEnvelope(a, b);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridayCompareEnvelope(a, b);
    }
    return data as FridayCompareEnvelope;
  } catch (error) {
    console.error('API Error:', error);
    return emptyFridayCompareEnvelope(a, b);
  }
}

export async function createFridaySnapshot(snapshotDate?: string, comment?: string): Promise<FridaySnapshot> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/friday/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snapshot_date: snapshotDate ?? null,
      comment: comment ?? null,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || 'Failed to create Friday snapshot');
  }

  return res.json();
}

export async function createFridayDecision(payload: {
  snapshot_id: number;
  decision_type: string;
  asset_ticker?: string;
  note: string;
  // Phase D A3 — primary required; siblings optional.
  confidence_vs_spy_riskadj: number;
  confidence_vs_cash?: number;
  confidence_vs_spy_pure?: number;
  // Phase D A4 — all optional.
  invalidation?: string;
  expected_failure_mode?: string;
  trigger_threshold?: number;
}): Promise<FridayDecision> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/friday/decisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || 'Failed to create Friday decision');
  }

  return res.json();
}

export async function createFridaySlippage(payload: {
  decision_id: number;
  executed_at?: string;
  executed_price?: number;
  executed_qty?: number;
  notes?: string;
}): Promise<ExecutionSlippage> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/friday/slippage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Intelligence API
// ---------------------------------------------------------------------------

export interface AttributionData {
  snapshotDate: string;
  totalScore: number;
  fit: { score: number; liquidity: number | null; rates: number | null; inflation: number | null; growth: number | null; stress: number | null };
  alignment: { score: number; ndx: number | null; dbmf: number | null; brazil: number | null; mstr: number | null; gldm: number | null; bondsCash: number | null };
  posture: { score: number; stressResilience: number | null; concentration: number | null; diversifierReserve: number | null };
  regimeSnapshot: Array<{ bucket: string; state: string }> | null;
  indicatorValues?: Record<string, unknown> | null;
  rulesFired: Array<{ ruleId: string; severity: string; was_followed?: boolean | null; message?: string }> | null;
}

export interface DecisionOutcomeData {
  snapshotDate: string;
  horizon: string;
  decision: { type: string; assetTicker: string | null; note: string; confidenceVsSpyRiskadj: number };
  portfolioValueAtDecision: number | null;
  portfolioValueAtHorizon: number | null;
  scoreAtDecision: number | null;
  scoreAtHorizon: number | null;
  regimeAtDecision: string | null;
  regimeAtHorizon: string | null;
  outcomeDeltaPct: number | null;
  scoreDelta: number | null;
  regimeChanged: string | null;
  evaluatedAt: string | null;
}

export interface RuleAccuracyData {
  ruleId: string;
  severity: string;
  timesFired: number;
  timesFollowed: number;
  timesIgnored: number;
  timesPending: number;
  followRate: number | null;
}

export interface RegimeTransitionData {
  date: string;
  bucket: string;
  from: string;
  to: string;
  totalScore: number;
  previousDate: string | null;
}

export async function getIntelligenceAttributions(
  dateFrom?: string,
  dateTo?: string,
): Promise<IntelligenceAttributionsEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/intelligence/attributions${qs}`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceAttributionsEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceAttributionsEnvelope;
    }
    return data as IntelligenceAttributionsEnvelope;
  } catch {
    return emptyIntelligenceAttributionsEnvelope;
  }
}

export async function getIntelligenceOutcomes(
  horizon?: string,
): Promise<IntelligenceOutcomesEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const qs = horizon ? `?horizon=${horizon}` : '';
    const res = await fetch(`${API_BASE}/api/intelligence/outcomes${qs}`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceOutcomesEnvelope(horizon);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceOutcomesEnvelope(horizon);
    }
    return data as IntelligenceOutcomesEnvelope;
  } catch {
    return emptyIntelligenceOutcomesEnvelope(horizon);
  }
}

export async function getIntelligenceRuleAccuracy(): Promise<IntelligenceRulesAccuracyEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/rules/accuracy`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceRulesAccuracyEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceRulesAccuracyEnvelope;
    }
    return data as IntelligenceRulesAccuracyEnvelope;
  } catch {
    return emptyIntelligenceRulesAccuracyEnvelope;
  }
}

export async function getIntelligenceRegimeHistory(): Promise<IntelligenceRegimeHistoryEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/regime/history`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceRegimeHistoryEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceRegimeHistoryEnvelope;
    }
    return data as IntelligenceRegimeHistoryEnvelope;
  } catch {
    return emptyIntelligenceRegimeHistoryEnvelope;
  }
}

// Periodic Reviews

export interface ReviewSummaryData {
  totalWeeks: number;
  dateRange?: { from: string; to: string };
  months: string[];
  quarters: string[];
  years: string[];
}

export interface ReviewAggregation {
  period: string;
  type: string;
  count: number;
  dateRange?: { from: string; to: string };
  scores?: { avg: number; min: number; max: number; trend: number };
  fit?: { avg: number };
  alignment?: { avg: number };
  posture?: { avg: number };
  ruleStats?: Array<{ ruleId: string; fired: number; followed: number; ignored: number }>;
}

export async function getReviewSummary(): Promise<ReviewSummaryData> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/reviews/summary`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch review summary');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return { totalWeeks: 0, months: [], quarters: [], years: [] };
  }
}

export async function getMonthlyReview(month: string): Promise<ReviewAggregation | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/reviews/monthly?month=${month}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

export async function getQuarterlyReview(quarter: string): Promise<ReviewAggregation | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/reviews/quarterly?quarter=${quarter}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

export async function getAnnualReview(year: string): Promise<ReviewAggregation | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/reviews/annual?year=${year}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

export type RiskMetricValues = {
  cagr: number | null;
  mdd: number | null;
  sd: number | null;
  sharpe: number | null;
  calmar: number | null;
  sortino: number | null;
};

export type HorizonMetrics = {
  portfolio: RiskMetricValues;
  spy_krw: RiskMetricValues;
};

export type RiskAdjustedScorecardPayload = {
  ready: boolean;
  based_on_freezes: number;
  based_on_weeks: number;
  first_freeze_date: string | null;
  maturity_gate: { required_weeks: number; current_weeks: number; ready: boolean };
  horizons: { "6M": HorizonMetrics; "1Y": HorizonMetrics; ITD: HorizonMetrics };
};

export type CalmarTrajectoryPoint = {
  date: string;
  portfolio_calmar: number | null;
  spy_krw_calmar: number | null;
  delta: number | null;
};

export type CalmarDecisionMarker = {
  date: string;
  decisions: Array<{ ticker: string | null; decision_type: string; note: string }>;
};

export type CalmarTrajectoryPayload = {
  ready: boolean;
  based_on_freezes: number;
  required_weeks: number;
  points: CalmarTrajectoryPoint[];
  decision_markers: CalmarDecisionMarker[];
};

export async function fetchRiskAdjustedScorecard(): Promise<RiskAdjustedScorecardPayload> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/intelligence/risk-adjusted/scorecard`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch risk-adjusted scorecard');
  return res.json();
}

export async function fetchCalmarTrajectory(): Promise<CalmarTrajectoryPayload> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/intelligence/risk-adjusted/calmar-trajectory`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch calmar trajectory');
  return res.json();
}
