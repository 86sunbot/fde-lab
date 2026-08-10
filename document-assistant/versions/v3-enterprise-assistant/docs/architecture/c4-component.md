# C4 Level 3 — Backend Component View

```text
HTTP Request
    ↓
Request-ID / Logging Middleware
    ↓
Authentication → Rate Limiter → Pydantic Validation
    ↓
Question Endpoint
    ↓
Document Assistant
    ├── Concurrency Semaphore
    ├── Document Processor
    ├── OpenAI Provider
    ├── Local Persistent Vector Store
    ├── Semantic Candidate Retriever
    ├── Deterministic Reranker
    ├── Evidence Threshold
    └── Grounded Prompt Builder
    ↓
Validated HTTP Response
```

## API Layer

`app.main` owns routes, application lifecycle, error-to-HTTP mapping, and
dependency wiring. It contains no PDF or embedding algorithm.

## Configuration

`app.config` validates environment configuration at startup. Invalid secrets,
chunk boundaries, limits, or timeouts fail fast.

## Security Controls

`app.security` uses constant-time bearer-key comparison, hashes the client key
before using it as a limiter identifier, and applies a sliding request window.

## Observability

`app.observability` creates request IDs, structured JSON logs, latency tracking,
per-process counters, and privacy-safe retrieval traces. Request bodies, prompts,
document text, and secrets are not logged.

## RAG Services

- `document` extracts PDF text, fingerprints the source, and creates bounded,
  overlapping chunks that prefer paragraph and sentence boundaries.
- `openai_provider` isolates external API operations and errors.
- `vector_store` performs transparent cosine-similarity search and persists a
  fingerprinted local snapshot.
- `reranker` combines semantic similarity with a small lexical signal.
- `rag` restores or initializes the index, retrieves candidates, reranks
  evidence, applies the evidence threshold, builds the grounded prompt, and
  generates an answer.

Document search remains an internal controlled operation. It is not exposed to
the model as a function tool because every question must follow the same single
search path.

## Frontend

The Streamlit frontend is a separate API client. It knows the application API
key but never receives the OpenAI API key.
