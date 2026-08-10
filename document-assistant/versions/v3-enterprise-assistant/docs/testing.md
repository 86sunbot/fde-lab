# Test Strategy

## Objectives

Tests protect V2's RAG behavior and V3's production contracts without consuming
OpenAI credits.

## Test Layers

### Unit Tests

- Chunk boundaries and overlap validation
- Document fingerprint invalidation
- PDF byte and page limits
- Vector ranking
- Vector snapshot persistence and stale-snapshot rejection
- Candidate reranking
- Grounded prompt rules
- Insufficient-evidence early abstention
- Configuration constraints
- Rejection of unknown request fields
- Privacy-safe retrieval trace fields

### Service Tests

- Document initialization
- Retrieval and generation orchestration
- Provider replacement using a deterministic fake

### API Tests

- Liveness and readiness
- Authentication failures
- Pydantic validation
- Successful response contract and request-ID correlation
- Rate limiting and retry information
- Metrics protection

### Build Verification

- Ruff static checks
- Pytest suite
- Docker image build

## Why OpenAI Is Mocked

CI must be deterministic, fast, and free of secrets and usage cost. A live model
response varies and tests the external provider more than our code.

A manual smoke test with a real key remains part of the runbook. It verifies
credentials, model access, network connectivity, and the complete integration.

## Basic RAG Evaluation

`evals/cases.json` contains three stable behavior cases:

- Direct document terminology must produce a grounded answer with citations.
- A semantic paraphrase must produce a grounded answer with citations.
- An unrelated question must produce the exact abstention response.

With the API running and `.env` loaded, execute:

```bash
python3 scripts/evaluate.py
```

This calls the real API and consumes OpenAI credits for supported questions.
It is deliberately small and does not claim statistical retrieval quality.
