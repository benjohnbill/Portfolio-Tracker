export interface PortfolioHistoryData {
  date: string;
  total_value: number;
  cash?: number;
  invested?: number;
  daily_return?: number;
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
    const res = await fetch(`http://localhost:8000/api/portfolio/history?period=${period}`, {
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
