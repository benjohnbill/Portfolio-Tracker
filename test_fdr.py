import FinanceDataReader as fdr
import pandas as pd

def test_fdr():
    print("Testing FinanceDataReader...")
    try:
        # Example: Fetch Samsung Electronics
        df = fdr.DataReader('005930', '2025-01-01')
        print("Fetch Success:")
        print(df.head())
    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    test_fdr()
