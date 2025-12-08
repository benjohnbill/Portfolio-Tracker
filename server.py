import logging
import datetime
import numpy as np
import pandas as pd
import yfinance as yf
import FinanceDataReader as fdr
from flask import Flask, jsonify, request
from flask_cors import CORS

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) # Enable CORS for all routes/origins

# --- Configuration ---
# Map Frontend Tickers (Keys) to Actual Data Source Tickers
ASSET_MAP = {
    # Domestic (KRX)
    'QQQ':    {'symbol': '379810', 'source': 'KR', 'name': 'KODEX Nasdaq100 TR'},
    'CSI300': {'symbol': '463300', 'source': 'KR', 'name': 'RISE China CSI300'},
    'TLT':    {'symbol': '476760', 'source': 'KR', 'name': 'ACE US 30Y Treasury Active'},
    'NIFTY':  {'symbol': '453870', 'source': 'KR', 'name': 'TIGER India Nifty50'},
    'BIL':    {'symbol': 'BIL', 'source': 'US', 'name': 'SPDR Bloomberg 1-3 Month T-Bill'},

    # International (US)
    'CTA':    {'symbol': 'CTA', 'source': 'US', 'name': 'Simplify Managed Futures'},
    'GLDM':   {'symbol': 'GLDM', 'source': 'US', 'name': 'SPDR Gold MiniShares'},
    'MSTR':   {'symbol': 'MSTR', 'source': 'US', 'name': 'MicroStrategy'},
    'PFIX':   {'symbol': 'PFIX', 'source': 'US', 'name': 'Simplify Interest Rate Hedge'},
    'VBIL':   {'symbol': 'VBIL', 'source': 'US', 'name': 'VBIL'},
    
    # Benchmark
    'SPY':    {'symbol': 'SPY', 'source': 'US', 'name': 'SPDR S&P 500 ETF (Benchmark)'}
}

# --- Helper Functions ---

def fetch_history(ticker, source, days=400):
    """
    Fetches historical data (Close prices) for the last N days.
    """
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=days)
    
    try:
        if source == 'KR':
            # FinanceDataReader
            df = fdr.DataReader(ticker, start_date, end_date)
            if df.empty:
                logger.warning(f"Empty data for KR:{ticker}")
                return None
            return df['Close']
            
        elif source == 'US':
            # YFinance - Use ignore_tz=True to avoid DST ambiguity errors
            try:
                df = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True, ignore_tz=True)
                if df.empty:
                    logger.warning(f"Empty data for US:{ticker}")
                    return None
                # Handle MultiIndex columns from yf.download
                close_data = df['Close']
                if hasattr(close_data, 'squeeze'):
                    close_data = close_data.squeeze()
                return close_data
            except Exception as e:
                logger.error(f"yfinance download error for {ticker}: {e}")
                return None

            # Naver Finance Scraping (Daily Prices)
            # URL: https://finance.naver.com/item/sise_day.naver?code=466020
            logger.info(f"Scraping Naver Finance for {ticker}...")
            url = f"https://finance.naver.com/item/sise_day.naver?code={ticker}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            all_data = []
            for page in range(1, 45): 
                pg_url = f"{url}&page={page}"
                try:
                    resp = requests.get(pg_url, headers=headers)
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    
                    # Try finding table by class 'type2' (common)
                    table = soup.find('table', class_='type2')
                    
                    if not table: 
                        logger.warning(f"Page {page}: Table not found")
                        break 
                    
                    # Iterate rows
                    for tr in table.find_all('tr'):
                        spans = tr.find_all('span')
                        if len(spans) < 2: continue # Valid rows have multiple spans (date, price...)
                        
                        # Date is usually in the first span's parent or just text
                        # Naver structure: <td align=center><span class='tah p10 gray03'>2023.12.01</span></td>
                        cols = tr.find_all('td')
                        if len(cols) < 2: continue

                        date_text = cols[0].text.strip()
                        price_text = cols[1].text.strip().replace(',', '')
                        
                        if not date_text or not price_text or '.' not in date_text: continue
                        
                        try:
                            date_obj = datetime.datetime.strptime(date_text, "%Y.%m.%d")
                            all_data.append({'Date': date_obj, 'Close': float(price_text)})
                        except ValueError:
                            continue # Skip non-date rows
                        
                except Exception as e:
                    logger.error(f"Naver scrape page {page} error: {e}")
                    continue
            
            if not all_data:
                logger.warning(f"No data scraped for {ticker}")
                return None
                
            df = pd.DataFrame(all_data).set_index('Date').sort_index()
            # Filter by start date just in case
            df = df[df.index >= start_date]
            return df['Close']
            
    except Exception as e:
        logger.error(f"Error fetching {ticker}: {e}")
        return None

def calculate_technical_indicators(series):
    """
    Calculates MA50, MA250, RSI(14) from a pandas Series of prices.
    Uses the latest available value for RSI.
    """
    if series is None or len(series) < 5:
        return None

    # Ensure numeric
    series = series.astype(float)

    # Moving Averages
    ma50 = series.rolling(window=50).mean().iloc[-1]
    ma250 = series.rolling(window=250).mean().iloc[-1]
    
    # Handle NaN if history is short (safely convert to scalar first)
    if pd.isna(ma50) or (hasattr(ma50, '__len__') and len(ma50) == 0):
        ma50 = float(series.mean())
    if pd.isna(ma250) or (hasattr(ma250, '__len__') and len(ma250) == 0):
        ma250 = float(series.mean())

    # RSI 14 Logic
    # Calculate daily price changes
    delta = series.diff()
    
    # Separate gains and losses
    gain = (delta.where(delta > 0, 0))
    loss = (-delta.where(delta < 0, 0))

    # Calculate EMAs (Wilder's Smoothing)
    # Using com=13 which corresponds to alpha=1/14 for Wilder's method
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    
    # Calculate RS and RSI
    rs = avg_gain / avg_loss
    rsi_series = 100 - (100 / (1 + rs))
    
    # Get the latest RSI value
    rsi = rsi_series.iloc[-1]

    # Handle edge case where loss is 0 (RSI = 100)
    if np.isnan(rsi):
        if avg_loss.iloc[-1] == 0 and avg_gain.iloc[-1] > 0:
            rsi = 100
        else:
            rsi = 50 # Default middle ground if undefined

    return {
        'price': float(series.iloc[-1]),
        'ma50': float(ma50),
        'ma250': float(ma250),
        'rsi': float(rsi),
        'history': series.tolist()
    }

# --- Caching & Background Fetch ---
DATA_CACHE = {}
CACHE_LOCK = False

def update_cache():
    global DATA_CACHE
    logger.info("Starting background data fetch...")
    temp_cache = {}
    
    for key, info in ASSET_MAP.items():
        logger.info(f"Fetching {key}...")
        series = fetch_history(info['symbol'], info['source'])
        if series is not None:
             stats = calculate_technical_indicators(series)
             if stats:
                 temp_cache[key] = {
                    **stats,
                    'currency': 'KRW' if info['source'] == 'KR' else 'USD',
                    'name': info['name']
                }
        else:
            logger.warning(f"Failed {key}")
            
    # Removed Mock MNAV/MVRV as requested
    
    DATA_CACHE = temp_cache
    logger.info("Data fetch complete. Cache updated.")

# Start fetch on load (simple threading)
import threading
threading.Thread(target=update_cache, daemon=True).start()

# --- Routes ---

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/api/market-data', methods=['GET'])
def get_market_data():
    """
    Returns cached market data.
    """
    if not DATA_CACHE:
        return jsonify({"status": "loading", "message": "Data fetching in progress..."}), 202
        
    return jsonify(DATA_CACHE)

if __name__ == '__main__':
    logger.info("Starting Portfolio Server on port 8080...")
    app.run(port=8080, debug=True)
