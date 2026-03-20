#!/usr/bin/env python3
"""Validate skill governance registry rules for this project."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Set

STATUS_VALUES = {"candidate", "pilot", "core", "blocked"}
TIER_VALUES = {"pilot", "core", "blocked"}
DISPOSITION_VALUES = {"approve", "candidate", "decline"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate skills registry governance rules.")
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root directory.",
    )
    parser.add_argument(
        "--registry",
        default="skills/approved_skills_registry.json",
        help="Path to registry JSON file (relative to project root unless absolute).",
    )
    parser.add_argument(
        "--mode",
        choices=["strict", "advisory"],
        default="strict",
        help="strict: non-zero exit on any issue, advisory: always exit 0.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def is_yyyy_mm_dd(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _add_error(errors: List[str], path: str, msg: str) -> None:
    errors.append(f"{path}: {msg}")


def validate_registry(payload: Any) -> List[str]:
    errors: List[str] = []
    if not isinstance(payload, dict):
        return ["<root>: registry must be a JSON object."]

    if not isinstance(payload.get("version"), int):
        _add_error(errors, "version", "must be an integer.")

    allowed_sources = payload.get("allowed_sources")
    if not isinstance(allowed_sources, list) or not all(isinstance(x, str) for x in allowed_sources):
        _add_error(errors, "allowed_sources", "must be an array of strings.")
        allowed_source_set: Set[str] = set()
    else:
        allowed_source_set = set(allowed_sources)
        if len(allowed_source_set) != len(allowed_sources):
            _add_error(errors, "allowed_sources", "must not include duplicate entries.")

    skills = payload.get("skills")
    if not isinstance(skills, list):
        _add_error(errors, "skills", "must be an array.")
        return errors

    seen_names: Set[str] = set()
    for idx, skill in enumerate(skills):
        pfx = f"skills[{idx}]"
        if not isinstance(skill, dict):
            _add_error(errors, pfx, "must be an object.")
            continue

        for req in ["name", "source", "disposition", "status", "tier", "last_reviewed", "rollback_plan"]:
            if req not in skill:
                _add_error(errors, f"{pfx}.{req}", "is required.")

        name = skill.get("name")
        source = skill.get("source")
        disposition = skill.get("disposition")
        status = skill.get("status")
        tier = skill.get("tier")
        checksum = skill.get("checksum_sha256")
        last_reviewed = skill.get("last_reviewed")
        rollback_plan = skill.get("rollback_plan")

        if not isinstance(name, str) or not name.strip():
            _add_error(errors, f"{pfx}.name", "must be a non-empty string.")
        else:
            if name in seen_names:
                _add_error(errors, f"{pfx}.name", f"duplicate name '{name}'.")
            seen_names.add(name)

        if not isinstance(source, str) or not source.strip():
            _add_error(errors, f"{pfx}.source", "must be a non-empty string.")
        elif source not in allowed_source_set:
            # Governance rule: non-approved source defaults to blocked.
            if status != "blocked" or disposition != "decline":
                _add_error(
                    errors,
                    f"{pfx}.source",
                    "source is not allow-listed; disposition must be 'decline' and status must be 'blocked'.",
                )

        if disposition not in DISPOSITION_VALUES:
            _add_error(errors, f"{pfx}.disposition", f"must be one of {sorted(DISPOSITION_VALUES)}.")

        if status not in STATUS_VALUES:
            _add_error(errors, f"{pfx}.status", f"must be one of {sorted(STATUS_VALUES)}.")

        if tier not in TIER_VALUES:
            _add_error(errors, f"{pfx}.tier", f"must be one of {sorted(TIER_VALUES)}.")

        if not is_yyyy_mm_dd(last_reviewed):
            _add_error(errors, f"{pfx}.last_reviewed", "must be YYYY-MM-DD.")

        if not isinstance(rollback_plan, str) or not rollback_plan.strip():
            _add_error(errors, f"{pfx}.rollback_plan", "must be a non-empty string.")

        if checksum is not None:
            if not isinstance(checksum, str) or len(checksum) != 64 or any(c not in "0123456789abcdefABCDEF" for c in checksum):
                _add_error(errors, f"{pfx}.checksum_sha256", "must be null or a 64-char hex string.")

        if status in {"pilot", "core"} and checksum is None:
            _add_error(errors, f"{pfx}.checksum_sha256", "is required for pilot/core.")

        if disposition == "decline" and status != "blocked":
            _add_error(errors, f"{pfx}.status", "must be 'blocked' when disposition is 'decline'.")

        if disposition == "approve" and status == "blocked":
            _add_error(errors, f"{pfx}.status", "cannot be 'blocked' when disposition is 'approve'.")

        if status == "blocked" and tier != "blocked":
            _add_error(errors, f"{pfx}.tier", "must be 'blocked' when status is 'blocked'.")

        if status == "core" and tier != "core":
            _add_error(errors, f"{pfx}.tier", "must be 'core' when status is 'core'.")

        if status == "pilot" and tier != "pilot":
            _add_error(errors, f"{pfx}.tier", "must be 'pilot' when status is 'pilot'.")

    return errors


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).resolve()
    registry_path = Path(args.registry)
    if not registry_path.is_absolute():
        registry_path = (project_root / registry_path).resolve()

    if not registry_path.exists():
        print(f"FAIL registry file not found: {registry_path}")
        return 1

    try:
        payload = load_json(registry_path)
    except Exception as exc:
        print(f"FAIL invalid registry JSON: {registry_path}")
        print(f"  - {exc}")
        return 1

    errors = validate_registry(payload)
    if errors:
        print(f"FAIL skill registry validation ({len(errors)} issue(s))")
        for msg in errors:
            print(f"  - {msg}")
        if args.mode == "strict":
            return 1
        return 0

    print("PASS skill registry validation")
    print(f"INFO registry={registry_path}")
    print(f"INFO checked_at_utc={datetime.utcnow().isoformat()}Z")
    return 0


if __name__ == "__main__":
    sys.exit(main())
