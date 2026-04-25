import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List

class StressService:
    # Hardcoded crisis periods
    SCENARIOS = {
        '2020_COVID': {
            'name': '2020 Pandemic Crash',
            'start': '2020-02-19',
            'end': '2020-03-23',
            'description': 'S&P 500 fell 34% in 33 days.'
        },
        '2022_BEAR': {
            'name': '2022 Inflation Bear',
            'start': '2022-01-03',
            'end': '2022-10-12',
            'description': 'High inflation & aggressive rate hikes.'
        }
    }

    # Proxy mapping for assets that didn't exist back then
    TICKER_PROXY = {
        'KODEX_1X':    'QQQ',     # was 'QQQ': 'QQQ'
        'TIGER_2X':    'QLD',     # NEW (US 2x NDX historical proxy)
        'ACE_TLT':     'TLT',     # was 'TLT': 'TLT'
        'CSI300':      'ASHR',
        'NIFTY':       'INDA',
        'MSTR':        'MSTR',
        'DBMF':        'DBMF',
        'GLDM':        'GLD',
        'BIL':         'BIL',
        'PFIX':        'PFIX',
        'VBIL':        'BND',
        'SPY':         'SPY',
    }
    
    # 2020 Override for assets too new even for standard proxy
    PROXY_2020 = {
        'PFIX': 'TBF', # ProShares Short 20+ Year Treasury (Inverse Bond)
    }

    @staticmethod
    def get_proxy_ticker(symbol: str, scenario_key: str) -> str:
        if scenario_key == '2020_COVID' and symbol in StressService.PROXY_2020:
            return StressService.PROXY_2020[symbol]
        return StressService.TICKER_PROXY.get(symbol, symbol)

    @staticmethod
    def run_simulation(current_holdings: Dict[str, float]):
        """
        Simulates portfolio performance during historical crises.
        current_holdings: { 'QQQ': 0.3, 'TLT': 0.2, ... } (Weights sum to 1.0)
        """
        results = []

        for key, scenario in StressService.SCENARIOS.items():
            start_date = scenario['start']
            end_date = scenario['end']
            
            # 1. Map assets to proxies for this scenario
            # symbol -> proxy_ticker
            ticker_map = {} 
            for symbol, weight in current_holdings.items():
                if weight > 0:
                    proxy = StressService.get_proxy_ticker(symbol, key)
                    ticker_map[symbol] = proxy
            
            # Add Benchmark
            ticker_map['SPY'] = 'SPY'
            
            unique_proxies = list(set(ticker_map.values()))
            if not unique_proxies:
                continue

            try:
                # 2. Bulk Fetch Data
                # auto_adjust=True returns OHLC, but columns might be MultiIndex if >1 ticker
                df = yf.download(unique_proxies, start=start_date, end=end_date, progress=False, auto_adjust=True)
                
                if df.empty:
                    continue

                # 3. Extract Closing Prices
                # Handle yfinance's variable return structure
                closes = pd.DataFrame()

                if isinstance(df.columns, pd.MultiIndex):
                    # If MultiIndex (Price, Ticker), we want 'Close'
                    # Check if 'Close' exists in level 0
                    if 'Close' in df.columns.get_level_values(0):
                        closes = df['Close']
                    else:
                        # Sometimes it returns 'Adj Close'
                        closes = df.xs('Close', axis=1, level=0, drop_level=True)
                else:
                    # Single level columns. 
                    # If we requested 1 ticker, it's just OHLC columns
                    if len(unique_proxies) == 1:
                        if 'Close' in df.columns:
                            closes = pd.DataFrame({unique_proxies[0]: df['Close']})
                        else:
                            closes = pd.DataFrame({unique_proxies[0]: df.iloc[:, 0]})
                    else:
                        # Multiple tickers but single level? Unlikely unless flattened.
                        # Assume it's Close prices if no OHLC columns found? No, dangerous.
                        if 'Close' in df.columns:
                             closes = df[['Close']]
                        else:
                             closes = df # Fallback

                # Forward fill missing data (e.g. holidays)
                closes = closes.ffill().dropna()
                if closes.empty:
                    continue

                # 4. Normalize Prices (Start at 1.0)
                normalized = closes / closes.iloc[0]

                # 5. Build Portfolio Weighted Series
                portfolio_series = pd.Series(0.0, index=normalized.index)
                
                for symbol, weight in current_holdings.items():
                    proxy = ticker_map.get(symbol)
                    if proxy in normalized.columns:
                        portfolio_series += normalized[proxy] * weight
                
                # Benchmark Series
                spy_series = normalized['SPY'] if 'SPY' in normalized.columns else None

                # 6. Calculate Metrics
                # Portfolio
                start_val = portfolio_series.iloc[0]
                end_val = portfolio_series.iloc[-1]
                total_return = (end_val - start_val) / start_val
                
                roll_max = portfolio_series.cummax()
                dd = (portfolio_series - roll_max) / roll_max
                mdd = dd.min()

                # Benchmark
                spy_ret = 0.0
                spy_mdd = 0.0
                if spy_series is not None:
                    spy_ret = (spy_series.iloc[-1] - 1.0)
                    spy_dd = (spy_series - spy_series.cummax()) / spy_series.cummax()
                    spy_mdd = spy_dd.min()

                results.append({
                    "scenario": scenario['name'],
                    "period": f"{start_date} ~ {end_date}",
                    "description": scenario.get('description', ''),
                    "portfolio": {
                        "return": round(total_return * 100, 2),
                        "mdd": round(mdd * 100, 2)
                    },
                    "benchmark": {
                        "return": round(spy_ret * 100, 2),
                        "mdd": round(spy_mdd * 100, 2)
                    },
                    "alpha": round((total_return - spy_ret) * 100, 2)
                })

            except Exception as e:
                print(f"Stress Test Error ({key}): {e}")
                continue

        return results
