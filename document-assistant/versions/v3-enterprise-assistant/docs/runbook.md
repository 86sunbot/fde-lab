# Enterprise Document Assistant V3 — Runbook

## Prerequisites

- Python 3.9 or newer, or Docker with Docker Compose
- OpenAI API key with available API credits
- The configured text-based `document.pdf`
- Free local ports `8000` and `8501`

## First-Time Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
cp .env.example .env
```

Generate a long application key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Edit `.env`:

- Set `OPENAI_API_KEY` to the OpenAI credential.
- Set `APP_API_KEY` to the newly generated application key.
- Do not commit `.env`.

## Start Locally

Terminal 1:

```bash
source .venv/bin/activate
python3 -m uvicorn app.main:create_app --factory --reload
```

Normal startup logs include `document_index_initializing` followed by
`document_index_ready`. The first startup creates document embeddings and uses
OpenAI API credits.

Terminal 2:

```bash
source .venv/bin/activate
python3 -m streamlit run frontend/streamlit_app.py
```

Open `http://localhost:8501`.

## Verify

Liveness:

```bash
curl http://localhost:8000/health
```

Readiness:

```bash
curl http://localhost:8000/ready
```

Then ask one answerable question in Streamlit and inspect its source citations.
Ask one unrelated question and confirm the assistant says it could not find the
answer in the document.

## Test

```bash
python3 -m ruff check .
python3 -m pytest
```

## Start With Docker

Docker Compose automatically reads `.env` for variable interpolation:

```bash
docker compose up --build
```

Stop with `Ctrl+C`, then remove the stopped Compose containers with:

```bash
docker compose down
```

## Troubleshooting

### Configuration validation error

Check `.env`. Both keys must be replaced, `APP_API_KEY` must be at least 16
characters, and chunk overlap must be smaller than chunk size.

### API startup fails before becoming ready

Likely causes:

- `document.pdf` is missing or unreadable
- PDF has no extractable text
- OpenAI key or credits are invalid
- Configured model is unavailable
- Network access to OpenAI failed

Use the exception immediately following `document_index_initializing`.

### Frontend reports backend unavailable

Confirm the API terminal is running and `curl http://localhost:8000/ready`
succeeds. For containers, the frontend must use `http://api:8000`, which Compose
already configures.

### `401 Invalid API key`

The frontend and backend have different `APP_API_KEY` values. Restart both after
correcting `.env`.

### `422` validation failure

The question is blank, shorter than three characters, longer than 2,000
characters, or the JSON contract is incorrect.

### `429 Rate limit exceeded`

Wait for the `Retry-After` duration. Do not increase the limit until normal
traffic demonstrates that it is too low.

### `502` from the question endpoint

The external embedding or generation request failed. Find the matching
`X-Request-ID` in structured logs. Check OpenAI status, account usage, model
access, network connectivity, and configured timeouts.

### Retrieval or answer quality problem

Inspect returned sources:

- Correct evidence missing: retrieval or chunking problem.
- Correct evidence present but answer wrong: prompting or generation problem.
- Evidence absent from PDF: knowledge-source problem.

Do not treat similarity as answer confidence.

## Operational Checks

- `/health` returns `200` when the API process is alive.
- `/ready` returns `200` only after the document index is available.
- `/metrics` requires the application bearer key.
- Every response has `X-Request-ID` for log correlation.
- JSON logs go to standard output for collection by the deployment platform.

## Recovery

The index is in memory. Restarting the API reconstructs it and makes another
embedding request. If repeated indexing becomes costly or slow, persistence is
a measured requirement for a future ADR.

## Deployment Boundary

The Docker image is the deployable artifact. Actual cloud deployment needs an
explicit choice of platform, TLS/domain ownership, secret storage, data policy,
and rollback strategy. Those cannot be selected safely from repository context
alone.
