# Glossary

| Term | Plain-language meaning in this project |
| --- | --- |
| API | A defined way for software clients to request document answers. |
| API contract version | The `v1` in `/v1/questions`; it changes when the public request/response contract breaks. It is not product Version 1. |
| Application API key | The shared bearer secret used to access protected V3 endpoints. It is not the OpenAI key or individual user identity. |
| Async | A way for the process to make progress on other work while waiting for network or other I/O. |
| Authentication | Proving that a caller holds the configured application key. |
| Authorization | Deciding what an authenticated identity may do. Fine-grained authorization is not implemented. |
| Candidate retrieval | Fetching more possible chunks than will ultimately enter the prompt. |
| Chunk | A bounded piece of extracted document text used for embedding and retrieval. |
| Chunk overlap | Text repeated across neighboring chunks to reduce lost context at boundaries. |
| CI | Continuous integration: automated lint, tests, and container build on repository changes. |
| Citation | A label such as `[Source 1]` connecting an answer statement to returned evidence. Current labels are prompt-generated, not independently verified. |
| Concurrency limit | The maximum number of question pipelines doing expensive work at the same time in one API process. |
| Container | A packaged runtime containing the application and dependencies. It is a deployment unit, not automatically a production platform. |
| Cosine similarity | A comparison of vector direction used to rank semantic closeness. |
| Embedding | A numeric vector representing aspects of text meaning. |
| Evaluation | A repeatable set of behavior cases used to measure whether the AI workflow behaves as intended. |
| FastAPI | The Python web framework exposing V3's HTTP contract and lifecycle. |
| FDE | Forward Deployed Engineer: an engineer who connects customer problems, system design, implementation, and operation. |
| Grounding | Restricting the answer to retrieved evidence from the configured PDF. |
| Hallucination | A plausible-sounding statement not supported by the required evidence. |
| Health | A liveness signal that the HTTP process can respond. |
| In-memory vector store | The process-local collection of chunks and vectors used for search while the API is running. |
| Index | The searchable association between document chunks and their embeddings. |
| Index signature | A hash of document and indexing inputs used to decide whether a snapshot remains valid. |
| LLM | Large language model; here it writes an answer from the question and retrieved sources. |
| Metrics | Numeric operational summaries such as request count, errors, activity, and average duration. Current metrics are per process. |
| OpenAI API key | The secret the backend uses for OpenAI embedding and generation calls. It must never be sent to the frontend. |
| Pydantic | The library that parses and validates configuration and API data against declared models. It is validation, not authentication. |
| Prompt | The instructions, question, and retrieved evidence sent to the generation model. |
| Prompt injection | Untrusted text attempting to make a model follow instructions contrary to system policy. |
| RAG | Retrieval-Augmented Generation: retrieve relevant evidence, then give it to an LLM to generate a grounded answer. |
| Rate limit | A cap on accepted protected requests per app key and time window in one API process. It is admission control, not a durable queue. |
| Readiness | A signal that the document index is available and the application can attempt questions. |
| Reranking | Reordering semantic candidates with an additional scoring policy before prompt construction. |
| Request ID | A unique identifier returned to the client and included in logs for correlating one request. |
| Retry | A bounded repeat of a transiently failed external request. |
| Semantic search | Retrieval based on embedding similarity rather than only shared words. |
| Snapshot | The JSON representation of the local vector index persisted for faster restart. |
| Structured logging | Logs emitted as machine-readable JSON fields rather than free-form sentences. |
| Structured output | Data guaranteed to match a schema by a model/provider feature. V3 has structured application API responses, but does not currently request OpenAI Structured Outputs. |
| TF-IDF | V1's lexical representation that gives importance to terms based on frequency in a document collection. |
| Timeout | A maximum wait for an external operation before treating it as failed. |
| Tool/function calling | A model selecting and supplying arguments to an approved function. It is deliberately not used because V3 always performs one mandatory retrieval workflow. |
| Vector | An ordered list of numbers. Embedding models produce vectors for text. |
| Vector database | A specialized external system for large-scale vector persistence/search. This project does not use one; it uses an in-memory store plus a local JSON snapshot. |
| Vector store | The abstraction that holds embeddings and searches for nearby vectors. |

For the full learning sequence, see [AI Foundations](concepts/ai-foundations.md) and
[RAG Pipeline](concepts/rag-pipeline.md).
