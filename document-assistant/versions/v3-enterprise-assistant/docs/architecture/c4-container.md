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
                                                         └───────────┘ └────────────┘
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

## Local PDF and In-Memory Index

The PDF is packaged as a deployment artifact. Its vectors are held in the API
process. This is suitable for the one-document V3 scope but is neither durable
nor shared between replicas.

## OpenAI API

External service for embeddings and answer generation.

## Deployment Mapping

Docker Compose runs the frontend and backend as separate containers built from
one image. A cloud platform can run the same containers after deployment and
secret-management choices are made.
