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
    ├── In-Memory Vector Store
    ├── Semantic Retriever
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
and per-process counters. Request bodies, prompts, document text, and secrets are
not logged.

## RAG Services

- `document` extracts and chunks PDF text using the V2 algorithm.
- `openai_provider` isolates external API operations and errors.
- `vector_store` retains V2's transparent cosine-similarity search.
- `rag` initializes the index, retrieves evidence, builds the grounded prompt,
  and generates an answer.

## Frontend

The Streamlit frontend is a separate API client. It knows the application API
key but never receives the OpenAI API key.
