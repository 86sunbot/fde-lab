# ADR-001 — Start With a Simple Retrieval-Based Architecture

## Status

Accepted

## Context

The objective of Document Assistant V1 is to understand the fundamentals of document retrieval before introducing more advanced AI technologies.

A document assistant could immediately use:

- Large Language Models
- Embeddings
- Vector databases
- RAG
- APIs
- Cloud services

However, introducing all these technologies in V1 would add unnecessary complexity.

## Decision

V1 will use a simple retrieval-based architecture consisting of:

- PDF text extraction
- Text chunking
- TF-IDF
- Cosine similarity
- Streamlit

V1 will not use:

- LLMs
- Embeddings
- Vector databases
- RAG
- External AI APIs

## Why

The objective is to first understand the fundamental workflow:

Question
→ Search Document
→ Find Relevant Content
→ Return Content

Advanced capabilities can then be introduced incrementally.

## Benefits

- Simple architecture
- Small codebase
- Easy to understand
- Easy to troubleshoot
- Minimal dependencies
- Clear retrieval fundamentals

## Limitations

- Retrieval depends heavily on matching terminology
- Limited semantic understanding
- Cannot generate natural-language answers
- Cannot reason across multiple document chunks

## Future Direction

Possible evolution:

V1 — TF-IDF Retrieval

V2 — LLM-assisted answering

V3 — Embeddings + Vector Search + RAG

V4 — Production engineering capabilities

Future architectural changes should be recorded using additional ADRs rather than modifying the history of this ADR.