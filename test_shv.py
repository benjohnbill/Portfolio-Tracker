import FinanceDataReader as fdr
import pandas as pd

def test_shv():
    print("Testing SHV (466020)...")
    try:
        # Try raw code
        df = fdr.DataReader('466020', '2024-01-01')
        if not df.empty:
            print(f"Success 466020: {len(df)} rows")
            print(df.tail(2))
        else:
            print("Empty dataframe for 466020")
            
        # Try with KS prefix if empty
        if df.empty:
            print("Trying KRX:466020...")
            df = fdr.DataReader('KRX:466020', '2024-01-01')
            if not df.empty:
                 print(f"Success KRX:466020: {len(df)} rows")
            else:
                 print("Empty dataframe for KRX:466020")

    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    test_shv()
