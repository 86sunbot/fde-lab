"""Run a small behavior evaluation against an already-running V3 API."""

import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
API_KEY = os.getenv("APP_API_KEY", "")
CASES_PATH = Path(__file__).parents[1] / "evals" / "cases.json"
ABSTENTION = "I could not find that in the document."


def evaluate_case(case: dict[str, str], payload: dict[str, Any]) -> tuple[bool, str]:
    answer = str(payload.get("answer", "")).strip()
    sources = payload.get("sources", [])

    if case["expected_behavior"] == "abstain":
        passed = answer == ABSTENTION
        return passed, "abstained" if passed else "answered without evidence"

    has_citation = "[Source " in answer
    has_sources = isinstance(sources, list) and bool(sources)
    passed = answer != ABSTENTION and has_citation and has_sources
    return passed, "grounded with citations" if passed else "missing answer evidence"


def main() -> int:
    if not API_KEY:
        print("APP_API_KEY is missing. Load .env before running the evaluation.")
        return 2

    cases: list[dict[str, str]] = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    failures = 0

    with httpx.Client(timeout=90.0) as client:
        for case in cases:
            response = client.post(
                f"{BASE_URL}/v1/questions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={"question": case["question"]},
            )
            if not response.is_success:
                failures += 1
                print(f"FAIL | {case['name']} | HTTP {response.status_code}")
                continue

            passed, detail = evaluate_case(case, response.json())
            failures += int(not passed)
            outcome = "PASS" if passed else "FAIL"
            print(f"{outcome} | {case['name']} | {detail}")

    print(f"\n{len(cases) - failures}/{len(cases)} evaluation cases passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
