#!/usr/bin/env python3
"""Compute deterministic SHA-256 checksums for skill files/folders."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compute and optionally write skill checksums.")
    parser.add_argument(
        "--path",
        required=True,
        help="Target file or directory to hash.",
    )
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root for resolving relative paths.",
    )
    parser.add_argument(
        "--registry",
        default="",
        help="Optional registry file to update checksum in place.",
    )
    parser.add_argument(
        "--skill-name",
        default="",
        help="Skill name in registry when --registry is used.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write checksum to registry entry (requires --registry and --skill-name).",
    )
    return parser.parse_args()


def _sha256_for_file(path: Path, hasher: Any) -> None:
    rel = path.as_posix().encode("utf-8")
    hasher.update(b"FILE\0")
    hasher.update(rel)
    hasher.update(b"\0")
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    hasher.update(b"\0")


def sha256_for_target(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Target not found: {path}")

    hasher = hashlib.sha256()
    if path.is_file():
        _sha256_for_file(path, hasher)
        return hasher.hexdigest()

    files = sorted([p for p in path.rglob("*") if p.is_file()], key=lambda p: p.as_posix())
    hasher.update(b"DIR\0")
    hasher.update(path.as_posix().encode("utf-8"))
    hasher.update(b"\0")
    for file_path in files:
        _sha256_for_file(file_path, hasher)
    return hasher.hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def update_registry(registry_path: Path, skill_name: str, checksum: str) -> None:
    payload = load_json(registry_path)
    if not isinstance(payload, dict):
        raise ValueError("Registry must be a JSON object.")

    skills = payload.get("skills")
    if not isinstance(skills, list):
        raise ValueError("Registry 'skills' must be an array.")

    for item in skills:
        if isinstance(item, dict) and item.get("name") == skill_name:
            item["checksum_sha256"] = checksum
            item["last_reviewed"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            write_json(registry_path, payload)
            return

    raise ValueError(f"Skill '{skill_name}' not found in registry.")


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).resolve()
    target = Path(args.path)
    if not target.is_absolute():
        target = (project_root / target).resolve()

    checksum = sha256_for_target(target)
    print(f"sha256={checksum}")
    print(f"target={target}")

    if args.write:
        if not args.registry or not args.skill_name:
            print("ERROR --write requires --registry and --skill-name")
            return 2
        registry_path = Path(args.registry)
        if not registry_path.is_absolute():
            registry_path = (project_root / registry_path).resolve()
        update_registry(registry_path=registry_path, skill_name=args.skill_name, checksum=checksum)
        print(f"registry_updated={registry_path}")
        print(f"skill_name={args.skill_name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
