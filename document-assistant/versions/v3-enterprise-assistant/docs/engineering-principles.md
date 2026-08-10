# Version 3 Engineering Principles

Version 3 is frozen around eight principles. They define what V3 teaches and
provide a filter for future changes: a new capability must strengthen one of
these principles or solve a measured limitation. Otherwise it does not belong
in V3.

## 1. Validate Everything Entering the System

Why: invalid or unexpectedly shaped input should fail before it reaches costly
or security-sensitive work.

Implemented through:

- `Settings` validation for environment configuration and related limits.
- Strict Pydantic API models that reject missing, invalid, or unknown fields.
- Question length and whitespace validation.
- PDF existence, byte-size, page-count, readability, and extractable-text checks.

## 2. Separate Responsibilities

Why: failures and changes are easier to understand when each boundary has one
reason to change.

Implemented through:

- Streamlit as the user-facing HTTP client.
- FastAPI as the transport, authentication, validation, and error boundary.
- `DocumentAssistant` as workflow orchestration.
- Separate document, vector-store, reranking, and OpenAI-provider modules.
- Document search as a controlled internal operation rather than scattered
  retrieval logic.

## 3. Fail Predictably

Why: operators and clients need stable behavior when configuration, documents,
or upstream services fail.

Implemented through:

- Domain exceptions translated into stable HTTP responses.
- OpenAI timeouts and bounded retries configured in one client.
- Corrupt or incompatible index snapshots treated as cache misses and rebuilt.
- Weak evidence handled through a deterministic abstention response.
- Unexpected errors mapped to a generic response without leaking internals.

Fallback does not mean silently inventing an answer. For this system, the safe
fallback is to rebuild recoverable state, return a stable error, or abstain.

## 4. Protect Resources

Why: CPU, memory, API credits, and service capacity are finite.

Implemented through:

- Bearer authentication before costly question processing.
- Per-client rate limiting.
- A concurrency semaphore around embedding and generation work.
- Question length limits.
- Configurable PDF byte and page limits.
- A persistent embedding snapshot that avoids repeated indexing cost.
- An evidence threshold that avoids unnecessary generation calls.

## 5. Keep External Dependencies Behind Clients

Why: vendor-specific behavior should not spread through business logic.

Implemented through:

- `OpenAIProvider` as the only backend module that imports and calls the OpenAI
  SDK.
- The frontend containing its HTTP-client behavior while depending only on the
  documented FastAPI contract.
- Provider protocols and fakes that keep tests independent of OpenAI.

## 6. Trust Evidence, Not the LLM

Why: fluent output is not proof that an answer is supported.

Implemented through:

- Semantic candidate retrieval followed by deterministic reranking.
- An explicit minimum-evidence check.
- A prompt that limits answers to retrieved document sources and treats those
  sources as untrusted evidence rather than instructions.
- Visible source chunks, semantic scores, and citations.
- Exact abstention when evidence is insufficient.

## 7. Make Failures Observable

Why: production failures must be diagnosable without exposing sensitive data.

Implemented through:

- Structured JSON logs.
- A request ID on every response and in correlated logs.
- HTTP status, route, and end-to-end latency logging.
- Privacy-safe retrieval traces containing candidate counts, chunk numbers,
  similarity scores, sufficiency decisions, and retrieval duration.
- Health, readiness, and authenticated operational metrics endpoints.

Questions, answers, prompts, document text, and secrets are not logged.

## 8. Prove Behavior

Why: architecture claims need repeatable evidence.

Implemented through:

- Unit tests for validation, chunking, persistence, retrieval, reranking,
  observability, and grounding.
- Service tests with deterministic provider fakes.
- API tests for authentication, validation, errors, rate limiting, metrics, and
  request IDs.
- A three-case live evaluation dataset covering direct terminology, semantic
  paraphrasing, and unsupported questions.
- Stored manual validation evidence and screenshots.

## Freeze Rule

V3 is not a claim that every enterprise technology has been added. It is a
small system that demonstrates these eight principles end to end. Distributed
rate limiting, enterprise identity, a managed vector database, multiple tools,
and cloud deployment require real scale, identity, routing, or availability
requirements before they are introduced.
