#!/usr/bin/env python3
"""Validate orchestration artifact JSON files against local schema contracts.

Usage examples:
  python tools/validate_contracts.py
  python tools/validate_contracts.py --project-root . --artifacts-dir orchestration/examples
  python tools/validate_contracts.py --file orchestration/examples/sample.task.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

SCHEMA_BY_KIND: Dict[str, str] = {
    "task": "task.schema.json",
    "result": "result.schema.json",
    "handoff": "handoff.schema.json",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate orchestration JSON artifacts.")
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root that contains orchestration/contracts and orchestration/examples.",
    )
    parser.add_argument(
        "--artifacts-dir",
        default="orchestration/examples",
        help="Directory containing JSON artifacts to validate when --file is not used.",
    )
    parser.add_argument(
        "--file",
        action="append",
        default=[],
        help="Specific JSON file(s) to validate. Can be provided multiple times.",
    )
    parser.add_argument(
        "--schema",
        default="",
        help="Optional schema path when validating exactly one --file.",
    )
    return parser.parse_args()


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def detect_kind(path: Path) -> str:
    name = path.name.lower()
    if name.endswith(".task.json"):
        return "task"
    if name.endswith(".result.json"):
        return "result"
    if name.endswith(".handoff.json"):
        return "handoff"
    if "task" in name:
        return "task"
    if "result" in name:
        return "result"
    if "handoff" in name:
        return "handoff"
    raise ValueError(f"Cannot infer artifact kind from filename: {path.name}")


def fallback_validate(schema: object, payload: object) -> List[str]:
    errors: List[str] = []
    if not isinstance(schema, dict):
        return ["Schema is not a JSON object."]

    expected_type = schema.get("type")
    if expected_type == "object" and not isinstance(payload, dict):
        return ["Payload must be a JSON object."]

    if isinstance(payload, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in payload:
                errors.append(f"Missing required key: {key}")

        props = schema.get("properties", {})
        additional = schema.get("additionalProperties", True)
        if additional is False:
            for key in payload:
                if key not in props:
                    errors.append(f"Unexpected key (additionalProperties=false): {key}")

    return errors


def full_validate(schema: object, payload: object) -> Tuple[List[str], str]:
    try:
        import jsonschema  # type: ignore
    except ImportError:
        return fallback_validate(schema, payload), "fallback"

    validator = jsonschema.Draft202012Validator(schema)
    errs = sorted(validator.iter_errors(payload), key=lambda e: e.path)
    messages = []
    for err in errs:
        path = ".".join(str(p) for p in err.path) or "<root>"
        messages.append(f"{path}: {err.message}")
    return messages, "jsonschema"


def validate_pair(schema_path: Path, artifact_path: Path) -> Tuple[bool, List[str], str]:
    if not schema_path.exists():
        return False, [f"Schema not found: {schema_path}"], "none"
    if not artifact_path.exists():
        return False, [f"Artifact not found: {artifact_path}"], "none"

    try:
        schema_obj = load_json(schema_path)
    except Exception as exc:
        return False, [f"Invalid schema JSON ({schema_path}): {exc}"], "none"

    try:
        payload_obj = load_json(artifact_path)
    except Exception as exc:
        return False, [f"Invalid artifact JSON ({artifact_path}): {exc}"], "none"

    errors, mode = full_validate(schema_obj, payload_obj)
    return len(errors) == 0, errors, mode


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).resolve()
    contracts_dir = project_root / "orchestration" / "contracts"

    targets: List[Tuple[Path, Path]] = []

    if args.file:
        if args.schema and len(args.file) != 1:
            print("ERROR: --schema can only be used with exactly one --file")
            return 2

        for raw in args.file:
            artifact = (project_root / raw).resolve() if not Path(raw).is_absolute() else Path(raw)
            if args.schema:
                schema = (project_root / args.schema).resolve() if not Path(args.schema).is_absolute() else Path(args.schema)
            else:
                kind = detect_kind(artifact)
                schema = contracts_dir / SCHEMA_BY_KIND[kind]
            targets.append((schema, artifact))
    else:
        artifacts_dir = (project_root / args.artifacts_dir).resolve()
        if not artifacts_dir.exists():
            print(f"ERROR: Artifacts directory not found: {artifacts_dir}")
            return 2

        artifacts = sorted(artifacts_dir.glob("*.json"))
        if not artifacts:
            print(f"ERROR: No JSON artifacts found in: {artifacts_dir}")
            return 2

        for artifact in artifacts:
            kind = detect_kind(artifact)
            schema = contracts_dir / SCHEMA_BY_KIND[kind]
            targets.append((schema, artifact))

    failed = False
    used_mode = "none"

    for schema_path, artifact_path in targets:
        ok, errors, mode = validate_pair(schema_path, artifact_path)
        used_mode = mode if mode != "none" else used_mode
        if ok:
            print(f"PASS {artifact_path.name} (schema={schema_path.name})")
        else:
            failed = True
            print(f"FAIL {artifact_path.name} (schema={schema_path.name})")
            for msg in errors:
                print(f"  - {msg}")

    if used_mode == "fallback":
        print("INFO: jsonschema package not found. Fallback validation was used.")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
