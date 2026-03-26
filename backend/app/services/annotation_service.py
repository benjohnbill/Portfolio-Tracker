from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models import EventAnnotation


class AnnotationService:
    @staticmethod
    def create_annotation(
        db: Session,
        *,
        week_ending: date,
        level: int,
        title: str,
        summary: str,
        status: str = "active",
        affected_buckets: Optional[List[str]] = None,
        affected_sleeves: Optional[List[str]] = None,
        duration: Optional[str] = None,
        decision_impact: Optional[str] = None,
        source: str = "manual",
        event_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        row = EventAnnotation(
            week_ending=week_ending,
            event_date=event_date,
            level=level,
            status=status,
            title=title,
            summary=summary,
            affected_buckets=affected_buckets or [],
            affected_sleeves=affected_sleeves or [],
            duration=duration,
            decision_impact=decision_impact,
            source=source,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "weekEnding": row.week_ending.isoformat(),
            "level": row.level,
            "status": row.status,
            "title": row.title,
            "summary": row.summary,
        }

    @staticmethod
    def list_annotations(db: Session, week_ending: Optional[date] = None) -> List[EventAnnotation]:
        query = db.query(EventAnnotation).order_by(EventAnnotation.created_at.asc())
        if week_ending:
            query = query.filter(EventAnnotation.week_ending == week_ending)
        return query.all()
