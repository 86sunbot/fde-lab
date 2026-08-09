# C4 Level 2 — Container View

## Architecture

```text
┌──────────┐
│ Browser  │
└────┬─────┘
     │ local HTTP
     ▼
┌─────────────────────────────────────────────────────┐
│ Streamlit application (Python / app.py)             │
│                                                     │
│ PDF processing → chunking → in-memory vector store  │
│      → semantic retrieval → prompt → answer         │
└──────────────┬──────────────────────┬───────────────┘
               │ reads                │ HTTPS API calls
               ▼                      ▼
        ┌─────────────┐        ┌────────────┐
        │ document.pdf│        │ OpenAI API │
        └─────────────┘        └────────────┘
```

## Containers

### Streamlit Application

Responsibilities:

- Render the local browser interface
- Coordinate ingestion, retrieval, prompting, and generation
- Cache document embeddings during local execution
- Display the answer and retrieved evidence

All application responsibilities deliberately remain in one Python process so
the V2 RAG flow is easy to trace.

### Local PDF

The single source document. It must contain extractable text.

### OpenAI API

An external service used for embedding creation and LLM generation.

## Deliberate Omissions

There is no separate backend API, database service, authentication service,
worker, or telemetry platform. Those containers are not justified until V3.
