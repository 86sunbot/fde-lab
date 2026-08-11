# Application Package

This folder is the FastAPI backend. It turns the V2 RAG workflow into a validated,
protected, observable service.

| File | Responsibility | Does not own |
| --- | --- | --- |
| `main.py` | Application factory, lifecycle, routes, middleware, exception mapping | PDF parsing or OpenAI SDK details |
| `config.py` | Typed environment configuration and cross-field validation | Secret storage infrastructure |
| `models.py` | Strict public request and response schemas | Business orchestration |
| `security.py` | Shared bearer-key authentication and per-process rate limiting | Enterprise identity or roles |
| `observability.py` | JSON logging context and local metrics | External telemetry storage |
| `errors.py` | Domain error types mapped at the API boundary | Provider-specific SDK exceptions |
| `services/` | Document, retrieval, provider, reranking, and RAG behavior | HTTP presentation |

## Dependency Direction

```text
FastAPI routes -> DocumentAssistant -> provider/retrieval/document services
      |                  |
      v                  v
 Pydantic models     domain results
```

Services do not import the frontend. The Streamlit frontend calls the HTTP API instead of
reaching into this package. OpenAI SDK calls exist only in the provider adapter.

Read `docs/architecture/c4-component.md` for component relationships and
`docs/development.md` before changing a boundary.
