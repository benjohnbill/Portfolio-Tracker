from datetime import date
from typing import Dict, Generic, Hashable, Optional, Tuple, TypeVar

V = TypeVar("V")


class DayScopedCache(Generic[V]):
    """
    Process-local cache whose entries live until the local date changes.

    The day and its entries are one tuple, replaced in a single assignment,
    so a concurrent reader never sees a new day paired with old entries.
    """

    def __init__(self) -> None:
        self._state: Tuple[date, Dict[Hashable, V]] = (date.today(), {})

    def _entries_for_today(self) -> Dict[Hashable, V]:
        day, entries = self._state
        today = date.today()
        if day == today:
            return entries
        fresh: Dict[Hashable, V] = {}
        self._state = (today, fresh)
        return fresh

    def get(self, key: Hashable) -> Optional[V]:
        return self._entries_for_today().get(key)

    def set(self, key: Hashable, value: V) -> None:
        self._entries_for_today()[key] = value

    def clear(self) -> None:
        self._state = (date.today(), {})

    def __len__(self) -> int:
        return len(self._entries_for_today())
