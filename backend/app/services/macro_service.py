from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import FinanceDataReader as fdr
import numpy as np
import pandas as pd
import yfinance as yf


class MacroService:
    BUCKET_ORDER = ["Liquidity/FCI", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]

    @staticmethod
    def _date_str(days: int) -> str:
        return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    @staticmethod
    def _safe_series(key: str, days: int = 3650) -> pd.Series:
        df = fdr.DataReader(f"FRED:{key}", MacroService._date_str(days))
        if df.empty:
            return pd.Series(dtype=float)
        return df.iloc[:, 0].dropna().astype(float)

    @staticmethod
    def _safe_yf_series(symbol: str, days: int = 3650) -> pd.Series:
        start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        df = yf.download(symbol, start=start, progress=False, auto_adjust=True)
        if df.empty:
            return pd.Series(dtype=float)
        close = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        return close.dropna().astype(float)

    @staticmethod
    def _trend(series: pd.Series, window: int = 20) -> str:
        if series.empty:
            return "flat"
        ma = series.rolling(window=min(window, len(series))).mean().iloc[-1]
        current = series.iloc[-1]
        if pd.isna(ma):
            return "flat"
        if current > ma:
            return "up"
        if current < ma:
            return "down"
        return "flat"

    @staticmethod
    def _state_from_percentiles(series: pd.Series, supportive_high: bool = True, hard_floor: Optional[float] = None) -> str:
        if series.empty:
            return "neutral"
        current = float(series.iloc[-1])
        p20 = float(np.percentile(series, 20))
        p80 = float(np.percentile(series, 80))
        if supportive_high:
            red = p20 if hard_floor is None else max(p20, hard_floor)
            green = p80
            if current >= green:
                return "supportive"
            if current <= red:
                return "adverse"
            return "neutral"
        red = p80 if hard_floor is None else max(p80, hard_floor)
        green = p20
        if current >= red:
            return "adverse"
        if current <= green:
            return "supportive"
        return "neutral"

    @staticmethod
    def _state_from_meta(indicator_key: str, series: pd.Series) -> str:
        """Generic threshold-based classifier driven by INDICATOR_META.baseline_thresholds.
        Used for indicators where absolute level has policy/academic precedent
        (CPI, Core PCE, GDP, NFP, Sahm, NFCI, T10Y3M)."""
        from ..data.macro_indicator_meta import INDICATOR_META
        if series.empty:
            return "neutral"
        meta = INDICATOR_META.get(indicator_key)
        if meta is None:
            return "neutral"
        thresholds = meta.baseline_thresholds
        current = float(series.iloc[-1])
        if "supportive_below" in thresholds and current <= thresholds["supportive_below"]:
            return "supportive"
        if "supportive_above" in thresholds and current >= thresholds["supportive_above"]:
            return "supportive"
        if "adverse_above" in thresholds and current >= thresholds["adverse_above"]:
            return "adverse"
        if "adverse_below" in thresholds and current <= thresholds["adverse_below"]:
            return "adverse"
        if "neutral_below" in thresholds and current < thresholds["neutral_below"]:
            return "neutral"
        return "neutral"

    @staticmethod
    def _series_to_indicator(
        *,
        key: str,
        bucket: str,
        label: str,
        series: pd.Series,
        unit: str,
        source: str,
        state: str,
        trend_window: int = 20,
        release_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        if series.empty:
            return {
                "key": key,
                "bucket": bucket,
                "label": label,
                "value": None,
                "unit": unit,
                "trend": "flat",
                "state": "neutral",
                "source": source,
                "observationDate": None,
                "releaseDate": release_date,
                "knownAsOf": datetime.now().date().isoformat(),
            }

        latest_idx = series.index[-1]
        observation_date = pd.Timestamp(latest_idx).date().isoformat()
        return {
            "key": key,
            "bucket": bucket,
            "label": label,
            "value": round(float(series.iloc[-1]), 3),
            "unit": unit,
            "trend": MacroService._trend(series, trend_window),
            "state": state,
            "source": source,
            "observationDate": observation_date,
            "releaseDate": release_date or observation_date,
            "knownAsOf": datetime.now().date().isoformat(),
        }

    @staticmethod
    def _yoy(series: pd.Series, periods: int = 12) -> pd.Series:
        return ((series / series.shift(periods)) - 1.0).dropna() * 100

    @staticmethod
    def _difference(series: pd.Series, periods: int = 1) -> pd.Series:
        return series.diff(periods).dropna()

    @staticmethod
    def _moving_average(series: pd.Series, periods: int = 3) -> pd.Series:
        return series.rolling(periods).mean().dropna()

    @staticmethod
    def _build_net_liquidity() -> Dict[str, Any]:
        start_date = MacroService._date_str(365 * 3)
        walcl = fdr.DataReader("FRED:WALCL", start_date)
        wdtgal = fdr.DataReader("FRED:WDTGAL", start_date)
        rrp = fdr.DataReader("FRED:RRPONTSYD", start_date)

        if any(df.empty for df in [walcl, wdtgal, rrp]):
            return MacroService._series_to_indicator(
                key="net_liquidity",
                bucket="Liquidity/FCI",
                label="Net Liquidity",
                series=pd.Series(dtype=float),
                unit="T",
                source="FRED",
                state="neutral",
            )

        df = pd.DataFrame(index=pd.date_range(start=start_date, end=datetime.now()))
        df = df.join([walcl, wdtgal, rrp])
        df.columns = ["WALCL", "WDTGAL", "RRP"]
        df = df.ffill().dropna()
        df["Net_Liquidity"] = (df["WALCL"] / 1_000_000) - (df["WDTGAL"] / 1_000_000) - (df["RRP"] / 1_000)
        state = MacroService._state_from_percentiles(df["Net_Liquidity"], supportive_high=True, hard_floor=5.0)
        return MacroService._series_to_indicator(
            key="net_liquidity",
            bucket="Liquidity/FCI",
            label="Net Liquidity",
            series=df["Net_Liquidity"],
            unit="T",
            source="FRED",
            state=state,
        )

    @staticmethod
    def get_macro_snapshot() -> Dict[str, Any]:
        indicators: List[Dict[str, Any]] = []

        net_liquidity = MacroService._build_net_liquidity()
        indicators.append(net_liquidity)

        m2_series = MacroService._yoy(MacroService._safe_series("M2SL"))
        indicators.append(MacroService._series_to_indicator(
            key="m2_yoy",
            bucket="Liquidity/FCI",
            label="M2 YoY",
            series=m2_series,
            unit="%",
            source="FRED",
            state=MacroService._state_from_percentiles(m2_series, supportive_high=True),
            trend_window=3,
        ))

        nfci_series = MacroService._safe_series("NFCI", 365 * 5)
        indicators.append(MacroService._series_to_indicator(
            key="nfci",
            bucket="Liquidity/FCI",
            label="NFCI",
            series=nfci_series,
            unit="index",
            source="FRED",
            state=MacroService._state_from_meta("nfci", nfci_series),
            trend_window=4,
        ))

        real_yield_series = MacroService._safe_series("DFII10", 365 * 3)
        indicators.append(MacroService._series_to_indicator(
            key="real_yield_10y",
            bucket="Rates",
            label="10Y Real Yield",
            series=real_yield_series,
            unit="%",
            source="FRED",
            state=MacroService._state_from_percentiles(real_yield_series, supportive_high=False, hard_floor=1.5),
        ))

        spread_series = MacroService._safe_series("T10Y2Y", 365 * 5)
        spread_state = "supportive"
        if not spread_series.empty:
            latest_spread = float(spread_series.iloc[-1])
            if latest_spread < -0.5:
                spread_state = "adverse"
            elif latest_spread < 0:
                spread_state = "neutral"
        indicators.append(MacroService._series_to_indicator(
            key="yield_spread_10y2y",
            bucket="Rates",
            label="10Y-2Y Spread",
            series=spread_series,
            unit="%",
            source="FRED",
            state=spread_state,
            trend_window=5,
        ))

        cpi_series = MacroService._yoy(MacroService._safe_series("CPIAUCSL"))
        cpi_state = "neutral"
        if not cpi_series.empty:
            latest_cpi = float(cpi_series.iloc[-1])
            if latest_cpi <= 2.5:
                cpi_state = "supportive"
            elif latest_cpi >= 3.5:
                cpi_state = "adverse"
        indicators.append(MacroService._series_to_indicator(
            key="cpi_yoy",
            bucket="Inflation",
            label="CPI YoY",
            series=cpi_series,
            unit="%",
            source="FRED",
            state=cpi_state,
            trend_window=3,
        ))

        core_pce_series = MacroService._yoy(MacroService._safe_series("PCEPILFE"))
        pce_state = "neutral"
        if not core_pce_series.empty:
            latest_pce = float(core_pce_series.iloc[-1])
            if latest_pce <= 2.5:
                pce_state = "supportive"
            elif latest_pce >= 3.0:
                pce_state = "adverse"
        indicators.append(MacroService._series_to_indicator(
            key="core_pce_yoy",
            bucket="Inflation",
            label="Core PCE YoY",
            series=core_pce_series,
            unit="%",
            source="FRED",
            state=pce_state,
            trend_window=3,
        ))

        gdp_series = MacroService._safe_series("A191RL1Q225SBEA", 365 * 10)
        gdp_state = "neutral"
        if not gdp_series.empty:
            latest_gdp = float(gdp_series.iloc[-1])
            if latest_gdp >= 2.0:
                gdp_state = "supportive"
            elif latest_gdp <= 0.5:
                gdp_state = "adverse"
        indicators.append(MacroService._series_to_indicator(
            key="real_gdp_growth",
            bucket="Growth/Labor",
            label="Real GDP Growth",
            series=gdp_series,
            unit="%",
            source="FRED",
            state=gdp_state,
            trend_window=2,
        ))

        payems_series = MacroService._safe_series("PAYEMS", 365 * 10)
        nfp_series = MacroService._moving_average(MacroService._difference(payems_series), 3)
        nfp_state = "neutral"
        if not nfp_series.empty:
            latest_nfp = float(nfp_series.iloc[-1])
            if latest_nfp >= 150:
                nfp_state = "supportive"
            elif latest_nfp <= 50:
                nfp_state = "adverse"
        indicators.append(MacroService._series_to_indicator(
            key="nfp_change_3m_avg",
            bucket="Growth/Labor",
            label="NFP 3M Avg Change",
            series=nfp_series,
            unit="k",
            source="FRED",
            state=nfp_state,
            trend_window=3,
        ))

        sahm_series = MacroService._safe_series("SAHMREALTIME", 365 * 10)
        indicators.append(MacroService._series_to_indicator(
            key="sahm_rule",
            bucket="Growth/Labor",
            label="Sahm Rule",
            series=sahm_series,
            unit="pp",
            source="FRED",
            state=MacroService._state_from_meta("sahm_rule", sahm_series),
            trend_window=3,
        ))

        vxn_series = MacroService._safe_yf_series("^VXN", 365 * 3)
        vxn_state = MacroService._state_from_percentiles(vxn_series, supportive_high=False)
        indicators.append(MacroService._series_to_indicator(
            key="vxn",
            bucket="Stress/Sentiment",
            label="VXN",
            series=vxn_series,
            unit="index",
            source="Yahoo Finance",
            state=vxn_state,
        ))

        credit_spread_series = MacroService._safe_series("BAMLC0A0CM", 365 * 5)
        indicators.append(MacroService._series_to_indicator(
            key="credit_spread",
            bucket="Stress/Sentiment",
            label="Credit Spread",
            series=credit_spread_series,
            unit="%",
            source="FRED",
            state=MacroService._state_from_percentiles(credit_spread_series, supportive_high=False),
        ))

        bucket_map: Dict[str, List[Dict[str, Any]]] = {}
        for indicator in indicators:
            bucket_map.setdefault(indicator["bucket"], []).append(indicator)

        bucket_summaries: List[Dict[str, Any]] = []
        states: List[str] = []
        for bucket_name in MacroService.BUCKET_ORDER:
            bucket_indicators = bucket_map.get(bucket_name, [])
            state_values = [indicator.get("state", "neutral") for indicator in bucket_indicators]
            supportive = state_values.count("supportive")
            adverse = state_values.count("adverse")
            if supportive == 2:
                state = "supportive"
                confidence = "high"
            elif adverse == 2:
                state = "adverse"
                confidence = "high"
            else:
                state = "neutral"
                confidence = "medium" if supportive != adverse else "low"

            states.append(state)
            bucket_summaries.append({
                "bucket": bucket_name,
                "state": state,
                "confidence": confidence,
                "summary": f"{bucket_name} bucket is {state}.",
            })

        overall_state = "neutral"
        if states.count("adverse") >= 3:
            overall_state = "adverse"
        elif states.count("supportive") >= 3:
            overall_state = "supportive"

        return {
            "overallState": overall_state,
            "buckets": bucket_summaries,
            "indicators": indicators,
            "knownAsOf": datetime.now().date().isoformat(),
        }

    @staticmethod
    def get_macro_vitals() -> Dict[str, Any]:
        snapshot = MacroService.get_macro_snapshot()
        net_liquidity = next((item for item in snapshot["indicators"] if item["key"] == "net_liquidity"), None)
        real_yield = next((item for item in snapshot["indicators"] if item["key"] == "real_yield_10y"), None)
        if not net_liquidity or not real_yield:
            return {"status": "loading"}

        def remap_state(value: Optional[str]) -> str:
            if value == "supportive":
                return "safe"
            if value == "adverse":
                return "danger"
            return "neutral"

        return {
            "last_updated": snapshot["knownAsOf"],
            "net_liquidity": {
                "value": net_liquidity["value"],
                "unit": net_liquidity["unit"],
                "trend": net_liquidity["trend"],
                "state": remap_state(net_liquidity["state"]),
                "thresholds": {},
            },
            "real_yield": {
                "value": real_yield["value"],
                "unit": real_yield["unit"],
                "trend": real_yield["trend"],
                "state": remap_state(real_yield["state"]),
                "thresholds": {},
            },
        }
