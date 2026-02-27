import FinanceDataReader as fdr
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class MacroService:
    @staticmethod
    def get_macro_vitals():
        """
        Fetches and calculates Net Liquidity and Real Yield metrics from FRED data.
        Returns the latest status and trend.
        """
        # 1. Fetch Data (Last 365 days for percentile calculation)
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        
        try:
            # Net Liquidity Components
            # WALCL: Federal Reserve Total Assets (Weekly, Wed)
            # WDTGAL: Treasury General Account (Weekly, Wed)
            # RRPONTSYD: Reverse Repo (Daily)
            walcl = fdr.DataReader('FRED:WALCL', start_date)
            wdtgal = fdr.DataReader('FRED:WDTGAL', start_date)
            rrp = fdr.DataReader('FRED:RRPONTSYD', start_date)
            
            # Real Yield
            # DFII10: Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis, Inflation-Indexed
            real_yield = fdr.DataReader('FRED:DFII10', start_date)

            if any(df.empty for df in [walcl, wdtgal, rrp, real_yield]):
                return None

            # 2. Merge Dataframes
            # Use outer join to keep all dates, then forward fill
            df = pd.DataFrame(index=pd.date_range(start=start_date, end=datetime.now()))
            df = df.join([walcl, wdtgal, rrp, real_yield])
            df.columns = ['WALCL', 'WDTGAL', 'RRP', 'REAL_YIELD']
            df = df.ffill().dropna()

            if df.empty:
                return None

            # 3. Calculate Net Liquidity (Trillions USD)
            # WALCL, WDTGAL are in Millions. RRP is in Billions.
            # Convert all to Trillions for calculation.
            df['Net_Liquidity'] = (df['WALCL'] / 1_000_000) - (df['WDTGAL'] / 1_000_000) - (df['RRP'] / 1_000)

            # 4. Analyze Status (Dynamic Percentile Thresholds)
            latest = df.iloc[-1]
            
            # Net Liquidity Logic
            liq_series = df['Net_Liquidity']
            liq_p10 = np.percentile(liq_series, 10)
            liq_p80 = np.percentile(liq_series, 80)
            
            # Hard Floor: Max(10th percentile, 5.0T)
            liq_red_threshold = max(liq_p10, 5.0)
            liq_green_threshold = liq_p80
            
            nl_val = latest['Net_Liquidity']
            nl_ma20 = liq_series.rolling(window=20).mean().iloc[-1]
            nl_trend = "up" if nl_val > nl_ma20 else "down"
            
            if nl_val < liq_red_threshold:
                nl_state = "danger"
            elif nl_val > liq_green_threshold:
                nl_state = "safe"
            else:
                nl_state = "neutral"

            # Real Yield Logic
            ry_series = df['REAL_YIELD']
            ry_p90 = np.percentile(ry_series, 90)
            ry_p20 = np.percentile(ry_series, 20)
            
            # Hard Floor: Red Threshold >= 1.5%
            ry_red_threshold = max(ry_p90, 1.5)
            ry_green_threshold = ry_p20
            
            ry_val = latest['REAL_YIELD']
            ry_ma20 = ry_series.rolling(window=20).mean().iloc[-1]
            ry_trend = "up" if ry_val > ry_ma20 else "down" # Rate UP = Bearish for Assets generally
            
            if ry_val > ry_red_threshold:
                ry_state = "danger"
            elif ry_val < ry_green_threshold:
                ry_state = "safe"
            else:
                ry_state = "neutral"

            return {
                "last_updated": latest.name.strftime('%Y-%m-%d'),
                "net_liquidity": {
                    "value": round(nl_val, 3),
                    "unit": "T",
                    "trend": nl_trend,
                    "state": nl_state,
                    "thresholds": {
                        "red": round(liq_red_threshold, 2),
                        "green": round(liq_green_threshold, 2)
                    }
                },
                "real_yield": {
                    "value": round(ry_val, 2),
                    "unit": "%",
                    "trend": ry_trend,
                    "state": ry_state,
                    "thresholds": {
                        "red": round(ry_red_threshold, 2),
                        "green": round(ry_green_threshold, 2)
                    }
                }
            }

        except Exception as e:
            print(f"Error in MacroService: {e}")
            return None
