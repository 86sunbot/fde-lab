# ADR-002 — Introduce a FastAPI Boundary

## Status

Accepted

## Context

In V2, Streamlit owns the interface, orchestration, API credentials, and RAG
execution. That makes validation, authentication, automated contract testing,
and alternative clients difficult.

## Decision

V3 will expose the assistant through FastAPI. Streamlit will become an HTTP
client. Pydantic models will define request and response contracts.

The initial API supports health, readiness, metrics, and questions about one
configured PDF. Document upload is not included.

## Consequences

Benefits:

- Stable and automatically documented application contract
- Independent frontend and backend testing
- Central location for access and operational controls
- Future clients do not depend on Streamlit internals

Costs:

- Two processes must be operated
- HTTP failure modes and configuration are introduced
- Local setup requires two terminals or Docker Compose
