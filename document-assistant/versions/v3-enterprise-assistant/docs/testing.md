# Test Strategy

## Objectives

Tests protect V2's RAG behavior and V3's production contracts without consuming
OpenAI credits.

## Test Layers

### Unit Tests

- Chunk boundaries and overlap validation
- Vector ranking
- Grounded prompt rules
- Configuration constraints

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
