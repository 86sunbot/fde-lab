# C4 Level 1 — System Context

## Purpose

The Enterprise Document Assistant lets an authorized user ask questions about
one configured PDF and receive answers grounded in retrieved document evidence.

```text
┌───────────────┐       questions / answers       ┌──────────────────────────────┐
│ Authorized    │ ◄─────────────────────────────► │ Enterprise Document Assistant│
│ User          │                                 └──────────────┬───────────────┘
└───────────────┘                                                │
                                                                 │ AI requests
┌───────────────┐       operates / diagnoses                     ▼
│ Operator      │ ──────────────────────────────────────► ┌────────────┐
└───────────────┘                                         │ OpenAI API │
                                                          └────────────┘
```

The assistant also reads a local `document.pdf`, its sole knowledge source.

## People

### Authorized User

- Uses the Streamlit frontend or authenticated HTTP API
- Asks questions about the configured document
- Receives an answer and inspectable supporting sources

### Operator

- Configures secrets and operational limits
- Uses health, readiness, metrics, logs, and request IDs
- Builds, tests, deploys, and troubleshoots the application

## External System

### OpenAI API

- Creates embedding vectors
- Generates answers from retrieved evidence

## Boundary

The Document Assistant owns the frontend, API contract, security controls,
document processing, retrieval orchestration, and operational signals. OpenAI is
an external dependency; identity-provider integration and managed data services
are outside the current scope.
