from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from ..models import SystemCache

class CacheService:
    @staticmethod
    def get_cache(db: Session, key: str):
        """Retrieves a parsed JSON payload from the system cache."""
        record = db.query(SystemCache).filter(SystemCache.key == key).first()
        if record:
            return record.payload
        return None

    @staticmethod
    def set_cache(db: Session, key: str, payload: dict):
        """Upserts a JSON payload into the system cache."""
        stmt = insert(SystemCache).values(
            key=key,
            payload=payload
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['key'],
            set_=dict(payload=payload)
        )
        db.execute(stmt)
        db.commit()

    @staticmethod
    def invalidate_cache(db: Session, key: str):
        """Deletes a cache key."""
        db.query(SystemCache).filter(SystemCache.key == key).delete()
        db.commit()
