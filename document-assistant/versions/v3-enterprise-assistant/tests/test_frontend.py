from pathlib import Path

import httpx
from streamlit.testing.v1 import AppTest


def response(method: str, url: str, payload: dict) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json=payload,
        request=httpx.Request(method, url),
    )


def test_streamlit_frontend_calls_backend_contract(monkeypatch) -> None:
    monkeypatch.setenv("APP_API_KEY", "test-application-api-key")
    monkeypatch.setenv("BACKEND_URL", "http://test-backend")

    monkeypatch.setattr(
        httpx,
        "get",
        lambda url, timeout: response(
            "GET",
            url,
            {
                "status": "ready",
                "document": "document.pdf",
                "indexed_chunks": 8,
            },
        ),
    )
    monkeypatch.setattr(
        httpx,
        "post",
        lambda url, headers, json, timeout: response(
            "POST",
            url,
            {
                "request_id": "test-request-id",
                "answer": "A grounded frontend answer [Source 1].",
                "sources": [
                    {
                        "source_number": 1,
                        "chunk_number": 2,
                        "similarity": 0.91,
                        "text": "Supporting evidence.",
                    }
                ],
            },
        ),
    )

    app_path = Path(__file__).parents[1] / "frontend" / "streamlit_app.py"
    app = AppTest.from_file(str(app_path))
    app.run(timeout=20)

    assert not app.exception
    assert app.title[0].value == "Enterprise Document Assistant V3"

    app.text_area[0].set_value("What does the document say?")
    app.button[0].click().run(timeout=20)

    assert not app.exception
    assert any("grounded frontend answer" in item.value for item in app.markdown)
    assert any("test-request-id" in item.value for item in app.caption)
