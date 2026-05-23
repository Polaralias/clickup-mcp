from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from harness.status_validation import format_status_summary, validate_status_artifact


def main() -> int:
    result = validate_status_artifact()
    if result.errors:
        for error in result.errors:
            print(error)
        return 1
    print(format_status_summary(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
