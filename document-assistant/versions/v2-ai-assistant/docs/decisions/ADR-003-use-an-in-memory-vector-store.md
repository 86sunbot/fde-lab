# ADR-003 — Use an In-Memory Vector Store

## Status

Accepted

## Context

Semantic retrieval needs to keep document chunks associated with their
embedding vectors. A managed vector database could provide persistence,
filtering, scaling, and concurrent access, but V2 processes one small local PDF
for one local user.

## Decision

V2 will use a Python dictionary containing the chunks and embedding vectors.
Cosine similarity will search all vectors and return the top three chunks.
Streamlit caching will avoid recreating unchanged document embeddings during
normal local reruns.

## Why

This is the smallest structure that solves the current storage and search
problem while keeping vector search understandable. An external vector database
would add installation and operational concepts before scale or persistence
requires them.

## Consequences

Benefits:

- The chunk-to-vector relationship is visible in the code.
- No additional service or framework is required.
- It is adequate for the small V2 test document.

Limitations:

- The index is not a durable production data store.
- Search scans every vector.
- It is not designed for many documents, users, or processes.

A persistent vector system may be introduced in V3 only if a measured scale,
persistence, or operational requirement justifies it.
