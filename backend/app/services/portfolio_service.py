from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, timezone
import pandas as pd
from .price_service import PriceService
from .exchange_service import ExchangeService
from .kis_service import KISService
from .cache_service import CacheService
from ..models import Transaction, Asset, RawDailyPrice, AccountType, AccountSilo

class PortfolioService:
    ISA_KR_CODES = {"379810", "463300", "476760", "453870"}
    VALUATION_SOURCE = "live_equity_curve"
    VALUATION_VERSION = "portfolio-valuation-v1"

    @staticmethod
    def _get_cache_key(prefix: str, period: str = ""):
        return f"portfolio_{prefix}_{period}"

    @staticmethod
    def _get_from_cache(db: Session, key: str):
        return CacheService.get_cache(db, key)

    @staticmethod
    def _set_to_cache(db: Session, key: str, data):
        CacheService.set_cache(db, key, data)

    @staticmethod
    def clear_cache(db: Session):
        # We delete all portfolio_* keys
        from ..models import SystemCache
        db.query(SystemCache).filter(SystemCache.key.like("portfolio_%")).delete(synchronize_session=False)
        db.commit()

    @staticmethod
    def infer_account_type(asset: Asset) -> AccountType:

        if asset.symbol == "BRAZIL_BOND":
            return AccountType.OVERSEAS
        if asset.source == "KR" and (asset.code in PortfolioService.ISA_KR_CODES or asset.symbol in {"QQQ", "CSI300", "TLT", "NIFTY"}):
            return AccountType.ISA
        return asset.account_type or AccountType.OVERSEAS

    @staticmethod
    def infer_account_silo(asset: Asset) -> AccountSilo:
        if asset.symbol == "BRAZIL_BOND":
            return AccountSilo.BRAZIL_BOND
        if asset.source == "KR" and (asset.code in PortfolioService.ISA_KR_CODES or asset.symbol in {"QQQ", "CSI300", "TLT", "NIFTY"}):
            return AccountSilo.ISA_ETF
        return asset.account_silo or AccountSilo.OVERSEAS_ETF

    @staticmethod
    def sync_asset_classification(asset: Asset) -> bool:
        changed = False
        inferred_type = PortfolioService.infer_account_type(asset)
        inferred_silo = PortfolioService.infer_account_silo(asset)
        if asset.account_type != inferred_type:
            asset.account_type = inferred_type
            changed = True
        if asset.account_silo != inferred_silo:
            asset.account_silo = inferred_silo
            changed = True
        return changed

    @staticmethod
    def get_price_lookup_ticker(asset: Asset) -> str:
        """Use market code for KR assets and symbol for US assets."""
        if asset.source == "KR":
            return asset.code or asset.symbol
        return asset.symbol

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
    def _slice_series_to_date(values, date_key: pd.Timestamp) -> pd.Series:
        """Safely slice a pandas Series up to date_key.

        Returns an empty series when values is empty or index cannot be
        treated as datetimes, so callers can apply fallback defaults.
        """
        if values is None:
            return pd.Series(dtype=float)

        try:
            if values.empty:
                return pd.Series(dtype=float)
        except Exception:
            return pd.Series(dtype=float)

        try:
            if not isinstance(values.index, pd.DatetimeIndex):
                return pd.Series(dtype=float)
            return values[:date_key]
        except Exception:
            return pd.Series(dtype=float)

    @staticmethod
    def _resolve_period_start(first_transaction_date: date, today: date, period: str) -> date:
        normalized_period = (period or "1y").lower()
        if normalized_period in {"all", "max"}:
            return first_transaction_date
        if normalized_period == "ytd":
            return max(first_transaction_date, date(today.year, 1, 1))
        if normalized_period == "3m":
            return max(first_transaction_date, today - timedelta(days=90))
        if normalized_period == "1m":
            return max(first_transaction_date, today - timedelta(days=30))
        if normalized_period == "6m":
            return max(first_transaction_date, today - timedelta(days=180))
        # default: 1y
        return max(first_transaction_date, today - timedelta(days=365))

    @staticmethod
    def build_valuation_metadata(history, period: str = "all"):
        return {
            "as_of": history[-1]["date"] if history else None,
            "source": PortfolioService.VALUATION_SOURCE,
            "version": PortfolioService.VALUATION_VERSION,
            "period": (period or "all").lower(),
            "history_points": len(history),
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def get_equity_curve(db: Session, period: str = "1y"):
        """
        Calculates the daily total value of the portfolio in KRW.
        Includes currency conversion, SPY benchmark comparison, and KIS Brazil Bond sync.
        """
        cache_key = PortfolioService._get_cache_key("equity_curve", period)
        cached_data = PortfolioService._get_from_cache(db, cache_key)
        if cached_data is not None:
            return cached_data

        # 1. Get transactions and setup date range
        transactions = db.query(Transaction).order_by(Transaction.date).all()
        if not transactions:
            return []

        has_brazil_bond = any(
            getattr(tx.asset, 'symbol', None) == 'BRAZIL_BOND' or (
                getattr(tx.asset, 'account_silo', None) == AccountSilo.BRAZIL_BOND
            )
            for tx in transactions if getattr(tx, 'asset', None)
        )
        brazil_bond_current_value = KISService.get_brazil_bond_value() if has_brazil_bond else 0.0

        first_transaction_date = transactions[0].date.date()
        today = date.today()

        start_date = PortfolioService._resolve_period_start(first_transaction_date, today, period)
        
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = today.strftime('%Y-%m-%d')

        # 2. Fetch all necessary data
        asset_ids = list({t.asset_id for t in transactions if t.asset_id is not None})
        assets = {a.id: a for a in db.query(Asset).filter(Asset.id.in_(asset_ids)).all()}
        dirty = False
        for asset in assets.values():
            dirty = PortfolioService.sync_asset_classification(asset) or dirty
        if dirty:
            db.commit()
        
        symbols_to_fetch = [
            PortfolioService.get_price_lookup_ticker(a)
            for a in assets.values()
            if a.symbol and PortfolioService.infer_account_silo(a) != AccountSilo.BRAZIL_BOND
        ]
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
            
            symbol_to_id = {
                PortfolioService.get_price_lookup_ticker(a): a.id
                for a in assets.values()
            }
            for symbol in df_pivot.columns:
                if symbol in symbol_to_id:
                    price_data[symbol_to_id[symbol]] = df_pivot[symbol].dropna()
                if symbol == "SPY":
                    spy_history = df_pivot["SPY"].dropna()

        fx_history = ExchangeService.get_usd_krw_history(start_date_str, end_date_str)

        # 3. Calculate daily values
        history = []
        current_holdings = {aid: 0.0 for aid in asset_ids}
        explicit_cashflows = any(t.type in {"DEPOSIT", "WITHDRAW"} for t in transactions)
        cash_balance = 0.0
        invested_capital = 0.0
        previous_absolute_value = None
        performance_value = None
        tx_index = 0
        
        # For benchmark normalization (start SPY at the same value as portfolio)
        initial_portfolio_value = None
        initial_spy_price = None

        current_date = start_date
        while current_date <= today:
            # Update holdings
            net_cashflow = 0.0
            while tx_index < len(transactions) and transactions[tx_index].date.date() <= current_date:
                t = transactions[tx_index]
                if t.type == "BUY":
                    if t.asset_id is not None:
                        current_holdings[t.asset_id] = current_holdings.get(t.asset_id, 0.0) + (t.quantity or 0.0)
                    if explicit_cashflows:
                        cash_balance -= float(t.total_amount or ((t.quantity or 0.0) * (t.price or 0.0)) or 0.0)
                elif t.type == "SELL":
                    if t.asset_id is not None:
                        current_holdings[t.asset_id] = current_holdings.get(t.asset_id, 0.0) - (t.quantity or 0.0)
                    if explicit_cashflows:
                        cash_balance += float(t.total_amount or ((t.quantity or 0.0) * (t.price or 0.0)) or 0.0)
                elif t.type == "DEPOSIT":
                    amount = float(t.total_amount or 0.0)
                    cash_balance += amount
                    invested_capital += amount
                    net_cashflow += amount
                elif t.type == "WITHDRAW":
                    amount = float(t.total_amount or 0.0)
                    cash_balance -= amount
                    invested_capital = max(0.0, invested_capital - amount)
                    net_cashflow -= amount
                tx_index += 1
            
            # Get current FX rate
            date_key = pd.Timestamp(current_date)
            fx_slice = PortfolioService._slice_series_to_date(fx_history, date_key)
            current_fx = PortfolioService._latest_numeric(fx_slice, default=1400.0)
            
            # Calculate total value in KRW
            daily_value_krw = 0
            for aid, qty in current_holdings.items():
                if qty <= 0: continue
                
                asset = assets[aid]
                
                # Special Case: KIS Brazil Bond
                if PortfolioService.infer_account_silo(asset) == AccountSilo.BRAZIL_BOND:
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
            
            absolute_value_krw = daily_value_krw + (cash_balance if explicit_cashflows else 0.0)

            if absolute_value_krw > 0:
                if initial_portfolio_value is None:
                    initial_portfolio_value = absolute_value_krw

                performance_daily_return = None
                if explicit_cashflows:
                    if previous_absolute_value is None or performance_value is None:
                        performance_daily_return = 0.0
                        performance_value = absolute_value_krw
                    elif previous_absolute_value > 0:
                        performance_daily_return = (absolute_value_krw - previous_absolute_value - net_cashflow) / previous_absolute_value
                        performance_value = performance_value * (1 + performance_daily_return)
                    else:
                        performance_daily_return = 0.0
                
                # Calculate Benchmark (Normalized SPY)
                spy_val = 0
                if not spy_history[:date_key].empty:
                    current_spy_price = PortfolioService._latest_numeric(spy_history[:date_key])
                    if initial_spy_price is None and current_spy_price > 0:
                        initial_spy_price = current_spy_price
                    
                    # Benchmark value = (Current SPY / Initial SPY) * Initial Portfolio Value
                    if initial_spy_price and initial_spy_price > 0:
                        spy_val = (current_spy_price / initial_spy_price) * initial_portfolio_value

                alpha = ((absolute_value_krw / initial_portfolio_value) - 1) - ((spy_val / initial_portfolio_value) - 1) if initial_portfolio_value and initial_portfolio_value > 0 else 0
                item = {
                    "date": current_date.isoformat(),
                    "total_value": int(absolute_value_krw),
                    "benchmark_value": int(spy_val),
                    "fx_rate": current_fx,
                    "daily_return": 0,
                    "alpha": round(alpha, 6),
                    "invested_capital": float(invested_capital) if explicit_cashflows else None,
                    "cash_balance": float(cash_balance) if explicit_cashflows else None,
                    "net_cashflow": float(net_cashflow) if explicit_cashflows else None,
                }
                if explicit_cashflows and performance_value is not None:
                    item.update({
                        "performance_value": float(performance_value),
                        "performance_daily_return": float(performance_daily_return or 0.0),
                        "performance_alpha": 0.0,
                        "performance_coverage_status": "ready",
                    })
                history.append(item)
                previous_absolute_value = absolute_value_krw
            
            current_date += timedelta(days=1)

        # 4. Calculate daily returns
        for i in range(1, len(history)):
            prev_val = history[i-1]["total_value"]
            curr_val = history[i]["total_value"]
            history[i]["daily_return"] = (curr_val - prev_val) / prev_val if prev_val > 0 else 0

        PortfolioService._set_to_cache(db, cache_key, history)
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
        cache_key = PortfolioService._get_cache_key("allocation", "")
        cached_data = PortfolioService._get_from_cache(db, cache_key)
        if cached_data is not None:
            return cached_data

        txs = db.query(Transaction).all()
        holdings = {}
        for tx in txs:
            holdings[tx.asset_id] = holdings.get(tx.asset_id, 0.0) + (tx.quantity if tx.type == "BUY" else -tx.quantity)

        active_holdings = {asset_id: qty for asset_id, qty in holdings.items() if qty > 0.0001}
        if not active_holdings:
            return []

        current_fx = ExchangeService.get_current_rate()
        dirty = False
        has_brazil_bond = False
        for asset_id in active_holdings:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                dirty = PortfolioService.sync_asset_classification(asset) or dirty
            if asset and PortfolioService.infer_account_silo(asset) == AccountSilo.BRAZIL_BOND:
                has_brazil_bond = True
                break
        if dirty:
            db.commit()
        brazil_bond_current_value = KISService.get_brazil_bond_value() if has_brazil_bond else 0.0
        result = []
        total_value = 0.0

        for asset_id, qty in active_holdings.items():
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if not asset:
                continue

            if PortfolioService.sync_asset_classification(asset):
                db.add(asset)

            if PortfolioService.infer_account_silo(asset) == AccountSilo.BRAZIL_BOND:
                if brazil_bond_current_value > 0:
                    current_price = brazil_bond_current_value / qty if qty > 0 else 0.0
                    value_krw = brazil_bond_current_value
                else:
                    last_tx = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.date.desc()).first()
                    current_price = last_tx.price if last_tx else 1860000.0
                    value_krw = qty * current_price
            else:
                latest_price_row = db.query(RawDailyPrice).filter(
                    RawDailyPrice.ticker == PortfolioService.get_price_lookup_ticker(asset)
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
                "account_silo": asset.account_silo.value if asset.account_silo else PortfolioService.infer_account_silo(asset).value,
            })

        db.commit()

        for item in result:
            item["weight"] = item["value"] / total_value if total_value > 0 else 0.0

        final_result = sorted(result, key=lambda item: item["value"], reverse=True)
        PortfolioService._set_to_cache(db, cache_key, final_result)
        return final_result

    @staticmethod
    def get_portfolio_summary(db: Session):
        cache_key = PortfolioService._get_cache_key("summary", "")
        cached_data = PortfolioService._get_from_cache(db, cache_key)
        if cached_data is not None:
            return cached_data

        history = PortfolioService.get_equity_curve(db, period="all")
        valuation = PortfolioService.build_valuation_metadata(history, period="all")
        if not history:
            result = {
                "total_value": 0,
                "invested_capital": 0,
                "metrics": PortfolioService.calculate_metrics([]),
                "valuation": valuation,
            }
            PortfolioService._set_to_cache(db, cache_key, result)
            return result

        latest = history[-1]
        result = {
            "total_value": latest["total_value"],
            "invested_capital": PortfolioService.calculate_invested_capital(db),
            "metrics": PortfolioService.calculate_metrics(history),
            "valuation": valuation,
        }
        PortfolioService._set_to_cache(db, cache_key, result)
        return result

