#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import List, Tuple


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Portfolio Tracker control-tower gate checks in one command."
    )
    parser.add_argument(
        "--python",
        default=sys.executable,
        help="Python executable path for child checks (default: current interpreter).",
    )
    return parser.parse_args()


def _run_step(step_name: str, cmd: List[str]) -> Tuple[int, str]:
    rendered = " ".join(cmd)
    lines = [f"\n=== {step_name} ===", f"$ {rendered}"]
    proc = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
    )
    if proc.stdout:
        lines.append(proc.stdout.rstrip())
    if proc.stderr:
        lines.append(proc.stderr.rstrip())
    lines.append(f"[exit={proc.returncode}]")
    return proc.returncode, "\n".join(lines)


def main() -> int:
    args = parse_args()
    print(f"[INFO] control_tower_gate_started_utc={datetime.now(timezone.utc).isoformat()}")

    steps = [
        ("P-1 Orchestration Contract Check", [args.python, "tools/validate_contracts.py"]),
        ("P-2 Skill Registry Check", [args.python, "tools/check_skill_registry.py", "--mode", "strict"]),
        ("P-3 Python Syntax Check", [args.python, "-m", "compileall", "-q", "tools", "backend/app"]),
    ]

    for step_name, cmd in steps:
        code, output = _run_step(step_name, cmd)
        print(output)
        if code != 0:
            print(f"\n[FAIL] Control tower gate stopped at '{step_name}'.")
            return code

    print(f"\n[PASS] control tower gate passed at {datetime.now(timezone.utc).isoformat()}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
