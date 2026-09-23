# Development Guide

This guide explains how to change Version 3 without losing its architectural continuity.
Read [Getting Started](getting-started.md) first if the application has not run locally.

## Development Principles

1. Preserve the V2 RAG sequence unless an explicit decision changes it.
2. Explain the limitation before adding a dependency or abstraction.
3. Keep API, orchestration, retrieval, provider, and UI responsibilities separate.
4. Add deterministic tests for application behavior; reserve live OpenAI calls for
   integration evaluation.
5. Update current architecture and operational documentation in the same change.

## Local Feedback Loop

Activate the environment and run the fast checks:

```bash
source .venv/bin/activate
python3 -m ruff check .
python3 -m pytest
```

Then start the API with reload for an interactive check:

```bash
python3 -m uvicorn app.main:create_app --factory --reload --reload-dir app
```

Use another terminal for the frontend:

```bash
source .venv/bin/activate
python3 -m streamlit run frontend/streamlit_app.py
```

## Where a Change Belongs

| Change | Primary location | Why |
| --- | --- | --- |
| Request or response contract | `app/models.py` and `app/main.py` | The API owns its public contract. |
| Environment setting | `app/config.py` and `.env.example` | Configuration stays validated and discoverable. |
| Authentication or admission control | `app/security.py` | Security policy is kept out of business logic. |
| PDF extraction or chunking | `app/services/document.py` | Document preparation has one responsibility. |
| OpenAI SDK use | `app/services/openai_provider.py` | External dependencies remain behind one client. |
| Retrieval storage/search | `app/services/vector_store.py` | Storage mechanics stay replaceable. |
| Candidate scoring | `app/services/reranker.py` | Ranking policy stays testable by itself. |
| RAG orchestration or prompt | `app/services/rag.py` | The service coordinates the use case. |
| User experience | `frontend/streamlit_app.py` | Streamlit remains an API client. |
| Behavior case | `evals/cases.json` | Evaluation examples remain data, not test code. |

## Adding a New Configuration Value

1. Add a typed field and bounds to `Settings`.
2. Add the environment name and safe value to `.env.example`.
3. Document the setting in [Configuration](configuration.md).
4. Add valid and invalid cases to `tests/test_config.py`.
5. Decide whether the value must be part of the index signature.

The final step is important. A chunking or embedding change makes the old index stale;
a log-level or rate-limit change does not.

## Changing Retrieval Quality

Before editing code, classify the symptom:

- Correct evidence was never a candidate: embedding, chunking, or candidate-depth issue.
- Correct evidence was a candidate but not selected: reranking issue.
- Correct evidence was selected but the system abstained: threshold issue.
- Correct evidence reached the prompt but answer was wrong: prompt or generation issue.
- Evidence does not exist in the PDF: source-data issue.

Add a failing unit test or evaluation case that represents the observed problem, make the
smallest change, and compare the result. Do not tune using one happy-path question.

## Changing the API

The `/v1` prefix is the API contract version, not the product release number. Backward-
compatible fields can remain under `/v1`; breaking changes should first be documented in
an ADR and introduced under a new contract version.

Update these artifacts together:

- route and Pydantic models;
- API and security tests;
- [API Contract](api.md);
- frontend or evaluation clients;
- C4 and request-lifecycle documentation if responsibilities move.

## Dependency Changes

Add runtime packages to `requirements.txt` and development-only packages to
`requirements-dev.txt`. A new library needs a concrete problem statement. Prefer the
Python standard library or an existing dependency when it keeps the implementation clear.

## Documentation Changes

An implementation change is incomplete when a beginner following the docs would learn
the old behavior. Run the documentation tests with the normal test suite. Record a new
test-result report only for a meaningful release or capability milestone; Git history is
enough for routine edits.

## Definition of Done

- The limitation and intended outcome are clear.
- Responsibilities remain separated.
- Failure behavior is intentional.
- Unit/API tests are deterministic and passing.
- A live evaluation is run when provider integration or RAG behavior changes.
- Configuration, C4 views, ADRs, runbook, and README are updated where relevant.
- No credential, `.env`, cache, or generated secret is staged.

Use [Reuse Blueprint](reuse-blueprint.md) when starting another project from this base.
