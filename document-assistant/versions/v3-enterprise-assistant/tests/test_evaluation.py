from scripts.evaluate import ABSTENTION, evaluate_case


def test_evaluation_accepts_grounded_answer_with_sources() -> None:
    passed, _ = evaluate_case(
        {"expected_behavior": "grounded"},
        {
            "answer": "Defender monitors identity activity. [Source 1]",
            "sources": [{"source_number": 1}],
        },
    )

    assert passed


def test_evaluation_accepts_expected_abstention() -> None:
    passed, _ = evaluate_case(
        {"expected_behavior": "abstain"},
        {"answer": ABSTENTION, "sources": []},
    )

    assert passed
