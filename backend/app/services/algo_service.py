from sqlalchemy.orm import Session
from ..models import Transaction, Asset, AccountType
from .quant_service import QuantService
from .price_service import PriceService
import pandas as pd
from datetime import datetime

class AlgoService:
    @staticmethod
    def get_holdings(db: Session):
        """
        Calculate current holdings based on transaction history.
        Returns a dictionary of {symbol: quantity}.
        """
        transactions = db.query(Transaction).all()
        assets = db.query(Asset).all()
        asset_map = {a.id: a for a in assets}
        
        holdings = {}
        for t in transactions:
            asset = asset_map.get(t.asset_id)
            if not asset: continue
            
            symbol = asset.symbol
            if symbol not in holdings:
                holdings[symbol] = 0.0
            
            if t.type == "BUY":
                holdings[symbol] += t.quantity
            elif t.type == "SELL":
                holdings[symbol] -= t.quantity
        
        # Filter out negligible amounts
        return {s: q for s, q in holdings.items() if q > 0.0001}

    @staticmethod
    def get_action_report(db: Session):
        """
        Main engine for generating trade recommendations based on market signals and current allocation.
        """
        # 1. Fetch current holdings
        holdings = AlgoService.get_holdings(db)
        
        # 2. Fetch Signals from QuantService
        vxn_signal = QuantService.get_vxn_signal(db)
        mstr_signal = QuantService.get_mstr_signal(db)
        ndx_status = QuantService.get_ndx_status(db)
        
        # Additional signals for GLDM and TLT (using US tickers for reliable TA)
        # TODO: Refactor these to use a MarketSignals cache table instead of live fetching
        # For now, bypassing live yfinance calls to ensure 0.1s UI load.
        gldm_ma = 0.0
        gldm_rsi = 50.0
        tlt_ma = 0.0
        tlt_rsi = 50.0
        
        # Current prices for logic evaluation - Fallback to avoid live API calls
        gldm_price = 0.0
        tlt_price = 0.0

        signals = {
            "vxn": vxn_signal,
            "mstr": mstr_signal,
            "ndx": ndx_status,
            "gldm": {"price": gldm_price, "ma_250": gldm_ma, "rsi": gldm_rsi},
            "tlt": {"price": tlt_price, "ma_250": tlt_ma, "rsi": tlt_rsi},
            "timestamp": datetime.now().isoformat()
        }

        actions = []
        
        # ---------------------------------------------------------------------
        # Logic [Part 1: SELL PRIORITY]
        # ---------------------------------------------------------------------
        
        # MSTR: If Z_score > 3.5 OR MNAV > 2.5 -> ACTION: "SELL 100% MSTR -> BUY DBMF" (Hard Exit)
        # MSTR: If Z_score > 2.0 -> ACTION: "SELL 50% MSTR -> BUY DBMF" (Profit Locking)
        if "MSTR" in holdings:
            mstr_z = mstr_signal["z_score"] if mstr_signal else 0
            mstr_ratio = mstr_signal["current_mnav_ratio"] if mstr_signal else 0
            
            if mstr_z > 3.5 or mstr_ratio > 2.5:
                actions.append({
                    "asset": "MSTR", 
                    "action": "SELL 100% MSTR -> BUY DBMF", 
                    "reason": f"Hard Exit: Z-score({mstr_z:.2f}) > 3.5 OR MNAV Ratio({mstr_ratio:.2f}) > 2.5"
                })
            elif mstr_z > 2.0:
                actions.append({
                    "asset": "MSTR", 
                    "action": "SELL 50% MSTR -> BUY DBMF", 
                    "reason": f"Profit Locking: Z-score({mstr_z:.2f}) > 2.0"
                })

        # NDX: If NDX < 250MA AND holding TIGER_2X -> ACTION: "SELL TIGER_2X -> BUY KODEX_1X" (Safety Mode)
        if ndx_status and not ndx_status["is_above_ma"]:
            if "TIGER_2X" in holdings:
                actions.append({
                    "asset": "NDX", 
                    "action": "SELL TIGER_2X -> BUY KODEX_1X", 
                    "reason": f"Safety Mode: NDX({ndx_status['current_price']:.0f}) < 250MA({ndx_status['ma_250']:.0f})"
                })

        # Cash: If GLDM < 250MA AND RSI > 35 AND holding GLDM -> ACTION: "SELL GLDM -> BUY VBIL" (Defensive)
        if gldm_price < gldm_ma and gldm_rsi > 35:
            if "GLDM" in holdings:
                actions.append({
                    "asset": "GLDM", 
                    "action": "SELL GLDM -> BUY VBIL", 
                    "reason": f"Defensive: GLDM Price < 250MA AND RSI({gldm_rsi:.1f}) > 35"
                })

        # ISA Cash: If TLT < 250MA AND RSI > 35 AND holding TLT -> ACTION: "SELL TLT -> BUY BIL" (Defensive)
        if tlt_price < tlt_ma and tlt_rsi > 35:
            if "TLT" in holdings:
                actions.append({
                    "asset": "TLT", 
                    "action": "SELL TLT -> BUY BIL", 
                    "reason": f"Defensive: TLT Price < 250MA AND RSI({tlt_rsi:.1f}) > 35"
                })

        # ---------------------------------------------------------------------
        # Logic [Part 2: BUY PRIORITY] (Only if no SELL signal for that asset group)
        # ---------------------------------------------------------------------
        
        # MSTR: If Z_score < 0 -> ACTION: "SELL DBMF (10% of Pos) -> BUY MSTR" (Aggressive Buy)
        mstr_has_sell = any(a["asset"] == "MSTR" for a in actions)
        if not mstr_has_sell:
            mstr_z = mstr_signal["z_score"] if mstr_signal else 100 # Default to high to avoid buy
            if mstr_z < 0:
                if "DBMF" in holdings:
                    actions.append({
                        "asset": "MSTR", 
                        "action": "SELL DBMF (10% of Pos) -> BUY MSTR", 
                        "reason": f"Aggressive Buy: MSTR Z-score({mstr_z:.2f}) < 0"
                    })

        # NDX: If NDX > 250MA AND holding KODEX_1X -> ACTION: "SELL KODEX_1X -> BUY TIGER_2X" (Growth Mode)
        ndx_has_sell = any(a["asset"] == "NDX" for a in actions)
        if not ndx_has_sell and ndx_status and ndx_status["is_above_ma"]:
            if "KODEX_1X" in holdings:
                actions.append({
                    "asset": "NDX", 
                    "action": "SELL KODEX_1X -> BUY TIGER_2X", 
                    "reason": f"Growth Mode: NDX({ndx_status['current_price']:.0f}) > 250MA({ndx_status['ma_250']:.0f})"
                })

        # ISA Re-entry: If TLT > 250MA AND RSI < 65 AND holding BIL -> ACTION: "SELL BIL -> BUY TLT"
        tlt_has_sell = any(a["asset"] == "TLT" for a in actions)
        if not tlt_has_sell and tlt_price > tlt_ma and tlt_rsi < 65:
            if "BIL" in holdings:
                actions.append({
                    "asset": "TLT", 
                    "action": "SELL BIL -> BUY TLT", 
                    "reason": f"ISA Re-entry: TLT Price > 250MA AND RSI({tlt_rsi:.1f}) < 65"
                })

        # Overseas Re-entry: If GLDM > 250MA AND RSI < 65 AND holding VBIL -> ACTION: "SELL VBIL -> BUY GLDM"
        gldm_has_sell = any(a["asset"] == "GLDM" for a in actions)
        if not gldm_has_sell and gldm_price > gldm_ma and gldm_rsi < 65:
            if "VBIL" in holdings:
                actions.append({
                    "asset": "GLDM", 
                    "action": "SELL VBIL -> BUY GLDM", 
                    "reason": f"Overseas Re-entry: GLDM Price > 250MA AND RSI({gldm_rsi:.1f}) < 65"
                })

        return {
            "signals": signals,
            "account_status": holdings,
            "actions": actions
        }
