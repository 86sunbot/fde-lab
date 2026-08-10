# C4 Level 4 — Code View

V3 justifies a code view because the single V2 file has become several modules
with explicit dependency directions.

```text
frontend/streamlit_app.py
        │ HTTP
        ▼
app/main.py
 ├── config.py
 ├── models.py
 ├── security.py
 ├── observability.py
 └── services/rag.py
       ├── services/document.py
       ├── services/vector_store.py
       ├── services/reranker.py
       └── services/openai_provider.py ──► OpenAI SDK
```

## Important Functions and Classes

| Code element | Responsibility |
| --- | --- |
| `create_app()` | Construct FastAPI with explicit settings and services |
| `Settings` | Validate configuration and secrets |
| `QuestionRequest` | Validate the HTTP question contract |
| `require_api_key()` | Authenticate a bearer credential |
| `InMemoryRateLimiter` | Enforce a per-process sliding request window |
| `MetricsCollector` | Track lightweight operational counters |
| `DocumentAssistant` | Coordinate initialization, retrieval, and generation |
| `OpenAIProvider` | Isolate embedding and Responses API calls |
| `InMemoryVectorStore` | Search in memory and persist/restore a local index snapshot |
| `rerank()` | Reduce semantic candidates to the final evidence set |
| `build_prompt()` | Create the grounded RAG prompt |

## Dependency Rule

The API depends on services; services do not depend on FastAPI or Streamlit.
The frontend depends only on the HTTP contract. This allows service and API
behavior to be tested without starting Streamlit or calling OpenAI.
