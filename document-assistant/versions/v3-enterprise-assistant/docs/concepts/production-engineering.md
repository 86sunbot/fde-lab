# Production Engineering Around an AI Capability

## Purpose

Version 2 already knew how to retrieve evidence and generate an answer. Version
3 asks a different question:

> Can the application around that AI capability be operated, protected,
> diagnosed, changed, and trusted?

This guide explains the engineering shell that answers that question.

## Smart Capability vs Operated System

```text
V2
smart RAG workflow

V3
validated client contract
  + access control
  + resource limits
  + separated responsibilities
  + predictable external-dependency behavior
  + observability
  + tests and operating procedures
  + preserved RAG workflow
```

Production engineering is not “add every enterprise technology.” It is
identifying a concrete failure mode and adding the smallest control that handles
it.

## 1. FastAPI: the transport boundary

FastAPI is the reception desk. It owns:

- URL and HTTP method;
- request and response models;
- authentication dependencies;
- status codes;
- exception-to-HTTP translation;
- application startup and shutdown;
- generated OpenAPI documentation.

It does not own PDF parsing, embeddings, or retrieval algorithms.

Why this matters: another frontend can use the same API without importing
Streamlit code, and API behavior can be tested independently of the UI.

## 2. Pydantic: deterministic data validation

Pydantic is the form checker, not the identity check.

The request model guarantees that:

- `question` is a string;
- it contains 3–2,000 characters after trimming;
- unknown fields are rejected;
- coercion is disabled through strict mode.

The LLM may be probabilistic. The application's input boundary should not be.

Pydantic Settings also validates environment configuration at startup. Invalid
chunk relationships, candidate counts, timeouts, limits, or placeholder secrets
fail before the service accepts traffic.

## 3. Authentication: protect costly operations

Protected endpoints require:

```http
Authorization: Bearer <APP_API_KEY>
```

This is a shared application credential. It prevents an anonymous caller from
using the question endpoint and metrics endpoint.

It is not enterprise identity:

- it does not identify a human user;
- it has no roles;
- it has no individual revocation;
- all holders share one rate-limit identity.

Upgrade to an identity provider only when those requirements exist.

## 4. Rate limiting: control frequency

Rate limiting asks:

> How many accepted question requests may this client submit during a time
> window?

V3 uses an in-process sliding window keyed by a hash of the application key.

It protects:

- OpenAI credit;
- provider quotas;
- CPU and memory;
- service availability.

A rejected request receives `429` and `Retry-After`.

This is not a queue. Rejected work is not persisted or executed later.

## 5. Concurrency limiting: control simultaneous work

Concurrency asks:

> How many expensive question workflows may run at the same time?

The semaphore makes extra accepted requests wait for an available slot.

Rate and concurrency limits solve different problems:

| Control | Time horizon | Result when limit is reached |
| --- | --- | --- |
| Rate limit | Requests over a window | Reject with `429` |
| Concurrency limit | Work active now | Wait for a semaphore slot |

Both controls are per backend process.

## 6. Async: use waiting time efficiently

Embedding and generation calls spend time waiting on a remote API. The backend
uses `async`/`await` and `AsyncOpenAI` so the event loop can make progress on
other I/O while one request waits.

Blocking PDF reading, hashing, snapshot restore, and persistence are moved to a
thread with `asyncio.to_thread()` during initialization.

Async does not make CPU work faster, and it does not create parallel workers by
itself.

## 7. Services: separate reasons to change

| Component | Reason to change |
| --- | --- |
| `main.py` | HTTP routes, lifecycle, dependency wiring |
| `models.py` | API request and response contracts |
| `security.py` | authentication and request admission |
| `observability.py` | logs, request correlation, metrics |
| `document.py` | PDF validation, extraction, chunking |
| `vector_store.py` | vector state, persistence, search |
| `reranker.py` | candidate ordering policy |
| `rag.py` | workflow orchestration and grounding |
| `openai_provider.py` | vendor SDK interaction |

This is separation of concerns. It allows focused tests and makes vendor or
algorithm changes easier to localize.

## 8. Centralized external client

Only `OpenAIProvider` imports and calls the OpenAI SDK in the backend.

Why:

- one place for credentials;
- one timeout policy;
- one retry policy;
- one error translation boundary;
- one future provider-replacement seam;
- tests can replace the provider with a fake.

Centralization does not mean building a giant universal abstraction. The
provider exposes only the two operations this application needs: embed text and
generate an answer.

## 9. Timeouts and retries

External dependencies fail. A good application plans for that without retrying
forever.

V3 configures:

- `OPENAI_TIMEOUT_SECONDS`;
- `OPENAI_MAX_RETRIES` with a maximum allowed value of five.

The OpenAI SDK owns its retry/backoff implementation. V3 proves that bounded
configuration reaches the centralized client; it does not duplicate or retest
the SDK's internal algorithm.

Timeout answers “how long may one attempt wait?” Retry count answers “how many
additional attempts are allowed?”

## 10. Predictable error contracts

| Failure | External behavior |
| --- | --- |
| Missing/invalid app key | `401` |
| Invalid request body | `422` |
| Rate limit exceeded | `429` plus `Retry-After` |
| OpenAI provider failure | `502` plus request ID |
| Assistant not ready | `503` plus request ID |
| Unexpected exception | generic `500` plus request ID |

Internal exception details are logged but not returned for unexpected failures.
This reduces accidental information leakage while preserving diagnosability.

## 11. Observability

Observability asks whether an operator can understand system behavior from its
outputs.

V3 provides:

- one request ID on every HTTP response;
- structured JSON logs;
- route, status, and end-to-end latency;
- retrieval candidate and selection traces;
- liveness and readiness endpoints;
- authenticated in-process metrics.

It does not currently provide:

- a durable metrics backend;
- distributed tracing across services;
- separate embedding and generation latency fields;
- retry-count telemetry;
- per-user audit identity.

Those are honest next steps if an operating environment requires them.

## 12. Health vs readiness

`/health` asks:

> Is the HTTP process alive enough to respond?

`/ready` asks:

> Is the document index available to answer questions?

A service can be healthy but not ready during startup or after an indexing
failure. Operators and deployment platforms need both signals.

## 13. Testing vs evaluation

Traditional tests check deterministic software contracts:

- input validation;
- status codes;
- persistence;
- ranking logic;
- error mapping;
- concurrency enforcement.

AI evaluation checks observed model-backed behavior:

- does a direct question get a cited answer?
- does a paraphrase still work?
- does an unrelated question abstain?

Both are required. Unit tests cannot prove live model quality, and live model
evaluation should not replace deterministic contract tests.

## 14. Containers and CI

The Docker image packages the runtime as a non-root user. Compose starts the API
and frontend with a persistent index volume. GitHub Actions installs
dependencies, lints, tests, and builds the image.

This proves build reproducibility. It does not choose a cloud platform, domain,
TLS strategy, secret store, scaling policy, or rollback mechanism.

## 15. Function calling: a deliberate non-feature

Function calling lets a model choose and request an allowed tool. That is useful
when multiple optional actions create a real routing decision.

V3 has one mandatory read-only action: search the document. Calling it directly
is:

- more deterministic;
- one model round-trip simpler;
- cheaper;
- easier to authorize and test.

Do not add an agent simply to rename a deterministic pipeline.

## Reusable Principle

For each new “production” technology, ask:

1. What measured failure or requirement exists?
2. Does the current design already handle it?
3. What is the smallest boundary that solves it?
4. How will we prove that the boundary works?
5. What operational cost does it introduce?

That reasoning process is more reusable than any particular framework.
