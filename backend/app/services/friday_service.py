from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import EventAnnotation, ExecutionSlippage, WeeklyDecision, WeeklySnapshot
from .algo_service import AlgoService
from .macro_service import MacroService
from .portfolio_service import PortfolioService
from .report_service import ReportService
from .risk_adjusted_service import RiskAdjustedService
from .score_service import build_target_deviation, compute_alignment_score, compute_fit_score, compute_posture_diversification_score

logger = logging.getLogger(__name__)


class SnapshotConflictError(ValueError):
    pass


class SnapshotNotFoundError(LookupError):
    pass


class SnapshotValidationError(ValueError):
    pass


class DecisionNotFoundError(LookupError):
    pass


class FridayService:
    @staticmethod
    def _find_snapshot_by_date(db: Session, snapshot_date: date) -> Optional[WeeklySnapshot]:
        return db.query(WeeklySnapshot).filter(WeeklySnapshot.snapshot_date == snapshot_date).first()

    @staticmethod
    def _find_snapshot_by_id(db: Session, snapshot_id: int) -> Optional[WeeklySnapshot]:
        return db.query(WeeklySnapshot).filter(WeeklySnapshot.id == snapshot_id).first()

    @staticmethod
    def _get_decisions_for_snapshot(db: Session, snapshot_id: int) -> List[WeeklyDecision]:
        return db.query(WeeklyDecision).filter(WeeklyDecision.snapshot_id == snapshot_id).order_by(
            WeeklyDecision.created_at.asc(),
            WeeklyDecision.id.asc(),
        ).all()

    @staticmethod
    def _get_annotations_for_week(db: Session, snapshot_date: date) -> List[EventAnnotation]:
        return db.query(EventAnnotation).filter(EventAnnotation.week_ending == snapshot_date).order_by(
            EventAnnotation.created_at.asc(),
        ).all()

    @staticmethod
    def _serialize_slippage(entry: "ExecutionSlippage") -> Dict[str, Any]:
        return {
            "id": entry.id,
            "decisionId": entry.decision_id,
            "createdAt": entry.created_at.isoformat() if entry.created_at else None,
            "executedAt": entry.executed_at.isoformat() if entry.executed_at else None,
            "executedPrice": entry.executed_price,
            "executedQty": entry.executed_qty,
            "notes": entry.notes,
        }

    @staticmethod
    def _serialize_decision(decision: WeeklyDecision) -> Dict[str, Any]:
        try:
            slippage_entries = list(decision.slippage_entries)
        except Exception:
            slippage_entries = []
        return {
            "id": decision.id,
            "snapshotId": decision.snapshot_id,
            "createdAt": decision.created_at.isoformat() if decision.created_at else None,
            "decisionType": decision.decision_type,
            "assetTicker": decision.asset_ticker,
            "note": decision.note,
            "confidenceVsSpyRiskadj": decision.confidence_vs_spy_riskadj,
            "confidenceVsCash": decision.confidence_vs_cash,
            "confidenceVsSpyPure": decision.confidence_vs_spy_pure,
            "invalidation": decision.invalidation,
            "expectedFailureMode": decision.expected_failure_mode,
            "triggerThreshold": decision.trigger_threshold,
            "slippageEntries": [FridayService._serialize_slippage(s) for s in slippage_entries],
        }

    @staticmethod
    def _serialize_snapshot(snapshot: WeeklySnapshot, decisions: Optional[List[WeeklyDecision]] = None, include_report: bool = True) -> Dict[str, Any]:
        payload = {
            "id": snapshot.id,
            "snapshotDate": snapshot.snapshot_date.isoformat() if snapshot.snapshot_date else None,
            "createdAt": snapshot.created_at.isoformat() if snapshot.created_at else None,
            "metadata": snapshot.snapshot_metadata or {},
            "comment": snapshot.comment,
            "decisions": [FridayService._serialize_decision(item) for item in (decisions or [])],
        }
        if include_report:
            payload["frozenReport"] = snapshot.frozen_report or {}
        else:
            payload["score"] = (snapshot.frozen_report or {}).get("score", {}).get("total")
            payload["status"] = (snapshot.frozen_report or {}).get("status")
        return payload

    @staticmethod
    def _empty_report(snapshot_date: date) -> Dict[str, Any]:
        return {
            "weekEnding": snapshot_date.isoformat(),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "logicVersion": ReportService.LOGIC_VERSION,
            "status": "partial",
            "dataFreshness": {
                "portfolioAsOf": None,
                "portfolioValuation": {
                    "asOf": None,
                    "source": None,
                    "version": None,
                    "period": None,
                    "calculatedAt": None,
                },
                "signalsAsOf": None,
                "macroKnownAsOf": None,
                "staleFlags": [],
            },
            "portfolioSnapshot": None,
            "macroSnapshot": {},
            "signalsSnapshot": ReportService._normalize_signals({}, {"stressResilience": {"scenarios": []}}),
            "score": None,
            "triggeredRules": [],
            "recommendation": None,
            "eventAnnotations": [],
            "userAction": None,
            "outcomeWindow": None,
            "notes": None,
            "llmSummary": None,
        }

    @staticmethod
    def _build_partial_report(db: Session, snapshot_date: date, initial_error: str) -> Tuple[Dict[str, Any], Dict[str, bool], Dict[str, str]]:
        report = FridayService._empty_report(snapshot_date)
        coverage = {
            "portfolio": False,
            "macro": False,
            "signals": False,
            "annotations": False,
            "score": False,
            "recommendation": False,
        }
        errors: Dict[str, str] = {"report": initial_error}

        summary: Optional[Dict[str, Any]] = None
        allocation: List[Dict[str, Any]] = []
        macro_snapshot: Dict[str, Any] = {}
        action_report: Dict[str, Any] = {}
        posture_score: Dict[str, Any] = {"score": 0, "stressResilience": {"scenarios": []}}

        try:
            summary = PortfolioService.get_portfolio_summary(db)
            allocation = PortfolioService.get_portfolio_allocation(db)
            valuation = summary.get("valuation", {})
            report["dataFreshness"]["portfolioAsOf"] = valuation.get("as_of")
            report["dataFreshness"]["portfolioValuation"] = {
                "asOf": valuation.get("as_of"),
                "source": valuation.get("source"),
                "version": valuation.get("version"),
                "period": valuation.get("period"),
                "calculatedAt": valuation.get("calculated_at"),
            }
            report["portfolioSnapshot"] = {
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
            coverage["portfolio"] = True
        except Exception as exc:
            errors["portfolio"] = str(exc)
            report["dataFreshness"]["staleFlags"].append("portfolio_unavailable")

        try:
            macro_snapshot = MacroService.get_macro_snapshot()
            report["macroSnapshot"] = macro_snapshot
            report["dataFreshness"]["macroKnownAsOf"] = macro_snapshot.get("knownAsOf")
            coverage["macro"] = True
        except Exception as exc:
            errors["macro"] = str(exc)
            report["dataFreshness"]["staleFlags"].append("macro_unavailable")

        try:
            action_report = AlgoService.get_action_report(db)
            report["signalsSnapshot"] = ReportService._normalize_signals(action_report, posture_score)
            report["dataFreshness"]["signalsAsOf"] = action_report.get("signals", {}).get("timestamp")
            coverage["signals"] = True
        except Exception as exc:
            errors["signals"] = str(exc)
            report["dataFreshness"]["staleFlags"].append("signals_unavailable")

        try:
            annotation_rows = FridayService._get_annotations_for_week(db, snapshot_date)
            report["eventAnnotations"] = ReportService._serialize_annotations(annotation_rows)
            coverage["annotations"] = True
        except Exception as exc:
            errors["annotations"] = str(exc)

        if coverage["portfolio"]:
            try:
                posture_score = compute_posture_diversification_score(db, allocation)
                report["signalsSnapshot"] = ReportService._normalize_signals(action_report, posture_score)
            except Exception as exc:
                errors["posture"] = str(exc)

        if coverage["portfolio"] and coverage["macro"]:
            try:
                alignment_score = compute_alignment_score(allocation)
                fit_score = compute_fit_score(macro_snapshot, allocation)
                posture_score = compute_posture_diversification_score(db, allocation)
                total_score = fit_score["score"] + alignment_score["score"] + posture_score["score"]
                triggered_rules = ReportService._build_triggered_rules(action_report, fit_score, alignment_score)
                recommendation = ReportService._build_recommendation(action_report, total_score, triggered_rules)
                report["score"] = {
                    "total": total_score,
                    "fit": fit_score["score"],
                    "alignment": alignment_score["score"],
                    "postureDiversification": posture_score["score"],
                    "bucketBreakdown": fit_score["bucketBreakdown"],
                    "positives": fit_score.get("positives", [])[:2],
                    "negatives": fit_score.get("negatives", [])[:2],
                }
                report["triggeredRules"] = triggered_rules
                report["recommendation"] = recommendation
                coverage["score"] = True
                coverage["recommendation"] = True
            except Exception as exc:
                errors["score"] = str(exc)
                report["dataFreshness"]["staleFlags"].append("score_unavailable")

        if errors:
            report["status"] = "partial"
        return report, coverage, errors

    @staticmethod
    def create_snapshot(
        db: Session,
        snapshot_date: Optional[date] = None,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_date = snapshot_date or ReportService.get_week_ending()

        if FridayService._find_snapshot_by_date(db, target_date):
            raise SnapshotConflictError(f"Snapshot already exists for {target_date.isoformat()}")

        coverage = {
            "portfolio": True,
            "macro": True,
            "signals": True,
            "annotations": True,
            "score": True,
            "recommendation": True,
        }
        errors: Dict[str, str] = {}

        try:
            report = ReportService.build_weekly_report(db, target_date)
        except Exception as exc:
            report, coverage, errors = FridayService._build_partial_report(db, target_date, str(exc))

        if not coverage.get("portfolio"):
            raise SnapshotValidationError("Portfolio data unavailable; snapshot not saved")

        metadata = {
            "coverage": coverage,
            "partial": not all(coverage.values()),
            "errors": errors,
            "snapshotWeekEnding": target_date.isoformat(),
        }

        snapshot = WeeklySnapshot(
            snapshot_date=target_date,
            created_at=datetime.now(timezone.utc),
            frozen_report=report,
            snapshot_metadata=metadata,
            comment=comment,
        )

        try:
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
        except IntegrityError:
            getattr(db, "rollback", lambda: None)()
            raise SnapshotConflictError(f"Snapshot already exists for {target_date.isoformat()}")

        # B4 — precompute risk_metrics JSONB. Failure does NOT fail the freeze.
        try:
            snapshot.risk_metrics = RiskAdjustedService.compute_snapshot_metrics(db, snapshot)
            db.commit()
        except Exception as exc:  # noqa: BLE001 — intentional broad catch to protect freeze
            logger.warning("risk_metrics compute failed for %s: %s", target_date, exc)

        return FridayService._serialize_snapshot(snapshot, include_report=True)

    @staticmethod
    def list_snapshots(db: Session) -> List[Dict[str, Any]]:
        rows = db.query(WeeklySnapshot).order_by(WeeklySnapshot.snapshot_date.desc()).all()
        return [FridayService._serialize_snapshot(row, include_report=False) for row in rows]

    @staticmethod
    def get_snapshot(db: Session, snapshot_date: date) -> Dict[str, Any]:
        snapshot = FridayService._find_snapshot_by_date(db, snapshot_date)
        if not snapshot:
            raise SnapshotNotFoundError(f"Snapshot not found for {snapshot_date.isoformat()}")
        decisions = FridayService._get_decisions_for_snapshot(db, snapshot.id)
        return FridayService._serialize_snapshot(snapshot, decisions=decisions, include_report=True)

    @staticmethod
    def add_decision(
        db: Session,
        snapshot_id: int,
        decision_type: str,
        note: str,
        confidence_vs_spy_riskadj: Optional[int] = None,
        confidence_vs_cash: Optional[int] = None,
        confidence_vs_spy_pure: Optional[int] = None,
        asset_ticker: Optional[str] = None,
        invalidation: Optional[str] = None,
        expected_failure_mode: Optional[str] = None,
        trigger_threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        snapshot = FridayService._find_snapshot_by_id(db, snapshot_id)
        if not snapshot:
            raise SnapshotNotFoundError(f"Snapshot {snapshot_id} not found")

        if confidence_vs_spy_riskadj is None:
            raise SnapshotValidationError("confidence_vs_spy_riskadj is required")

        for label, value in (
            ("confidence_vs_spy_riskadj", confidence_vs_spy_riskadj),
            ("confidence_vs_cash", confidence_vs_cash),
            ("confidence_vs_spy_pure", confidence_vs_spy_pure),
        ):
            if value is None:
                continue
            if not (1 <= value <= 10):
                raise SnapshotValidationError(f"{label} must be between 1 and 10")

        decision = WeeklyDecision(
            snapshot_id=snapshot_id,
            created_at=datetime.now(timezone.utc),
            decision_type=decision_type,
            asset_ticker=asset_ticker,
            note=note,
            confidence_vs_spy_riskadj=confidence_vs_spy_riskadj,
            confidence_vs_cash=confidence_vs_cash,
            confidence_vs_spy_pure=confidence_vs_spy_pure,
            invalidation=invalidation,
            expected_failure_mode=expected_failure_mode,
            trigger_threshold=trigger_threshold,
        )
        db.add(decision)
        db.commit()
        db.refresh(decision)
        return FridayService._serialize_decision(decision)

    @staticmethod
    def add_slippage(
        db: Session,
        decision_id: int,
        executed_at=None,
        executed_price=None,
        executed_qty=None,
        notes=None,
    ) -> Dict[str, Any]:
        decision = db.query(WeeklyDecision).filter(WeeklyDecision.id == decision_id).first()
        if not decision:
            raise DecisionNotFoundError(f"Decision {decision_id} not found")

        entry = ExecutionSlippage(
            decision_id=decision_id,
            created_at=datetime.now(timezone.utc),
            executed_at=executed_at,
            executed_price=executed_price,
            executed_qty=executed_qty,
            notes=notes,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return FridayService._serialize_slippage(entry)

    @staticmethod
    def get_slippage_for_decision(db: Session, decision_id: int) -> List[Dict[str, Any]]:
        entries = (
            db.query(ExecutionSlippage)
            .filter(ExecutionSlippage.decision_id == decision_id)
            .order_by(ExecutionSlippage.created_at.asc())
            .all()
        )
        return [FridayService._serialize_slippage(e) for e in entries]

    @staticmethod
    def _get_nested(payload: Dict[str, Any], path: List[str], default: Any = None) -> Any:
        current: Any = payload
        for key in path:
            if not isinstance(current, dict):
                return default
            current = current.get(key)
            if current is None:
                return default
        return current

    @staticmethod
    def _holdings_map(payload: Dict[str, Any]) -> Dict[str, float]:
        allocation = FridayService._get_nested(payload, ["portfolioSnapshot", "allocation"], default=[])
        if not isinstance(allocation, list):
            return {}
        result: Dict[str, float] = {}
        for item in allocation:
            if not isinstance(item, dict):
                continue
            symbol = item.get("asset") or item.get("symbol") or item.get("name")
            if not symbol:
                continue
            result[str(symbol)] = float(item.get("weight") or 0.0)
        return result

    @staticmethod
    def compare_snapshots(db: Session, date_a: date, date_b: date) -> Dict[str, Any]:
        snapshot_a = FridayService._find_snapshot_by_date(db, date_a)
        snapshot_b = FridayService._find_snapshot_by_date(db, date_b)
        if not snapshot_a:
            raise SnapshotNotFoundError(f"Snapshot not found for {date_a.isoformat()}")
        if not snapshot_b:
            raise SnapshotNotFoundError(f"Snapshot not found for {date_b.isoformat()}")

        report_a = snapshot_a.frozen_report or {}
        report_b = snapshot_b.frozen_report or {}

        rules_a = {
            item.get("ruleId")
            for item in (report_a.get("triggeredRules") or [])
            if isinstance(item, dict) and item.get("ruleId")
        }
        rules_b = {
            item.get("ruleId")
            for item in (report_b.get("triggeredRules") or [])
            if isinstance(item, dict) and item.get("ruleId")
        }

        holdings_a = FridayService._holdings_map(report_a)
        holdings_b = FridayService._holdings_map(report_b)
        symbols = sorted(set(holdings_a) | set(holdings_b))
        holdings_changed = [
            {
                "symbol": symbol,
                "weight_a": holdings_a.get(symbol, 0.0),
                "weight_b": holdings_b.get(symbol, 0.0),
                "delta": holdings_b.get(symbol, 0.0) - holdings_a.get(symbol, 0.0),
            }
            for symbol in symbols
            if holdings_a.get(symbol, 0.0) != holdings_b.get(symbol, 0.0)
        ]

        decisions_a = FridayService._get_decisions_for_snapshot(db, snapshot_a.id)
        decisions_b = FridayService._get_decisions_for_snapshot(db, snapshot_b.id)

        return {
            "snapshotA": FridayService._serialize_snapshot(snapshot_a, decisions=decisions_a, include_report=True),
            "snapshotB": FridayService._serialize_snapshot(snapshot_b, decisions=decisions_b, include_report=True),
            "deltas": {
                "score_total": (FridayService._get_nested(report_b, ["score", "total"], 0) or 0)
                - (FridayService._get_nested(report_a, ["score", "total"], 0) or 0),
                "total_value": (FridayService._get_nested(report_b, ["portfolioSnapshot", "totalValueKRW"], 0) or 0)
                - (FridayService._get_nested(report_a, ["portfolioSnapshot", "totalValueKRW"], 0) or 0),
                "regime_change": {
                    "from": FridayService._get_nested(report_a, ["macroSnapshot", "overallState"]),
                    "to": FridayService._get_nested(report_b, ["macroSnapshot", "overallState"]),
                },
                "rules_added": sorted(rules_b - rules_a),
                "rules_removed": sorted(rules_a - rules_b),
                "holdings_changed": holdings_changed,
            },
        }

    @staticmethod
    def get_current_report(db: Session) -> Dict[str, Any]:
        current_week = ReportService.get_week_ending()
        return ReportService.build_weekly_report(db, current_week)
