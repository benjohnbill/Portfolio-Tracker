from sqlalchemy.orm import Session
from datetime import date, timedelta
import pandas as pd
from .price_service import PriceService
from .exchange_service import ExchangeService
from .kis_service import KISService
from ..models import Transaction, Asset, RawDailyPrice

class PortfolioService:
    @staticmethod
    def _latest_numeric(values, default: float = 0.0) -> float:
        """Safely read the latest numeric value from a pandas Series/DataFrame slice."""
        if values is None:
            return default

        try:
            latest = values.iloc[-1]
        except Exception:
            return default

        # yfinance may return a DataFrame for Close prices even with a single ticker.
        if isinstance(latest, pd.Series):
            latest = latest.dropna()
            if latest.empty:
                return default
            latest = latest.iloc[0]

        try:
            if pd.isna(latest):
                return default
        except Exception:
            return default

        try:
            return float(latest)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def get_equity_curve(db: Session, period: str = "1y"):
        """
        Calculates the daily total value of the portfolio in KRW.
        Includes currency conversion, SPY benchmark comparison, and KIS Brazil Bond sync.
        """
        # Fetch real-time Brazil Bond value from KIS
        brazil_bond_current_value = KISService.get_brazil_bond_value()

        # 1. Get transactions and setup date range
        transactions = db.query(Transaction).order_by(Transaction.date).all()
        if not transactions:
            return []

        start_date = transactions[0].date.date()
        today = date.today()
        
        if period == "1y":
            start_date = max(start_date, today - timedelta(days=365))
        elif period == "all" or period == "max":
            # Start from the first transaction
            start_date = transactions[0].date.date()
        
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = today.strftime('%Y-%m-%d')

        # 2. Fetch all necessary data
        asset_ids = list(set(t.asset_id for t in transactions))
        assets = {a.id: a for a in db.query(Asset).filter(Asset.id.in_(asset_ids)).all()}
        
        symbols_to_fetch = [a.symbol for a in assets.values() if a.symbol and a.symbol != "BRAZIL_BOND"]
        if "SPY" not in symbols_to_fetch:
            symbols_to_fetch.append("SPY")
        
        raw_prices = db.query(RawDailyPrice).filter(
            RawDailyPrice.ticker.in_(symbols_to_fetch),
            RawDailyPrice.date >= start_date,
            RawDailyPrice.date <= today
        ).all()
        
        price_data = {}
        spy_history = pd.Series(dtype=float)

        if raw_prices:
            df_prices = pd.DataFrame([{
                "date": pd.to_datetime(rp.date),
                "ticker": rp.ticker,
                "close_price": rp.close_price
            } for rp in raw_prices])
            
            df_pivot = df_prices.pivot(index='date', columns='ticker', values='close_price')
            
            symbol_to_id = {a.symbol: a.id for a in assets.values()}
            for symbol in df_pivot.columns:
                if symbol in symbol_to_id:
                    price_data[symbol_to_id[symbol]] = df_pivot[symbol].dropna()
                if symbol == "SPY":
                    spy_history = df_pivot["SPY"].dropna()

        fx_history = ExchangeService.get_usd_krw_history(start_date_str, end_date_str)

        # 3. Calculate daily values
        history = []
        current_holdings = {aid: 0.0 for aid in asset_ids}
        tx_index = 0
        
        # For benchmark normalization (start SPY at the same value as portfolio)
        initial_portfolio_value = None
        initial_spy_price = None

        current_date = start_date
        while current_date <= today:
            # Update holdings
            while tx_index < len(transactions) and transactions[tx_index].date.date() <= current_date:
                t = transactions[tx_index]
                if t.type == "BUY":
                    current_holdings[t.asset_id] += t.quantity
                elif t.type == "SELL":
                    current_holdings[t.asset_id] -= t.quantity
                tx_index += 1
            
            # Get current FX rate
            date_key = pd.Timestamp(current_date)
            fx_slice = fx_history[:date_key]
            current_fx = PortfolioService._latest_numeric(fx_slice, default=1400.0)
            
            # Calculate total value in KRW
            daily_value_krw = 0
            for aid, qty in current_holdings.items():
                if qty <= 0: continue
                
                asset = assets[aid]
                
                # Special Case: KIS Brazil Bond
                if asset.symbol == "BRAZIL_BOND":
                    if current_date == today and brazil_bond_current_value > 0:
                        daily_value_krw += brazil_bond_current_value
                    else:
                        # Fallback for historical/failed KIS API: use last transaction price
                        # Note: In a real scenario, we'd want historical price data for bonds too.
                        # For now, we use the buy price as a proxy if API fails or for historical dates.
                        daily_value_krw += qty * 1864532.0 
                    continue
                
                # Check if aid exists in price_data to avoid KeyError
                if aid in price_data:
                    prices = price_data[aid][:date_key]
                    if not prices.empty:
                        price = PortfolioService._latest_numeric(prices)
                        # If US asset, convert to KRW
                        if asset.source == "US":
                            daily_value_krw += qty * price * current_fx
                        else:
                            daily_value_krw += qty * price
            
            if daily_value_krw > 0:
                if initial_portfolio_value is None:
                    initial_portfolio_value = daily_value_krw
                
                # Calculate Benchmark (Normalized SPY)
                spy_val = 0
                if not spy_history[:date_key].empty:
                    current_spy_price = PortfolioService._latest_numeric(spy_history[:date_key])
                    if initial_spy_price is None and current_spy_price > 0:
                        initial_spy_price = current_spy_price
                    
                    # Benchmark value = (Current SPY / Initial SPY) * Initial Portfolio Value
                    if initial_spy_price and initial_spy_price > 0:
                        spy_val = (current_spy_price / initial_spy_price) * initial_portfolio_value

                history.append({
                    "date": current_date.isoformat(),
                    "total_value": int(daily_value_krw),
                    "benchmark_value": int(spy_val),
                    "fx_rate": current_fx,
                    "daily_return": 0 
                })
            
            current_date += timedelta(days=1)

        # 4. Calculate daily returns
        for i in range(1, len(history)):
            prev_val = history[i-1]["total_value"]
            curr_val = history[i]["total_value"]
            history[i]["daily_return"] = (curr_val - prev_val) / prev_val if prev_val > 0 else 0

        return history

    @staticmethod
    def calculate_metrics(history):
        """
        Calculates high-level performance metrics from equity curve history.
        """
        if not history or len(history) < 2:
            return {
                "total_return": 0,
                "cagr": 0,
                "mdd": 0,
                "sharpe_ratio": 0,
                "volatility": 0
            }

        df = pd.DataFrame(history)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        # 1. Total Return
        start_val = df['total_value'].iloc[0]
        end_val = df['total_value'].iloc[-1]
        total_return = (end_val - start_val) / start_val if start_val > 0 else 0

        # 2. CAGR (Compound Annual Growth Rate)
        days = (df.index[-1] - df.index[0]).days
        years = days / 365.25
        cagr = (end_val / start_val) ** (1/years) - 1 if years > 0 and start_val > 0 else 0

        # 3. MDD (Maximum Drawdown)
        rolling_max = df['total_value'].cummax()
        drawdown = (df['total_value'] - rolling_max) / rolling_max
        mdd = drawdown.min()

        # 4. Volatility (Annualized Standard Deviation of daily returns)
        daily_vol = df['daily_return'].std()
        volatility = daily_vol * (252 ** 0.5) # Annualize

        # 5. Sharpe Ratio (Assuming Risk-Free Rate = 3%)
        rf_rate = 0.03
        excess_return = cagr - rf_rate
        sharpe_ratio = excess_return / volatility if volatility > 0 else 0

        return {
            "total_return": float(total_return),
            "cagr": float(cagr),
            "mdd": float(mdd),
            "volatility": float(volatility),
            "sharpe_ratio": float(sharpe_ratio)
        }
