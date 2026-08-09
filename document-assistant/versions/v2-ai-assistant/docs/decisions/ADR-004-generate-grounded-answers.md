# ADR-004 — Generate Answers From Retrieved Evidence

## Status

Accepted

## Context

Semantic retrieval finds relevant passages but still requires the user to read
and combine them. V2's architectural objective is an AI document assistant that
generates an answer without hiding the retrieval evidence.

## Decision

V2 will retrieve the three most similar chunks, label them as sources, and send
them with the user's question to the OpenAI Responses API.

The prompt will require the model to:

- Use only the retrieved sources
- State when the answer is not present
- Answer concisely in plain language
- Cite source labels

The UI will show both the answer and the retrieved chunks. V2 uses
`gpt-5.6-terra` for generation and `text-embedding-3-small` for embeddings.

## Why

The LLM solves a synthesis problem: turning retrieved evidence into a direct,
readable answer. Supplying only retrieved evidence reduces irrelevant context
and creates a traceable RAG boundary.

## Consequences

Benefits:

- Users receive a direct answer rather than one raw chunk.
- Multiple chunks can contribute evidence.
- Source labels and visible chunks make the result inspectable.

Costs and limitations:

- Every question makes embedding and generation API calls.
- Model output can still be wrong or unsupported.
- Retrieval failure can cause generation failure even when the PDF contains the answer.
- Prompt grounding reduces but does not eliminate hallucination.

Automated retrieval and answer evaluation are deferred until a concrete V3
production-quality requirement is defined.
