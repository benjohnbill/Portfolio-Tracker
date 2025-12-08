import FinanceDataReader as fdr
import yfinance as yf
import pandas as pd

def verify_libraries():
    print("--- Verifying FinanceDataReader (Domestic) ---")
    try:
        # Test Samsung Electronics (005930) or KODEX Nasdaq100 (379810)
        ticker_kr = '379810'
        print(f"Fetching {ticker_kr}...")
        df_kr = fdr.DataReader(ticker_kr, '2024-01-01')
        if not df_kr.empty:
            print(f"SUCCESS: Retrieved {len(df_kr)} rows for {ticker_kr}")
            print(df_kr.tail(2))
        else:
            print(f"FAILURE: No data returned for {ticker_kr}")
    except Exception as e:
        print(f"ERROR fetching FDR: {e}")

    print("\n--- Verifying yfinance (International) ---")
    try:
        # Test NVDA or CTA
        ticker_us = 'CTA'
        print(f"Fetching {ticker_us}...")
        ticker_obj = yf.Ticker(ticker_us)
        df_us = ticker_obj.history(period="1mo")
        if not df_us.empty:
            print(f"SUCCESS: Retrieved {len(df_us)} rows for {ticker_us}")
            print(df_us.tail(2))
        else:
            print(f"FAILURE: No data returned for {ticker_us}")
    except Exception as e:
        print(f"ERROR fetching YF: {e}")

if __name__ == "__main__":
    verify_libraries()
