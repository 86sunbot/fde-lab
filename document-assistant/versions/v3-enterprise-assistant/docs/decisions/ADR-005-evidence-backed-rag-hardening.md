# ADR-005 — Evidence-Backed RAG Hardening Without Agentic Complexity

## Status

Accepted

## Context

ADR-001 intentionally preserved the V2 RAG pipeline while V3 introduced its
production boundary. The first manual V3 validation established a stable
baseline and exposed two concrete limitations:

1. Fixed character chunks can split a sentence or paragraph.
2. Every process restart regenerates unchanged document embeddings.

The validation also showed that direct and paraphrased questions can have
different similarity scores, while an unrelated question can still retrieve
weak candidates. Retrieval therefore needs an explicit candidate, ranking, and
insufficient-evidence policy rather than treating one score as confidence.

Function calling was also considered. OpenAI function calling is a multi-step
model/application interaction: the model requests a tool, the application runs
it, and the tool result is sent back for a final response. This application has
one mandatory, read-only operation—search the configured document—so model
choice adds a second model round trip without adding a useful decision.

## Decision

Version 3.1 will:

- Prefer paragraph and sentence boundaries while retaining bounded overlapping
  chunks.
- Persist chunks and embeddings to a local JSON snapshot.
- Invalidate the snapshot when document content, embedding model, or chunk
  settings change.
- Retrieve a configurable candidate set, then deterministically rerank it using
  semantic similarity plus a small lexical-overlap signal.
- Return the existing abstention response before generation when the strongest
  semantic evidence is below a configurable threshold.
- Add three executable evaluation cases for direct, paraphrased, and unsupported
  questions.

Version 3.1 will not add function calling. Document search remains an internal,
controlled service method invoked deterministically by the question workflow.

## Consequences

### Benefits

- Chunks are more readable and less likely to cut an idea in half.
- Unchanged restarts avoid embedding cost and startup latency.
- Candidate retrieval and reranking are separately visible and testable.
- Weak evidence avoids an unnecessary generation call.
- A small repeatable evaluation complements unit and API tests.

### Costs and limitations

- The JSON snapshot is local persistence, not a managed or multi-replica vector
  database.
- The reranker is intentionally simple and is not a cross-encoder.
- The similarity threshold is a heuristic derived from one document and must be
  reevaluated for a different corpus.
- Structure-aware character chunking is not tokenizer-aware.
- Tool calling should be reconsidered only when the assistant has multiple
  optional tools or a real routing decision.

## Reference

OpenAI documents function calling as a flow where the model emits a tool call,
the application executes it, and the result is returned to the model for the
final response: <https://developers.openai.com/api/docs/guides/function-calling>.
