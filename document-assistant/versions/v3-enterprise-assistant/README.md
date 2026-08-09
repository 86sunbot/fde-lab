# Enterprise Document Assistant — Version 3

## Purpose

Version 3 preserves Version 2's retrieval-augmented generation (RAG) pipeline
and makes it engineerable as an operated application.

- **V1 learned retrieval:** TF-IDF → cosine similarity → matching chunk.
- **V2 learned generative AI:** embeddings → vector search → prompt → LLM answer.
- **V3 learns production engineering:** API contracts, validation, access control,
  operational controls, observability, tests, packaging, and CI.

V3 does not replace or redesign the RAG pipeline. It creates production
boundaries around it.

## Architecture

```text
User
  ↓
Streamlit Frontend
  ↓ authenticated HTTP
FastAPI Backend
  ├── Validation
  ├── API-key authentication
  ├── Rate limiting
  ├── Concurrency limiting
  ├── Request IDs, JSON logs, health, readiness, metrics
  └── V2 RAG services
          ↓
       OpenAI API
```

The configured `document.pdf` remains the only knowledge source.

## Why the New Capabilities Exist

| Capability | V2 limitation it solves |
| --- | --- |
| FastAPI | Streamlit directly owned UI, business logic, and external calls. |
| Pydantic validation | Invalid questions could reach expensive processing. |
| Application API key | Anyone able to reach the app could consume OpenAI credits. |
| Rate limiting | One client could create unbounded request cost. |
| Concurrency semaphore | Too many simultaneous AI calls could overload the process. |
| Timeouts and bounded retries | External calls could fail or wait indefinitely. |
| Request IDs and JSON logs | Failures were difficult to correlate and diagnose. |
| Health, readiness, and metrics | Operators could not distinguish a live process from a ready assistant. |
| Automated tests | Refactoring could silently break V2 behavior. |
| Docker and CI | Runtime and verification depended on a developer's laptop. |

## API

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Process liveness |
| `GET` | `/ready` | No | Document-index readiness |
| `GET` | `/metrics` | Bearer key | Small per-process operational snapshot |
| `POST` | `/v1/questions` | Bearer key | Validate, retrieve, and answer a question |

Interactive API documentation is available at `http://localhost:8000/docs`.

## Run Locally

Requires Python 3.9 or newer.

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
cp .env.example .env
```

Edit `.env` and replace both placeholder keys. Generate a separate application
key with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Terminal 1 — backend:

```bash
source .venv/bin/activate
python3 -m uvicorn app.main:create_app --factory --reload
```

Terminal 2 — frontend:

```bash
source .venv/bin/activate
python3 -m streamlit run frontend/streamlit_app.py
```

Open `http://localhost:8501`.

## Run Checks

```bash
python3 -m ruff check .
python3 -m pytest
```

Tests replace the OpenAI provider with fakes. They do not require a real API key
or consume credits.

## Run With Containers

After configuring `.env`:

```bash
docker compose up --build
```

- Frontend: `http://localhost:8501`
- API: `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`

## Project Structure

```text
v3-enterprise-assistant/
├── app/
│   ├── config.py
│   ├── errors.py
│   ├── main.py
│   ├── models.py
│   ├── observability.py
│   ├── security.py
│   └── services/
│       ├── document.py
│       ├── openai_provider.py
│       ├── rag.py
│       └── vector_store.py
├── frontend/
│   └── streamlit_app.py
├── tests/
├── docs/
├── document.pdf
├── Dockerfile
├── compose.yaml
├── requirements.txt
├── requirements-dev.txt
└── VERSION
```

## Deliberate Boundaries

This version still uses a single configured PDF and an in-memory vector index.
Rate limits, metrics, and index state are also per process.

Those are honest limitations, not hidden production claims. Redis, OAuth, a
managed vector database, object storage, multi-tenant document ingestion, and
Kubernetes are not justified by the current single-user learning requirement.
They should only be introduced after a concrete scale, persistence, identity,
or availability requirement exists.

The repository CI verifies linting, tests, and the Docker build. Deployment to a
specific cloud is not automated because no deployment platform or credentials
have been selected.

## Documentation

- `docs/architecture/` contains C4 context, container, component, and code views.
- `docs/decisions/` records the architectural decisions.
- `docs/api.md` defines the application contract.
- `docs/security.md` describes threats, controls, and remaining risks.
- `docs/testing.md` describes the test strategy.
- `docs/runbook.md` explains operation and recovery.

## Version

3.0.0
