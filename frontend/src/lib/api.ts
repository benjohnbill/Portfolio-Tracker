export interface PortfolioHistoryData {
  date: string;
  total_value: number;
  cash?: number;
  invested?: number;
  daily_return?: number;
  fx_rate?: number;
  benchmark_value?: number;
  alpha?: number;
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

export interface TransactionCreate {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price?: number; // Now optional, backend will auto-fetch if missing
  date?: string; // ISO format YYYY-MM-DD
  account_type?: 'ISA' | 'OVERSEAS' | 'PENSION';
  account_silo?: 'ISA_ETF' | 'OVERSEAS_ETF' | 'BRAZIL_BOND';
}

export interface Transaction extends TransactionCreate {
  id: number;
  total_amount: number;
}

// Temporary Mock Data strictly adhering to Backend API schema
// [{ date: '2024-01-01', total_value: 10000000 }, ...]
export const mockPortfolioHistory: PortfolioHistoryData[] = [
  { date: '2024-01-01', total_value: 10000000 },
  { date: '2024-01-02', total_value: 10150000 },
  { date: '2024-01-03', total_value: 10120000 },
  { date: '2024-01-04', total_value: 10250000 },
  { date: '2024-01-05', total_value: 10400000 },
  { date: '2024-01-08', total_value: 10350000 },
  { date: '2024-01-09', total_value: 10500000 },
];

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
  // Legacy mirror of confidenceVsSpyRiskadj — retained so old read sites keep rendering until Plan 3 cleanup.
  confidence: number;
  // Phase D A4 — structured invalidation.
  invalidation: string | null;
  expectedFailureMode: string | null;
  triggerThreshold: number | null;
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

/**
 * Fetches portfolio history from the Backend.
 * Backend endpoint: http://localhost:8000/api/portfolio/history
 */
export async function getPortfolioHistory(period: string = 'all'): Promise<PortfolioHistoryData[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/portfolio/history?period=${period}`, {
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch from backend');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    // Return empty list instead of confusing mock data
    return [];
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
  history: ApiResult<PortfolioHistoryData[]>;
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
    fetchJson<PortfolioHistoryData[]>(`/api/portfolio/history?period=${period}`),
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

export async function getLatestWeeklyReport(): Promise<WeeklyReport | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly/latest`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch weekly report');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
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

export async function getFridayCurrent(): Promise<WeeklyReport | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/current`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch Friday current report');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

export async function getFridaySnapshots(): Promise<FridaySnapshotSummary[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/snapshots`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch Friday snapshots');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getFridaySnapshot(snapshotDate: string): Promise<FridaySnapshot | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/snapshot/${snapshotDate}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch Friday snapshot');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

export async function compareFridaySnapshots(a: string, b: string): Promise<FridayComparison | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/compare?a=${a}&b=${b}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to compare Friday snapshots');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
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
  decision: { type: string; assetTicker: string | null; note: string; confidence: number };
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

export async function getIntelligenceAttributions(dateFrom?: string, dateTo?: string): Promise<AttributionData[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/intelligence/attributions${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch attributions');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getIntelligenceOutcomes(horizon?: string): Promise<DecisionOutcomeData[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const qs = horizon ? `?horizon=${horizon}` : '';
    const res = await fetch(`${API_BASE}/api/intelligence/outcomes${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch outcomes');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getIntelligenceRuleAccuracy(): Promise<RuleAccuracyData[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/rules/accuracy`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch rule accuracy');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getIntelligenceRegimeHistory(): Promise<RegimeTransitionData[]> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/regime/history`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch regime history');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
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
