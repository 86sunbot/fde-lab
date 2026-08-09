# ADR-001 — Preserve the V2 RAG Behavior

## Status

Accepted

## Context

V3's learning objective is production engineering, not a new AI architecture.
Changing retrieval, chunking, models, storage, and operational structure at the
same time would make regressions difficult to explain.

## Decision

V3 will preserve V2's one-PDF workflow, fixed overlapping chunks,
`text-embedding-3-small`, cosine-similarity top-three retrieval, grounded prompt,
`gpt-5.6-terra`, and visible supporting sources.

The code will be separated into services without intentionally changing these
behaviors.

## Consequences

- V2-to-V3 comparisons remain meaningful.
- Automated tests can protect the preserved behavior.
- Known RAG limitations remain visible rather than being mixed with production changes.
- AI improvements require a later evidence-backed decision.
