from typing import Any

import httpx
import streamlit as st
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class FrontendSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    backend_url: str = "http://localhost:8000"
    app_api_key: SecretStr = SecretStr("")


frontend_settings = FrontendSettings()
BACKEND_URL = frontend_settings.backend_url.rstrip("/")
APP_API_KEY = frontend_settings.app_api_key.get_secret_value()
REQUEST_TIMEOUT_SECONDS = 90.0


def authorization_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {APP_API_KEY}"}


def error_detail(response: httpx.Response) -> str:
    try:
        payload: dict[str, Any] = response.json()
        return str(payload.get("detail", "Unknown API error"))
    except ValueError:
        return f"Backend returned HTTP {response.status_code}"


st.set_page_config(
    page_title="Enterprise Document Assistant V3",
    page_icon="🏢",
)

st.title("Enterprise Document Assistant V3")
st.write(
    "The V2 RAG pipeline now runs behind an authenticated and validated API. "
    "Answers still come only from the configured PDF."
)

if not APP_API_KEY:
    st.error(
        "APP_API_KEY is missing. Configure it in .env, then restart Streamlit."
    )
    st.stop()

with st.sidebar:
    st.subheader("Service Status")
    st.caption(f"Backend: {BACKEND_URL}")
    try:
        readiness_response = httpx.get(
            f"{BACKEND_URL}/ready",
            timeout=5.0,
        )
        if readiness_response.is_success:
            readiness = readiness_response.json()
            st.success(
                f"Ready · {readiness['indexed_chunks']} chunks · "
                f"{readiness['document']}"
            )
        else:
            st.warning(error_detail(readiness_response))
    except httpx.RequestError:
        st.error("Backend unavailable")

question = st.text_area(
    "Ask a question about the document:",
    height=100,
    max_chars=2_000,
)

if st.button("Generate Answer", type="primary"):
    if len(question.strip()) < 3:
        st.warning("Enter a question containing at least three characters.")
    else:
        try:
            with st.spinner("Calling the document assistant API..."):
                response = httpx.post(
                    f"{BACKEND_URL}/v1/questions",
                    headers=authorization_headers(),
                    json={"question": question},
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "a short time")
                st.warning(f"Rate limit reached. Try again in {retry_after} seconds.")
            elif response.status_code == 401:
                st.error("The backend rejected APP_API_KEY.")
            elif not response.is_success:
                st.error(error_detail(response))
            else:
                payload = response.json()
                st.subheader("Answer")
                st.write(payload["answer"])
                st.caption(f"Request ID: {payload['request_id']}")

                st.subheader("Supporting Sources")
                st.caption(
                    "Similarity indicates retrieval relevance, not answer confidence."
                )
                for source in payload["sources"]:
                    label = (
                        f"Source {source['source_number']} · "
                        f"chunk {source['chunk_number']} · "
                        f"similarity {source['similarity']:.3f}"
                    )
                    with st.expander(label):
                        st.write(source["text"])

        except httpx.TimeoutException:
            st.error("The backend timed out. Use the request logs to investigate.")
        except httpx.RequestError:
            st.error("The backend could not be reached.")

with st.expander("What changed from Version 2?"):
    st.markdown(
        """
        - Streamlit is now only a client; it no longer calls OpenAI directly.
        - FastAPI provides a validated application contract.
        - Bearer authentication and rate limiting protect costly operations.
        - Concurrency limits prevent too many simultaneous model requests.
        - Request IDs, JSON logs, health checks, readiness, and metrics support operations.
        - The underlying PDF → chunks → embeddings → retrieval → prompt → LLM flow remains.
        """
    )
