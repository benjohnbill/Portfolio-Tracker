from sqlalchemy.orm import Session
from datetime import date, timedelta
import pandas as pd
from .price_service import PriceService
from .exchange_service import ExchangeService
from .kis_service import KISService
from ..models import Transaction, Asset, RawDailyPrice, PortfolioSnapshot

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
        # 1. Get transactions and setup date range
        transactions = db.query(Transaction).order_by(Transaction.date).all()
        if not transactions:
            return []

        has_brazil_bond = any(getattr(tx.asset, 'symbol', None) == 'BRAZIL_BOND' for tx in transactions if getattr(tx, 'asset', None))
        brazil_bond_current_value = KISService.get_brazil_bond_value() if has_brazil_bond else 0.0

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

    @staticmethod
    def calculate_invested_capital(db: Session) -> float:
        transactions = db.query(Transaction).all()
        invested = 0.0
        for tx in transactions:
            if tx.type == "BUY":
                invested += float(tx.total_amount or (tx.quantity * tx.price) or 0.0)
            elif tx.type == "SELL":
                invested -= float(tx.total_amount or (tx.quantity * tx.price) or 0.0)
        return max(invested, 0.0)

    @staticmethod
    def get_portfolio_allocation(db: Session):
        txs = db.query(Transaction).all()
        holdings = {}
        for tx in txs:
            holdings[tx.asset_id] = holdings.get(tx.asset_id, 0.0) + (tx.quantity if tx.type == "BUY" else -tx.quantity)

        active_holdings = {asset_id: qty for asset_id, qty in holdings.items() if qty > 0.0001}
        if not active_holdings:
            return []

        current_fx = ExchangeService.get_current_rate()
        has_brazil_bond = False
        for asset_id in active_holdings:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset and asset.symbol == "BRAZIL_BOND":
                has_brazil_bond = True
                break
        brazil_bond_current_value = KISService.get_brazil_bond_value() if has_brazil_bond else 0.0
        result = []
        total_value = 0.0

        for asset_id, qty in active_holdings.items():
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if not asset:
                continue

            if asset.symbol == "BRAZIL_BOND":
                if brazil_bond_current_value > 0:
                    current_price = brazil_bond_current_value / qty if qty > 0 else 0.0
                    value_krw = brazil_bond_current_value
                else:
                    last_tx = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.date.desc()).first()
                    current_price = last_tx.price if last_tx else 1860000.0
                    value_krw = qty * current_price
            else:
                latest_price_row = db.query(RawDailyPrice).filter(
                    RawDailyPrice.ticker == (asset.code if asset.source == "KR" else asset.symbol)
                ).order_by(RawDailyPrice.date.desc()).first()
                current_price = latest_price_row.close_price if latest_price_row else 0.0
                if current_price == 0:
                    last_tx = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.date.desc()).first()
                    current_price = last_tx.price if last_tx else 100.0
                value_krw = qty * current_price * (current_fx if asset.source == "US" else 1.0)

            total_value += value_krw
            result.append({
                "asset": asset.symbol,
                "name": asset.name,
                "quantity": qty,
                "price": current_price,
                "value": value_krw,
                "weight": 0.0,
                "source": asset.source,
                "account_type": asset.account_type.value if asset.account_type else "OVERSEAS",
            })

        for item in result:
            item["weight"] = item["value"] / total_value if total_value > 0 else 0.0

        return sorted(result, key=lambda item: item["value"], reverse=True)

    @staticmethod
    def get_portfolio_summary(db: Session):
        snapshots = db.query(PortfolioSnapshot).count()
        if snapshots == 0:
            return {
                "total_value": 0,
                "invested_capital": 0,
                "metrics": PortfolioService.calculate_metrics([]),
            }

        history = PortfolioService.get_equity_curve(db, period="all")
        if not history:
            return {
                "total_value": 0,
                "invested_capital": 0,
                "metrics": PortfolioService.calculate_metrics([]),
            }

        latest = history[-1]
        return {
            "total_value": latest["total_value"],
            "invested_capital": PortfolioService.calculate_invested_capital(db),
            "metrics": PortfolioService.calculate_metrics(history),
        }
