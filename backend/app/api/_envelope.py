"""Envelope helper used by every UX-1 read-path endpoint.

Every endpoint returns via `wrap_response` to guarantee:
- HTTP 200 at the API boundary (no 5xx for data-acquisition failures).
- Response root always contains a `status` field.
- Empty-state shape equals loaded-state shape (only `status` differs).

Cross-reference: docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md §4.
"""

from __future__ import annotations

from typing import Any, Literal

Status = Literal["ready", "partial", "unavailable"]

_VALID_STATUSES = frozenset({"ready", "partial", "unavailable"})


def wrap_response(*, status: Status, **fields: Any) -> dict[str, Any]:
    """Return an envelope-wrapped response.

    Args:
        status: 'ready' | 'partial' | 'unavailable'
        **fields: Surface-specific metadata and domain data fields.
                  Use [] or {} rather than None for empty arrays/objects
                  so empty-state shape matches loaded-state shape.

    Returns:
        Dict ready for FastAPI to JSON-serialize.

    Raises:
        ValueError: If status is not one of the three permitted values.
                    This catches typos at test time; production code paths
                    should type-check via the Literal alias.
    """
    if status not in _VALID_STATUSES:
        raise ValueError(
            f"status must be one of {sorted(_VALID_STATUSES)}, got {status!r}"
        )
    return {"status": status, **fields}
