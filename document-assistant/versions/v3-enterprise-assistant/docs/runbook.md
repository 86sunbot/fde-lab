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
- Keep `MAX_DOCUMENT_BYTES` and `MAX_DOCUMENT_PAGES` appropriate for the
  deployment's memory, latency, and OpenAI-cost budget.
- Do not commit `.env`.

## Start Locally

Terminal 1:

```bash
source .venv/bin/activate
python3 -m uvicorn app.main:create_app --factory --reload --reload-dir app
```

Normal startup logs include `document_index_initializing` followed by either
`document_index_persisted` on a cache miss or `document_index_restored` on a
cache hit, and finally `document_index_ready`. The first startup creates
document embeddings and uses OpenAI API credits. An unchanged restart restores
the local snapshot without creating the document embeddings again.

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

With the backend running, load `.env` and run the three-case live evaluation:

```bash
set -a
source .env
set +a
python3 scripts/evaluate.py
```

The supported cases use OpenAI credits. The unsupported case should be rejected
before answer generation when its best similarity is below the configured
threshold.

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
characters, chunk overlap must be smaller than chunk size, and `CANDIDATE_K`
must be greater than or equal to `TOP_K`.

### Persistent index appears stale or corrupt

The index signature normally invalidates snapshots after document, embedding
model, or chunk-setting changes. To force a rebuild, stop the API and remove
only the configured snapshot:

```bash
rm .data/document-index.json
```

Restart the API. The next startup creates embeddings and persists a fresh
snapshot.

### API startup fails before becoming ready

Likely causes:

- `document.pdf` is missing or unreadable
- PDF has no extractable text
- PDF exceeds `MAX_DOCUMENT_BYTES` or `MAX_DOCUMENT_PAGES`
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

The `retrieval_completed` JSON log records candidate and selected chunk numbers,
similarity scores, the evidence decision, and retrieval duration. It deliberately
does not contain the question or source text.

## Operational Checks

- `/health` returns `200` when the API process is alive.
- `/ready` returns `200` only after the document index is available.
- `/metrics` requires the application bearer key.
- Every response has `X-Request-ID` for log correlation.
- JSON logs go to standard output for collection by the deployment platform.

## Recovery

The live search index remains in memory, while `.data/document-index.json`
provides restart persistence. If the snapshot is unavailable or invalid, the API
reconstructs it from the configured PDF and OpenAI embeddings. In Compose, the
`document-index` named volume retains the snapshot across container recreation;
`docker compose down -v` intentionally removes it.

## Deployment Boundary

The Docker image is the deployable artifact. Actual cloud deployment needs an
explicit choice of platform, TLS/domain ownership, secret storage, data policy,
and rollback strategy. Those cannot be selected safely from repository context
alone.
