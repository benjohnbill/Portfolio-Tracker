import { createTransaction, getPortfolioHistory } from '@/lib/api';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://test-backend';
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

test('getPortfolioHistory preserves the split archive/performance contract', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      period: '1y',
      archive: {
        series: [
          { date: '2026-04-20', absolute_wealth: 1000, net_cashflow: 500 },
        ],
      },
      performance: {
        coverage_start: '2026-04-20',
        status: 'ready',
        series: [
          { date: '2026-04-20', performance_value: 1000, benchmark_value: 990, alpha: 0.01, daily_return: 0 },
        ],
      },
    }),
  }) as unknown as typeof fetch;

  const history = await getPortfolioHistory('1y');

  expect(global.fetch).toHaveBeenCalledWith('http://test-backend/api/portfolio/history?period=1y', { cache: 'no-store' });
  expect(history.archive.series).toEqual([
    { date: '2026-04-20', absolute_wealth: 1000, net_cashflow: 500 },
  ]);
  expect(history.performance).toEqual({
    coverage_start: '2026-04-20',
    status: 'ready',
    series: [
      { date: '2026-04-20', performance_value: 1000, benchmark_value: 990, alpha: 0.01, daily_return: 0 },
    ],
  });
});

test('getPortfolioHistory normalizes legacy flat arrays without dropping coverage state', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { date: '2026-04-20', total_value: 1000, daily_return: 0, benchmark_value: 1000, alpha: 0 },
      { date: '2026-04-21', total_value: 1500, daily_return: 0.5, benchmark_value: 1010, alpha: 0.49 },
    ],
  }) as unknown as typeof fetch;

  const history = await getPortfolioHistory('all');

  expect(history.archive.series).toEqual([
    { date: '2026-04-20', absolute_wealth: 1000, invested_capital: undefined, cash_balance: undefined },
    { date: '2026-04-21', absolute_wealth: 1500, invested_capital: undefined, cash_balance: undefined },
  ]);
  expect(history.performance.coverage_start).toBe('2026-04-20');
  expect(history.performance.status).toBe('ready');
  expect(history.performance.series[1]).toEqual({
    date: '2026-04-21',
    performance_value: 1500,
    benchmark_value: 1010,
    alpha: 0.49,
    daily_return: 0.5,
  });
});

test('createTransaction sends explicit cashflow rows without trade-only fields', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 10, type: 'DEPOSIT', total_amount: 250000, account_type: 'ISA' }),
  }) as unknown as typeof fetch;

  await createTransaction({
    type: 'DEPOSIT',
    total_amount: 250000,
    date: '2026-04-22',
    account_type: 'ISA',
    account_silo: 'ISA_ETF',
    note: 'salary contribution',
  });

  expect(global.fetch).toHaveBeenCalledWith(
    'http://test-backend/api/transactions',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'DEPOSIT',
        total_amount: 250000,
        date: '2026-04-22',
        account_type: 'ISA',
        account_silo: 'ISA_ETF',
        note: 'salary contribution',
      }),
    }),
  );
});
