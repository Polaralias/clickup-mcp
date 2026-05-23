from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def _run(command: list[str], *, extra_env: dict[str, str] | None = None) -> int:
    env = os.environ.copy()
    env.setdefault("PYTHONPATH", str(REPO_ROOT))
    if extra_env:
        env.update(extra_env)
    return subprocess.run(command, cwd=REPO_ROOT, env=env, check=False).returncode


def main() -> int:
    if _run([sys.executable, "scripts/validate_harness.py"]) != 0:
        return 1

    return _run(
        [sys.executable, "-m", "pytest", "-q"],
        extra_env={"PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"},
    )


if __name__ == "__main__":
    raise SystemExit(main())
