import logging
import datetime
import threading
import os
import json

import numpy as np
import pandas as pd
import yfinance as yf
import FinanceDataReader as fdr
from flask import Flask, jsonify, send_from_directory, send_file
from flask_cors import CORS
import requests

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the directory where server.py is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR)
CORS(app, resources={r"/*": {"origins": "*"}}) # Enable CORS for all routes/origins

# --- Static File Routes ---
@app.route('/')
def index():
    """Serve the main index.html"""
    return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/css/<path:filename>')
def serve_css(filename):
    """Serve CSS files"""
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve JavaScript files"""
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)

@app.route('/img/<path:filename>')
def serve_img(filename):
    """Serve image files"""
    return send_from_directory(os.path.join(BASE_DIR, 'img'), filename)

# --- Configuration ---
# Map Frontend Tickers (Keys) to Actual Data Source Tickers

# Load ASSET_MAP on module load
ASSET_MAP = {}
ASSET_MAP1 = {
    # Domestic (KRX)
    'QQQ':    {'symbol': '379810', 'source': 'KR', 'name': 'KODEX Nasdaq100 TR'},
    'CSI300': {'symbol': '463300', 'source': 'KR', 'name': 'RISE China CSI300'},
    'TLT':    {'symbol': '476760', 'source': 'KR', 'name': 'ACE US 30Y Treasury Active'},
    'NIFTY':  {'symbol': '453870', 'source': 'KR', 'name': 'TIGER India Nifty50'},
    'BIL':    {'symbol': 'BIL', 'source': 'US', 'name': 'SPDR Bloomberg 1-3 Month T-Bill'},

    # International (US)
    'DBMF':   {'symbol': 'DBMF', 'source': 'US', 'name': 'iMGP DBi Managed Futures'},
    'GLDM':   {'symbol': 'GLDM', 'source': 'US', 'name': 'SPDR Gold MiniShares'},
    'MSTR':   {'symbol': 'MSTR', 'source': 'US', 'name': 'MicroStrategy'},
    'PFIX':   {'symbol': 'PFIX', 'source': 'US', 'name': 'Simplify Interest Rate Hedge'},
    'VBIL':   {'symbol': 'VBIL', 'source': 'US', 'name': 'VBIL'},

    # Benchmark
    'SPY':    {'symbol': 'SPY', 'source': 'US', 'name': 'SPDR S&P 500 ETF (Benchmark)'},

    # Diagnostics - Real US TLT for signal analysis
    'TLT_US': {'symbol': 'TLT', 'source': 'US', 'name': 'iShares 20+ Year Treasury Bond ETF (Signal)'}
}

def load_asset_map(json_path: str = "asset_map.json"):
    """
    Load the ASSET_MAP configuration from a JSON file.
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"JSON file not found: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        asset_map = json.load(f)

    return asset_map

def get_asset_info(ticker: str, asset_map: dict):
    """
    Return the information of a given ticker.
    """
    return asset_map.get(ticker, None)


# Example:
# info = get_asset_info("QQQ", asset_map)
# print(info)


# --- Helper Functions ---

def fetch_history(ticker, source, days=400):
    """
    Fetches historical data (Close prices) from fixed inception date.
    Instead of rolling window, uses fixed start date (2024-03-12).
    Data accumulates over time rather than dropping old data.
    """
    end_date = datetime.datetime.now()
    # Fixed start date: 2024-03-12 (TLT KR listing date, earliest common date for all assets)
    fixed_start = datetime.datetime(2024, 3, 12)
    start_date = fixed_start

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
                # Only squeeze if it's a DataFrame with single column (MultiIndex case)
                if isinstance(close_data, pd.DataFrame):
                    close_data = close_data.squeeze(axis=1)
                # Ensure we always return a Series, not a scalar
                if not isinstance(close_data, pd.Series):
                    return None
                return close_data
            except Exception as e:
                logger.error(f"yfinance download error for {ticker}: {e}")
                return None
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
            rsi = 50  # Default middle ground if undefined

    return {
        'price': float(series.iloc[-1]),
        'ma50': float(ma50),
        'ma250': float(ma250),
        'rsi': float(rsi),
        'history': series.tolist(),
        'dates': series.index.strftime('%Y-%m-%d').tolist()  # Actual trading dates
    }

# --- Caching & Background Fetch (Incremental Update System) ---
DATA_CACHE = {}
PRICE_HISTORY_FILE = os.path.join(BASE_DIR, "price_history.json")
PRICE_HISTORY_OLD_FILE = os.path.join(BASE_DIR, "price_history_old.json")
INCEPTION_DATE = datetime.datetime(2024, 3, 12)


def load_price_history():
    """
    Load price history from JSON file.
    Returns dict with structure: { "last_updated": "...", "data": { ticker: { dates, history } } }
    """
    if not os.path.exists(PRICE_HISTORY_FILE):
        logger.info("No price history file found. Will fetch full history.")
        return None
    
    try:
        with open(PRICE_HISTORY_FILE, 'r', encoding='utf-8') as f:
            history = json.load(f)
        logger.info(f"Loaded price history from {history.get('last_updated', 'unknown')}")
        return history
    except Exception as e:
        logger.error(f"Error loading price history: {e}")
        return None


def get_tmax_from_history(history_data, ticker):
    """
    Get the most recent date (T_max) for a specific ticker from history.
    Returns datetime object or None.
    """
    if not history_data or 'data' not in history_data:
        return None
    
    ticker_data = history_data['data'].get(ticker)
    if not ticker_data or 'dates' not in ticker_data or len(ticker_data['dates']) == 0:
        return None
    
    last_date_str = ticker_data['dates'][-1]
    try:
        return datetime.datetime.strptime(last_date_str, '%Y-%m-%d')
    except:
        return None


def fetch_incremental(ticker, source, start_date, end_date):
    """
    Fetch only the missing data range [start_date, end_date].
    Returns a pandas Series or None.
    """
    try:
        if source == 'KR':
            df = fdr.DataReader(ticker, start_date, end_date)
            if df.empty:
                return None
            return df['Close']
        elif source == 'US':
            try:
                df = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True, ignore_tz=True)
                if df.empty:
                    return None
                close_data = df['Close']
                # Only squeeze if it's a DataFrame with single column (MultiIndex case)
                # Don't squeeze if it would result in a scalar
                if isinstance(close_data, pd.DataFrame):
                    close_data = close_data.squeeze(axis=1)
                # Ensure we always return a Series, not a scalar
                if not isinstance(close_data, pd.Series):
                    return None
                return close_data
            except Exception as e:
                logger.error(f"yfinance incremental fetch error for {ticker}: {e}")
                return None
    except Exception as e:
        logger.error(f"Error in incremental fetch for {ticker}: {e}")
        return None


def save_price_history(history_data):
    """
    Save price history to JSON file with safety backup.
    Creates price_history_old.json before overwriting.
    """
    try:
        # Safety: backup old file first
        if os.path.exists(PRICE_HISTORY_FILE):
            if os.path.exists(PRICE_HISTORY_OLD_FILE):
                os.remove(PRICE_HISTORY_OLD_FILE)
            os.rename(PRICE_HISTORY_FILE, PRICE_HISTORY_OLD_FILE)
            logger.info("Created backup: price_history_old.json")
        
        # Save new data
        with open(PRICE_HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, indent=2)
        
        logger.info(f"Price history saved: {len(history_data.get('data', {}))} assets, updated {history_data.get('last_updated', 'unknown')}")
        return True
    except Exception as e:
        logger.error(f"Error saving price history: {e}")
        # Try to restore old file if save failed
        if os.path.exists(PRICE_HISTORY_OLD_FILE) and not os.path.exists(PRICE_HISTORY_FILE):
            os.rename(PRICE_HISTORY_OLD_FILE, PRICE_HISTORY_FILE)
            logger.info("Restored price history from backup after save failure")
        return False


def build_cache_from_history(history_data):
    """
    Build DATA_CACHE structure from history data.
    Calculates technical indicators from historical prices.
    """
    if not history_data or 'data' not in history_data:
        return {}
    
    temp_cache = {}
    
    for ticker, data in history_data['data'].items():
        # Skip tickers not in current ASSET_MAP (prevents ghost data like old CTA)
        if ticker not in ASSET_MAP:
            logger.debug(f"Skipping {ticker}: not in ASSET_MAP")
            continue
            
        if 'dates' not in data or 'history' not in data:
            continue
        
        dates = data['dates']
        history = data['history']
        
        if len(history) < 5:
            continue
        
        try:
            series = pd.Series(history, index=pd.to_datetime(dates))
            series = series.astype(float)
            
            # Calculate indicators
            price = float(series.iloc[-1])
            ma50 = float(series.rolling(window=50).mean().iloc[-1]) if len(series) >= 50 else float(series.mean())
            ma250 = float(series.rolling(window=250).mean().iloc[-1]) if len(series) >= 250 else float(series.mean())
            
            # RSI calculation
            delta = series.diff()
            gain = delta.where(delta > 0, 0)
            loss = -delta.where(delta < 0, 0)
            avg_gain = gain.ewm(com=13, adjust=False).mean()
            avg_loss = loss.ewm(com=13, adjust=False).mean()
            rs = avg_gain / avg_loss
            rsi_series = 100 - (100 / (1 + rs))
            rsi = float(rsi_series.iloc[-1]) if not np.isnan(rsi_series.iloc[-1]) else 50
            
            # Get asset info for currency
            asset_info = ASSET_MAP.get(ticker, {})
            currency = 'KRW' if asset_info.get('source') == 'KR' else 'USD'
            
            temp_cache[ticker] = {
                'price': price,
                'ma50': ma50,
                'ma250': ma250,
                'rsi': rsi,
                'history': history,
                'dates': dates,
                'currency': currency,
                'name': asset_info.get('name', ticker)
            }
        except Exception as e:
            logger.error(f"Error building cache for {ticker}: {e}")
            continue
    
    return temp_cache


def update_cache():
    """
    Incremental update: Load local history, fetch only missing dates, merge & save.
    """
    global DATA_CACHE
    logger.info("Starting incremental data update...")
    
    today = datetime.datetime.now().date()
    today_str = today.strftime('%Y-%m-%d')
    
    # Step 1: Load existing history
    history_data = load_price_history()
    if history_data is None:
        history_data = {"last_updated": "", "data": {}}
    
    data_updated = False
    api_called = False
    
    # Step 2: For each asset, check T_max and fetch incrementally
    for key, info in ASSET_MAP.items():
        t_max = get_tmax_from_history(history_data, key)
        
        if t_max and t_max.date() >= today:
            # Data is already up to date, skip API call
            logger.info(f"[{key}] Already up to date (T_max: {t_max.date()}). Skipping API.")
            continue
        
        # Determine fetch range
        if t_max:
            # Incremental: fetch from T_max + 1 day
            fetch_start = t_max + datetime.timedelta(days=1)
            logger.info(f"[{key}] Incremental fetch: {fetch_start.date()} ~ {today}")
        else:
            # Full fetch from inception
            fetch_start = INCEPTION_DATE
            logger.info(f"[{key}] Full fetch: {fetch_start.date()} ~ {today}")
        
        # Step 3: Fetch from API
        api_called = True
        new_series = fetch_incremental(info['symbol'], info['source'], fetch_start, datetime.datetime.now())
        
        # Check if new_series is valid (handle both Series and scalar cases)
        series_len = len(new_series) if hasattr(new_series, '__len__') else (1 if new_series is not None else 0)
        if new_series is not None and series_len > 0:
            new_dates = new_series.index.strftime('%Y-%m-%d').tolist()
            new_prices = new_series.tolist()
            
            # Step 4: Merge with existing data
            if key in history_data['data']:
                existing = history_data['data'][key]
                old_dates = existing.get('dates', [])
                old_prices = existing.get('history', [])
                
                # Create date->price map and merge
                price_map = {d: p for d, p in zip(old_dates, old_prices)}
                for d, p in zip(new_dates, new_prices):
                    price_map[d] = p
                
                # Sort by date
                sorted_dates = sorted(price_map.keys())
                merged_dates = sorted_dates
                merged_prices = [price_map[d] for d in sorted_dates]
                
                # Integrity check: ensure no gaps > 5 days (accounting for weekends/holidays)
                if len(old_dates) > 0 and len(new_dates) > 0:
                    last_old = datetime.datetime.strptime(old_dates[-1], '%Y-%m-%d')
                    first_new = datetime.datetime.strptime(new_dates[0], '%Y-%m-%d')
                    gap = (first_new - last_old).days
                    if gap > 10:  # More than 2 weeks gap is suspicious
                        logger.warning(f"[{key}] Large gap detected: {gap} days between {old_dates[-1]} and {new_dates[0]}")
            else:
                merged_dates = new_dates
                merged_prices = new_prices
            
            history_data['data'][key] = {
                'dates': merged_dates,
                'history': merged_prices
            }
            data_updated = True
            logger.info(f"[{key}] Updated: {len(merged_dates)} total records")
        else:
            logger.warning(f"[{key}] No new data fetched")
            # If we have existing data, keep it
            if key not in history_data['data']:
                logger.warning(f"[{key}] No existing data either")
    
    # Step 5: Save updated history
    if data_updated:
        history_data['last_updated'] = today_str
        save_price_history(history_data)
    elif not api_called:
        logger.info("All data up to date. No API calls needed.")
    
    # Step 6: Build cache from history
    DATA_CACHE = build_cache_from_history(history_data)
    logger.info(f"Cache built with {len(DATA_CACHE)} assets")


def migrate_old_backup():
    """
    Migrate old price_backup.json to new price_history.json format if exists.
    Call this once on startup.
    """
    old_backup_file = os.path.join(BASE_DIR, "price_backup.json")
    
    if os.path.exists(old_backup_file) and not os.path.exists(PRICE_HISTORY_FILE):
        logger.info("Found old price_backup.json. Migrating to price_history.json...")
        try:
            with open(old_backup_file, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
            
            # Old format is the same as new format, just rename
            with open(PRICE_HISTORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(old_data, f, indent=2)
            
            # Rename old file to indicate migration complete
            os.rename(old_backup_file, old_backup_file + ".migrated")
            logger.info("Migration complete. Old file renamed to price_backup.json.migrated")
        except Exception as e:
            logger.error(f"Migration failed: {e}")


# Background fetch is now started in __main__ block after ASSET_MAP is loaded

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

@app.route('/api/stress-test', methods=['GET'])
def get_stress_test_data():
    """
    Fetch historical price data for stress test simulation.
    Returns daily prices for Base 6 assets + SPY during crisis periods.
    Uses proxy mappings for assets that didn't exist in earlier periods.
    
    CACHING: Data is saved to stress_test_cache.json after first fetch.
    Historical crisis data is static, so it never needs to be re-fetched.
    """
    STRESS_TEST_CACHE_FILE = os.path.join(BASE_DIR, "stress_test_cache.json")
    
    # Check if cache exists and is valid
    if os.path.exists(STRESS_TEST_CACHE_FILE):
        try:
            with open(STRESS_TEST_CACHE_FILE, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # Verify cache has both scenarios with data
            if ('2020' in cached_data and '2022' in cached_data and
                len(cached_data.get('2020', {}).get('assets', {})) >= 6 and
                len(cached_data.get('2022', {}).get('assets', {})) >= 6):
                logger.info("Stress test: Using cached data from stress_test_cache.json")
                return jsonify(cached_data)
            else:
                logger.warning("Stress test: Cache incomplete, re-fetching...")
        except Exception as e:
            logger.warning(f"Stress test: Cache read error, re-fetching... ({e})")
    
    # Stress Test Scenarios - Hard-coded dates
    SCENARIOS = {
        '2020': {
            'name': '2020 Pandemic Crash',
            'start': '2020-02-19',
            'end': '2020-03-23',
            # Proxy mappings for 2020
            'assets': {
                'QQQ': 'QQQ',
                'TLT': 'TLT',
                'GLDM': 'GLD',  # GLDM proxy to GLD (older, more data)
                'CSI300': '000300.SS',  # CSI 300 Index
                'MSTR': 'BTC-USD',  # Bitcoin spot as MSTR proxy
                'DBMF': 'DBMF',  # DBMF direct
                'SPY': 'SPY'  # Benchmark
            }
        },
        '2022': {
            'name': '2022 Inflation Bear',
            'start': '2022-01-03',
            'end': '2022-10-12',
            # Use actual assets for 2022 (with some proxies for consistency)
            'assets': {
                'QQQ': 'QQQ',
                'TLT': 'TLT',
                'GLDM': 'GLDM',
                'CSI300': '000300.SS',
                'MSTR': 'MSTR',  # Actual MSTR
                'DBMF': 'DBMF',  # DBMF direct
                'SPY': 'SPY'
            }
        }
    }
    
    result = {}
    
    for scenario_key, scenario in SCENARIOS.items():
        start_date = datetime.datetime.strptime(scenario['start'], '%Y-%m-%d')
        end_date = datetime.datetime.strptime(scenario['end'], '%Y-%m-%d')
        
        scenario_data = {
            'name': scenario['name'],
            'start': scenario['start'],
            'end': scenario['end'],
            'assets': {}
        }
        
        for asset_key, ticker in scenario['assets'].items():
            try:
                # Fetch data from yfinance
                logger.info(f"Stress test: Fetching {ticker} for {scenario_key}...")
                df = yf.download(ticker, start=start_date, end=end_date + datetime.timedelta(days=1), 
                                progress=False, auto_adjust=True, ignore_tz=True)
                
                if df.empty:
                    logger.warning(f"Stress test: Empty data for {ticker} in {scenario_key}")
                    continue
                
                # Handle MultiIndex columns
                close_data = df['Close']
                if isinstance(close_data, pd.DataFrame):
                    close_data = close_data.squeeze(axis=1)
                
                if not isinstance(close_data, pd.Series):
                    continue
                
                # Convert to list format
                dates = close_data.index.strftime('%Y-%m-%d').tolist()
                prices = close_data.tolist()
                
                scenario_data['assets'][asset_key] = {
                    'ticker': ticker,  # Actual ticker used
                    'dates': dates,
                    'prices': prices
                }
                
            except Exception as e:
                logger.error(f"Stress test fetch error for {ticker}: {e}")
                continue
        
        result[scenario_key] = scenario_data
    
    # Save to cache file for future use
    try:
        with open(STRESS_TEST_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        logger.info(f"Stress test: Data cached to {STRESS_TEST_CACHE_FILE}")
    except Exception as e:
        logger.error(f"Stress test: Failed to save cache: {e}")
    
    return jsonify(result)


@app.route('/api/exchange-rate', methods=['GET'])
def get_exchange_rate():
    """
    Returns USD/KRW exchange rate from external API.
    Falls back to cached rate if API fails.
    """

    
    try:
        # Using exchangerate-api.com (free tier)
        response = requests.get(
            'https://api.exchangerate-api.com/v4/latest/USD',
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            krw_rate = data.get('rates', {}).get('KRW', 1400)
            return jsonify({
                "success": True,
                "rate": krw_rate,
                "source": "exchangerate-api.com",
                "timestamp": data.get('time_last_updated', '')
            })
    except Exception as e:
        logger.warning(f"Exchange rate API error: {e}")
    
    # Fallback rate
    return jsonify({
        "success": True,
        "rate": 1410,  # Fallback rate
        "source": "fallback",
        "timestamp": ""
    })

# --- Initialization ---
# Load ASSET_MAP first, then start background fetch
ASSET_MAP = load_asset_map()
print("Loaded ASSET_MAP:")
#for key, info in ASSET_MAP.items():
#    print(f"{key}: {info}")

# Migrate old backup if exists
migrate_old_backup()

# IMPORTANT: Load existing price_history.json into cache IMMEDIATELY
# This ensures all assets (including TQQQ) are available from first API request
# Background thread will update incrementally later
existing_history = load_price_history()
if existing_history and 'data' in existing_history:
    DATA_CACHE = build_cache_from_history(existing_history)
    logger.info(f"Initial cache loaded with {len(DATA_CACHE)} assets from price_history.json")
else:
    DATA_CACHE = {}
    logger.warning("No existing price history found. Cache is empty until update completes.")

# Start background data fetch after ASSET_MAP is loaded (for incremental updates)
threading.Thread(target=update_cache, daemon=True).start()

if __name__ == '__main__':
    logger.info("Starting Portfolio Server on port 8080...")
    app.run(port=8080, debug=True)
