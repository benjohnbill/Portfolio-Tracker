export interface PortfolioHistoryData {
  date: string;
  total_value: number;
  cash?: number;
  invested?: number;
  daily_return?: number;
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
}

export interface ActionReport {
  signals: SignalData;
  account_status: Record<string, number>;
  actions: AccountAction[];
}

/**
 * Fetches portfolio history either from Mock or the Backend.
 * Backend endpoint when ready: http://localhost:8000/api/portfolio/history
 */
export async function getPortfolioHistory(period: string = 'ytd'): Promise<PortfolioHistoryData[]> {
  const USE_MOCK = false; // Using real backend now

  if (USE_MOCK) {
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockPortfolioHistory), 500);
    });
  }

  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/portfolio/history?period=${period}`, {
      // Ensure Next.js doesn't overly cache this in a way that breaks real-time updates for now
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Failed to fetch from backend');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    // Fallback to mock if API fails while testing
    return mockPortfolioHistory;
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

