# Enterprise Document Assistant — Version 3

## Purpose

Version 3 preserves Version 2's retrieval-augmented generation (RAG) pipeline
and makes it engineerable as an operated application.

- **V1 learned retrieval:** TF-IDF → cosine similarity → matching chunk.
- **V2 learned generative AI:** embeddings → vector search → prompt → LLM answer.
- **V3 learns production engineering:** API contracts, validation, access control,
  operational controls, observability, tests, packaging, and CI.

V3 does not replace or redesign the RAG pipeline. It creates production
boundaries around it. Version 3.1 then applies small, evidence-backed retrieval
improvements after the V3 baseline was manually validated.

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
  └── Hardened RAG services
          ├── boundary-aware chunking
          ├── persistent local vector snapshot
          ├── candidate retrieval and deterministic reranking
          └── insufficient-evidence gate and grounded citations
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
| Boundary-aware chunking | Fixed character cuts could split an idea. |
| Persistent vector snapshot | Every restart regenerated unchanged embeddings. |
| Candidate retrieval and reranking | One retrieval step could not separately gather and refine evidence. |
| Evidence threshold | Weak retrieval could still spend a generation call. |
| Basic evaluation | Unit tests did not measure the three observed RAG behaviors. |

## Capability Coverage

| Area | Capability | V3.1 status |
| --- | --- | --- |
| RAG quality | Better chunking | Implemented with paragraph/sentence boundary preference and overlap. |
| RAG quality | Persistent vector store | Implemented as a fingerprinted local JSON snapshot. |
| RAG quality | Candidate retrieval | Implemented with configurable `CANDIDATE_K`. |
| RAG quality | Reranking | Implemented with an inspectable semantic/lexical reranker. |
| RAG quality | Grounding / insufficient evidence | Grounded prompt retained; weak evidence now abstains before generation. |
| RAG quality | Citations | Already implemented and retained. |
| RAG quality | Basic evaluation | Three executable direct/paraphrase/unsupported cases added. |
| Application engineering | FastAPI, async, Pydantic, centralized provider | Already implemented. |
| Application engineering | Timeouts, retries, structured errors | Already implemented through configuration, the OpenAI client, and API handlers. |
| AI capability | One controlled document-search tool | Implemented as an internal deterministic service operation. |
| AI capability | Model function calling | Deliberately excluded until multiple optional tools create a routing decision. |
| Operational basics | Logging, environment config, health, tests | Already implemented and extended. |

## V3 Engineering Freeze

V3 is complete around eight engineering principles:

1. **Validate everything entering the system** — strict Pydantic contracts,
   settings validation, and document limits.
2. **Separate responsibilities** — frontend, API, orchestration, document,
   retrieval, reranking, and external-client boundaries.
3. **Fail predictably** — stable exceptions, timeouts, bounded retries, cache
   rebuilds, and abstention.
4. **Protect resources** — authentication, rate limits, concurrency limits,
   question limits, file limits, persistence, and early evidence rejection.
5. **Keep external dependencies behind clients** — OpenAI SDK calls live only
   inside `OpenAIProvider`.
6. **Trust evidence, not the LLM** — grounding, reranking, evidence thresholds,
   citations, and abstention.
7. **Make failures observable** — structured logs, request IDs, latency,
   privacy-safe retrieval traces, health, readiness, and metrics.
8. **Prove behavior** — automated tests, live evaluation cases, and stored
   manual evidence.

`docs/engineering-principles.md` maps each principle to the implementation.
ADR-006 makes these principles the filter for future V3 changes.

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
python3 -m uvicorn app.main:create_app --factory --reload --reload-dir app
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

With the API running, the small live RAG evaluation is:

```bash
set -a
source .env
set +a
python3 scripts/evaluate.py
```

The live evaluation consumes OpenAI credits for supported questions.

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
│       ├── reranker.py
│       └── vector_store.py
├── frontend/
│   └── streamlit_app.py
├── evals/
│   └── cases.json
├── scripts/
│   └── evaluate.py
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

This version still uses a single configured PDF. Search runs against an
in-memory index restored from a local JSON snapshot. Rate limits, metrics, and
live index state are per process; the snapshot is not a shared vector database.

Those are honest limitations, not hidden production claims. Redis, OAuth, a
managed vector database, an LLM reranker, object storage, multi-tenant document
ingestion, and Kubernetes are not justified by the current single-user learning
requirement.
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
- `docs/engineering-principles.md` defines the eight V3 freeze principles.
- `docs/testing.md` describes the test strategy.
- `docs/test-results/v3-enterprise-manual-validation.md` records the first local
  end-to-end validation and its screenshots.
- `docs/test-results/v3.1-validation.md` records the automated, live-evaluation,
  and persistence results for Version 3.1.
- `docs/runbook.md` explains operation and recovery.

## Version

3.1.0
