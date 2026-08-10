import json
import logging

from app.observability import JsonFormatter


def test_json_formatter_includes_privacy_safe_retrieval_trace() -> None:
    record = logging.LogRecord(
        name="document_assistant",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="retrieval_completed",
        args=(),
        exc_info=None,
    )
    record.candidate_count = 3
    record.candidate_chunks = [2, 4, 1]
    record.selected_chunks = [2, 4]
    record.similarity_scores = [0.72, 0.61]
    record.evidence_sufficient = True
    record.retrieval_duration_ms = 18.4

    payload = json.loads(JsonFormatter().format(record))

    assert payload["candidate_chunks"] == [2, 4, 1]
    assert payload["selected_chunks"] == [2, 4]
    assert payload["evidence_sufficient"] is True
    assert "question" not in payload
    assert "document_text" not in payload
