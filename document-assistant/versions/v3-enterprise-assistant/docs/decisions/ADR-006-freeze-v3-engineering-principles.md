# ADR-006 — Freeze V3 Around Eight Engineering Principles

## Status

Accepted

## Context

Version 3 could expand indefinitely by adding enterprise products and AI
features. That would weaken its learning objective and make the repository look
feature-driven rather than requirement-driven.

The valuable V3 outcome is not the number of technologies. It is demonstrating
that the preserved RAG capability can be validated, separated, operated,
protected, observed, and proven.

## Decision

Version 3 is frozen around these principles:

1. Validate everything entering the system.
2. Separate responsibilities.
3. Fail predictably.
4. Protect resources.
5. Keep external dependencies behind clients.
6. Trust evidence, not the LLM.
7. Make failures observable.
8. Prove behavior.

The concrete implementation mapping is maintained in
`docs/engineering-principles.md`.

A future V3 change must strengthen one of these principles or solve a measured
limitation. A technology is not accepted merely because it commonly appears in
enterprise or AI architectures.

## Consequences

- V3 has a clear completion boundary.
- Interview and repository explanations can connect every capability to an
  engineering reason.
- File limits and privacy-safe retrieval traces close identified enforcement
  gaps in resource protection and observability.
- Model-controlled tool calling remains outside V3 until multiple optional tools
  create a real routing requirement.
- Future production expansion requires evidence rather than feature collecting.
