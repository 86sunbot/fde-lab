# Version 3 Capability Walkthrough

## Purpose

This walkthrough explains Version 3 as an operated service. The analogies are
useful for remembering the system, but the precise engineering meaning matters
because some controls solve different problems.

## Request Journey

```text
User
  -> FastAPI reception boundary
  -> bearer API-key authentication
  -> Pydantic request validation
  -> per-client rate-limit admission check
  -> concurrency semaphore
  -> DocumentAssistant orchestration
  -> vector candidate retrieval
  -> deterministic reranking
  -> evidence threshold
       -> weak evidence: abstain
       -> sufficient evidence: grounded prompt -> LLM
  -> validated response with sources and request ID
```

## Capability Map

| Learning analogy | Precise V3 meaning | Implementation | How it is proven | Status |
| --- | --- | --- | --- | --- |
| Reception -> FastAPI | HTTP entry point and application contract | `app/main.py` | Health, readiness, question, metrics, and error API tests | Implemented |
| ID check -> Pydantic | Correction: Pydantic checks the submitted form; bearer authentication checks the credential | `app/models.py`, `require_api_key()` | Invalid/unknown payload tests and authentication rejection test | Implemented |
| Queue control -> rate limiting | Admission control limits how frequently one authenticated client may submit work; it is not a durable queue | `InMemoryRateLimiter` | Second request receives `429` and `Retry-After` in the rate-limit test | Implemented per process |
| Work allocation -> concurrency | A semaphore caps simultaneous expensive question workflows; it does not create worker processes | `DocumentAssistant._question_slots` | Concurrent service test proves a configured maximum of one active workflow | Implemented per process |
| Specialists -> services | Document parsing, storage, reranking, orchestration, and OpenAI calls have separate responsibilities | `app/services/` | Service tests use a fake provider and run without FastAPI or OpenAI | Implemented |
| Library -> vector store | Chunks and embeddings are searched in memory and restored from an atomic local JSON snapshot | `InMemoryVectorStore` | Ranking, persistence, compatible restore, and stale-snapshot tests | Implemented locally |
| Researcher -> retriever | Semantic search gathers `CANDIDATE_K` possible evidence chunks | `InMemoryVectorStore.search()` called by `DocumentAssistant.answer()` | Vector ranking and preserved RAG-flow tests | Implemented; not a separate retriever class |
| Reviewer -> reranker | An inspectable 85% semantic plus 15% lexical score reduces candidates to `TOP_K` evidence chunks | `rerank()` | Close-candidate ordering test | Implemented |
| Evidence policy -> grounding | A minimum score gates generation; the prompt restricts the answer to retrieved evidence and requires citations | `DocumentAssistant.answer()`, `build_prompt()` | Prompt-rule and early-abstention tests | Implemented |
| Expert writer -> LLM | The model writes a concise answer after evidence is selected | `OpenAIProvider.generate_answer()` | Fake-provider service test plus live evaluation | Implemented |
| Approved actions -> function calling | Model-controlled tool selection would let an LLM choose among optional actions | None | Not applicable | Deliberately excluded |
| Escalation process -> error handling | Known failures become stable `502` or `503` responses; unexpected failures become a generic `500` with a request ID | `app/errors.py`, FastAPI exception handlers and middleware | Stable upstream and unexpected-failure API tests | Implemented |
| Retry procedure -> retries | The centralized OpenAI client receives a bounded retry count and timeout | `OpenAIProvider` and validated settings | Provider configuration test | Implemented through the SDK |
| Audit trail -> logging | Privacy-safe JSON events correlate request completion and retrieval decisions with a request ID | `app/observability.py`, request middleware, retrieval logging | Formatter test, request-ID API assertions, and live headers | Implemented per process |
| Quality review -> evaluation | Repeatable cases check direct retrieval, semantic paraphrasing, and abstention | `evals/cases.json`, `scripts/evaluate.py` | Three live cases plus evaluation-rule unit tests | Implemented as a basic smoke set |

## Why Function Calling Is Excluded

Every supported question follows one required path: search the configured PDF,
check the evidence, and answer or abstain. There is no routing decision for the
model to make. Adding model function calling for one mandatory operation would
make the flow less deterministic without adding capability.

Function calling becomes justified when the assistant has multiple optional,
permission-controlled actions, such as document search, ticket lookup, and case
creation. At that point each tool would require an input schema, authorization,
timeouts, audit events, and tests.

## Honest Scope Boundaries

- Authentication uses one shared application key, not user identity or OAuth.
- Rate limits, concurrency state, metrics, and the loaded index are per process.
- The persisted JSON index is a transparent local snapshot, not a shared vector
  database.
- Retrieval is a method call inside the RAG orchestrator, not a separately
  deployable service.
- OpenAI retry behavior is delegated to the SDK; V3 proves the bounded
  configuration rather than retesting the SDK's internal backoff algorithm.
- Three evaluation cases are a smoke test, not a statistically meaningful RAG
  quality benchmark.
