# Service Layer

The service layer contains the AI/document use case independently of HTTP presentation.
Its separation is what lets tests replace OpenAI with a deterministic fake.

| File | Input | Output | Responsibility |
| --- | --- | --- | --- |
| `document.py` | PDF path and limits | extracted text, chunks, fingerprint | Safe document preparation |
| `vector_store.py` | chunks and vectors | candidates and persisted snapshot | Local vector storage and cosine search |
| `reranker.py` | question and candidates | ordered final sources | Hybrid semantic/lexical scoring |
| `openai_provider.py` | text or prompt | embeddings or answer | Centralized AsyncOpenAI adapter |
| `rag.py` | settings and question | answer plus sources | Initialization and query orchestration |

## Key Rule

`rag.py` coordinates; it should not absorb every implementation detail. When a concern
can be tested and explained on its own—document preparation, storage, reranking, or
provider access—it remains a separate service.

The `AIProvider` protocol is the test seam. Production uses `OpenAIProvider`; tests use a
fake with predictable vectors and answers. This avoids network calls, credentials, cost,
and nondeterministic assertions in CI.

Read `docs/concepts/rag-pipeline.md` for the full data flow.
