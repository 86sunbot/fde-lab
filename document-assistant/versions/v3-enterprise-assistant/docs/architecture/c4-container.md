# C4 Level 2 — Container View

```text
┌──────────────┐
│ User Browser │
└──────┬───────┘
       │ HTTP :8501
       ▼
┌──────────────────────┐       authenticated HTTP       ┌──────────────────────┐
│ Streamlit Frontend   │ ─────────────────────────────► │ FastAPI Backend      │
│ Python process       │                                │ Python process       │
└──────────────────────┘                                └───────┬───────┬──────┘
                                                                  │       │
                                                 reads local PDF  │       │ HTTPS
                                                                  ▼       ▼
                                                         ┌───────────┐ ┌────────────┐
                                                         │document.pdf│ │ OpenAI API │
                                                         └─────┬─────┘ └────────────┘
                                                               │
                                                        ┌──────▼──────┐
                                                        │ Local index │
                                                        │   .data/    │
                                                        └─────────────┘
```

## Streamlit Frontend

Responsibilities:

- Collect a user question
- Call the backend using the application API key
- Display answers, request IDs, and supporting sources
- Report backend availability without handling OpenAI credentials

## FastAPI Backend

Responsibilities:

- Define and document the HTTP contract
- Validate requests and serialize responses
- Authenticate and rate-limit clients
- Control concurrent question processing
- Run the preserved RAG pipeline
- Produce operational signals

## Local PDF and Persistent Index

The PDF is packaged as a deployment artifact. The API searches vectors in
memory and stores a fingerprinted JSON snapshot under `.data/`. Docker Compose
mounts that directory as a named volume. This avoids re-embedding an unchanged
document after restart, but the snapshot is not shared between replicas.

## OpenAI API

External service for embeddings and answer generation.

## Deployment Mapping

Docker Compose runs the frontend and backend as separate containers built from
one image. A cloud platform can run the same containers after deployment and
secret-management choices are made.
