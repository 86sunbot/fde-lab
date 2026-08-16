"""Reliable source-tree launcher for local development environments."""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent


def run() -> None:
    sys.path.insert(0, str(PROJECT_ROOT / "src"))
    from sentinel_usecase.cli import main

    main()


if __name__ == "__main__":
    run()
