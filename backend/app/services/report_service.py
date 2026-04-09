from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..database import engine
from ..models import EventAnnotation, WeeklyReport
from .algo_service import AlgoService
from .llm_service import LLMService
from .macro_service import MacroService
from .portfolio_service import PortfolioService
from .quant_service import QuantService
from .score_service import build_target_deviation, compute_alignment_score, compute_fit_score, compute_posture_diversification_score

SEVERITY_MAP = {
    "MSTR_HARD_EXIT": "critical",
    "MSTR_PROFIT_LOCK": "high",
    "NDX_SAFETY_MODE": "high",
    "GLDM_DEFENSIVE": "medium",
    "TLT_DEFENSIVE": "medium",
    "MSTR_AGGRESSIVE_BUY": "low",
    "NDX_GROWTH_MODE": "low",
    "TLT_REENTRY": "low",
    "GLDM_REENTRY": "low",
    "PORTFOLIO_ALIGNMENT_DRIFT": "high",
}


class ReportService:
    LOGIC_VERSION = "weekly-report-v0"

    @staticmethod
    def _ensure_report_tables() -> None:
        WeeklyReport.__table__.create(bind=engine, checkfirst=True)
        EventAnnotation.__table__.create(bind=engine, checkfirst=True)

    @staticmethod
    def _with_llm_summary(record: WeeklyReport) -> Dict[str, Any]:
        report = dict(record.report_json or {})
        report["llmSummary"] = record.llm_summary_json
        return report

    @staticmethod
    def get_week_ending(target_date: Optional[date] = None) -> date:
        current = target_date or datetime.now(ZoneInfo("Asia/Seoul")).date()
        weekday = current.weekday()
        offset = (weekday - 4) % 7
        return current - timedelta(days=offset)

    @staticmethod
    def _normalize_signals(action_report: Dict[str, Any], posture: Dict[str, Any]) -> Dict[str, Any]:
        signals = action_report.get("signals", {}) if action_report else {}
        stress = posture.get("stressResilience", {})
        scenarios = stress.get("scenarios", [])
        worst = min(scenarios, key=lambda item: item.get("portfolio", {}).get("return", 0), default=None) if scenarios else None

        return {
            "vxn": {
                "current": signals.get("vxn", {}).get("current_vxn") if signals.get("vxn") else None,
                "ma50": signals.get("vxn", {}).get("ma_50") if signals.get("vxn") else None,
                "threshold90": signals.get("vxn", {}).get("threshold_90") if signals.get("vxn") else None,
                "isSpike": signals.get("vxn", {}).get("is_vix_spike") if signals.get("vxn") else None,
            },
            "ndxTrend": {
                "currentPrice": signals.get("ndx", {}).get("current_price") if signals.get("ndx") else None,
                "ma250": signals.get("ndx", {}).get("ma_250") if signals.get("ndx") else None,
                "isAboveMA": signals.get("ndx", {}).get("is_above_ma") if signals.get("ndx") else None,
            },
            "mstr": {
                "zScore": signals.get("mstr", {}).get("z_score") if signals.get("mstr") else None,
                "mnavRatio": signals.get("mstr", {}).get("current_mnav_ratio") if signals.get("mstr") else None,
            },
            "stressTest": {
                "worstScenario": worst.get("scenario") if worst else None,
                "worstReturn": worst.get("portfolio", {}).get("return") if worst else None,
                "worstMdd": worst.get("portfolio", {}).get("mdd") if worst else None,
                "alphaVsSpy": worst.get("alpha") if worst else None,
            },
        }

    @staticmethod
    def _build_triggered_rules(
        action_report: Dict[str, Any],
        fit_score: Dict[str, Any],
        alignment_score: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        rules: List[Dict[str, Any]] = []

        for action in action_report.get("actions", []):
            rule_id = action.get("rule_id", action.get("asset", "UNKNOWN").replace(" ", "_").upper())
            rules.append({
                "ruleId": rule_id,
                "severity": SEVERITY_MAP.get(rule_id, "medium"),
                "source": "signal",
                "message": action["reason"],
                "affectedSleeves": [action["asset"]],
                "inputs": action.get("inputs"),
                "logicVersion": action.get("logic_version"),
            })

        for bucket in fit_score.get("bucketBreakdown", []):
            if bucket.get("state") == "misaligned":
                rules.append({
                    "ruleId": bucket["name"].replace(" ", "_").upper(),
                    "severity": "medium",
                    "source": "macro",
                    "message": bucket["explanation"],
                    "affectedSleeves": [bucket["name"].replace(" Fit", "")],
                })

        if alignment_score.get("needsRebalance"):
            rules.append({
                "ruleId": "PORTFOLIO_ALIGNMENT_DRIFT",
                "severity": "high",
                "source": "portfolio",
                "message": "Current category weights exceed the allowed drift threshold.",
                "affectedSleeves": [item["category"] for item in alignment_score.get("categories", []) if item.get("needsRebalance")],
            })

        return rules

    @staticmethod
    def _build_recommendation(
        action_report: Dict[str, Any],
        total_score: int,
        triggered_rules: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        actions = action_report.get("actions", [])
        if actions:
            stance = "rebalance"
        elif total_score < 45:
            stance = "reduce_risk"
        elif total_score < 60:
            stance = "watch_closely"
        else:
            stance = "hold"

        if actions:
            rec_actions = actions
        else:
            rec_actions = [{
                "asset": "PORTFOLIO",
                "action": stance.replace("_", " ").upper(),
                "reason": "No direct signal action fired; stance is derived from the composite weekly score.",
            }]

        rationale = [rule["message"] for rule in triggered_rules[:3]] or ["Current report remains broadly stable."]
        return {
            "stance": stance,
            "actions": rec_actions,
            "rationale": rationale,
        }

    @staticmethod
    def _serialize_annotations(rows: List[EventAnnotation]) -> List[Dict[str, Any]]:
        return [
            {
                "eventId": f"evt_{row.id}",
                "level": row.level,
                "status": row.status,
                "title": row.title,
                "summary": row.summary,
                "affectedBuckets": row.affected_buckets or [],
                "affectedSleeves": row.affected_sleeves or [],
                "duration": row.duration,
                "decisionImpact": row.decision_impact,
            }
            for row in rows
            if row.level in {1, 2}
        ]

    @staticmethod
    def build_weekly_report(db: Session, week_ending: Optional[date] = None) -> Dict[str, Any]:
        ReportService._ensure_report_tables()
        week_ending = week_ending or ReportService.get_week_ending()
        summary = PortfolioService.get_portfolio_summary(db)
        valuation = summary.get("valuation", {})
        allocation = PortfolioService.get_portfolio_allocation(db)
        macro_snapshot = MacroService.get_macro_snapshot()
        action_report = AlgoService.get_action_report(db)
        alignment_score = compute_alignment_score(allocation)
        fit_score = compute_fit_score(macro_snapshot, allocation)
        posture_score = compute_posture_diversification_score(db, allocation)
        total_score = fit_score["score"] + alignment_score["score"] + posture_score["score"]
        triggered_rules = ReportService._build_triggered_rules(action_report, fit_score, alignment_score)
        recommendation = ReportService._build_recommendation(action_report, total_score, triggered_rules)
        event_rows = db.query(EventAnnotation).filter(EventAnnotation.week_ending == week_ending).order_by(EventAnnotation.created_at.asc()).all()

        portfolio_snapshot = {
            "totalValueKRW": summary["total_value"],
            "investedCapitalKRW": summary["invested_capital"],
            "metrics": {
                "totalReturn": summary["metrics"].get("total_return", 0),
                "cagr": summary["metrics"].get("cagr", 0),
                "mdd": summary["metrics"].get("mdd", 0),
                "volatility": summary["metrics"].get("volatility", 0),
                "sharpeRatio": summary["metrics"].get("sharpe_ratio", 0),
            },
            "allocation": allocation,
            "targetDeviation": build_target_deviation(allocation),
        }

        report = {
            "weekEnding": week_ending.isoformat(),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "logicVersion": ReportService.LOGIC_VERSION,
            "status": "final",
            "dataFreshness": {
                "portfolioAsOf": valuation.get("as_of"),
                "portfolioValuation": {
                    "asOf": valuation.get("as_of"),
                    "source": valuation.get("source"),
                    "version": valuation.get("version"),
                    "period": valuation.get("period"),
                    "calculatedAt": valuation.get("calculated_at"),
                },
                "signalsAsOf": action_report.get("signals", {}).get("timestamp"),
                "macroKnownAsOf": macro_snapshot.get("knownAsOf"),
                "staleFlags": [],
            },
            "portfolioSnapshot": portfolio_snapshot,
            "macroSnapshot": macro_snapshot,
            "signalsSnapshot": ReportService._normalize_signals(action_report, posture_score),
            "score": {
                "total": total_score,
                "fit": fit_score["score"],
                "alignment": alignment_score["score"],
                "postureDiversification": posture_score["score"],
                "postureBreakdown": {
                    "stressResilience": posture_score.get("stressResilience", {}).get("score"),
                    "concentrationControl": posture_score.get("concentrationControl", {}).get("score"),
                    "diversifierReserve": posture_score.get("diversifierReserve", {}).get("score"),
                },
                "bucketBreakdown": fit_score["bucketBreakdown"],
                "positives": (fit_score.get("positives", [])[:2]),
                "negatives": (fit_score.get("negatives", [])[:2]),
            },
            "triggeredRules": triggered_rules,
            "recommendation": recommendation,
            "eventAnnotations": ReportService._serialize_annotations(event_rows),
            "userAction": None,
            "outcomeWindow": None,
            "notes": None,
            "llmSummary": None,
        }
        return report

    @staticmethod
    def generate_weekly_report(db: Session, week_ending: Optional[date] = None, include_summary: bool = False) -> Dict[str, Any]:
        ReportService._ensure_report_tables()
        week_ending = week_ending or ReportService.get_week_ending()
        report = ReportService.build_weekly_report(db, week_ending)

        previous = db.query(WeeklyReport).filter(WeeklyReport.week_ending < week_ending).order_by(WeeklyReport.week_ending.desc()).first()
        previous_payload = previous.report_json if previous else None
        llm_summary = LLMService.generate_summary(report, previous_payload) if include_summary else None
        report["llmSummary"] = llm_summary

        stmt = insert(WeeklyReport).values(
            week_ending=week_ending,
            generated_at=datetime.now(timezone.utc),
            logic_version=ReportService.LOGIC_VERSION,
            status="final",
            report_json=report,
            llm_summary_json=llm_summary,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["week_ending"],
            set_={
                "generated_at": stmt.excluded.generated_at,
                "logic_version": stmt.excluded.logic_version,
                "status": stmt.excluded.status,
                "report_json": stmt.excluded.report_json,
                "llm_summary_json": stmt.excluded.llm_summary_json,
            },
        )
        db.execute(stmt)
        db.commit()
        return report

    @staticmethod
    def get_latest_report(db: Session) -> Optional[Dict[str, Any]]:
        current_week = ReportService.get_week_ending()
        current_record = db.query(WeeklyReport).filter(WeeklyReport.week_ending == current_week).first()

        if current_record:
            return ReportService._with_llm_summary(current_record)

        latest = db.query(WeeklyReport).order_by(WeeklyReport.week_ending.desc()).first()
        if not latest:
            return None

        return ReportService._with_llm_summary(latest)

    @staticmethod
    def get_report_by_week(db: Session, week_ending: date) -> Optional[Dict[str, Any]]:
        record = db.query(WeeklyReport).filter(WeeklyReport.week_ending == week_ending).first()
        if not record:
            return None
        return ReportService._with_llm_summary(record)

    @staticmethod
    def list_reports(db: Session, limit: int = 12) -> List[Dict[str, Any]]:
        rows = db.query(WeeklyReport).order_by(WeeklyReport.week_ending.desc()).limit(limit).all()
        return [
            {
                "weekEnding": row.week_ending.isoformat(),
                "generatedAt": row.generated_at.isoformat() if row.generated_at else None,
                "logicVersion": row.logic_version,
                "status": row.status,
                "score": (row.report_json or {}).get("score", {}).get("total"),
            }
            for row in rows
        ]
