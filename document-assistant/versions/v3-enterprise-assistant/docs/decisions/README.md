# Architecture Decision Records

An Architecture Decision Record (ADR) explains a consequential choice: the problem,
options, decision, and trade-offs. Git shows what changed; C4 shows the current design;
an ADR preserves why the design changed.

## Decision Index

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-001](ADR-001-preserve-v2-rag-behavior.md) | Accepted | Preserve the understandable V2 RAG behavior while adding engineering boundaries. |
| [ADR-002](ADR-002-introduce-an-api-boundary.md) | Accepted | Put the RAG service behind a FastAPI contract. |
| [ADR-003](ADR-003-use-local-production-controls.md) | Accepted | Use simple per-process authentication, rate, concurrency, and observability controls. |
| [ADR-004](ADR-004-use-containers-and-ci.md) | Accepted | Package with containers and verify changes in CI. |
| [ADR-005](ADR-005-evidence-backed-rag-hardening.md) | Accepted | Add persistent indexing, candidate retrieval, reranking, grounding, citations, abstention, and evaluation. |
| [ADR-006](ADR-006-freeze-v3-engineering-principles.md) | Accepted | Freeze Version 3 around eight reusable engineering principles. |

## When to Write an ADR

Write one when a choice:

- changes a major responsibility or trust boundary;
- adds an external service or foundational dependency;
- changes a public contract or data/storage strategy;
- has a meaningful cost, security, quality, or operational trade-off;
- rejects an apparently obvious alternative that a future maintainer may revisit.

Do not write an ADR for a typo, routine refactor, or implementation detail with no lasting
architectural consequence.

## Lifecycle

1. Copy [ADR Template](ADR-TEMPLATE.md) and assign the next number.
2. Start with `Proposed` while the choice is under discussion.
3. Change to `Accepted` when the decision is made.
4. Do not rewrite history after implementation. Add a new ADR that `Supersedes` the old
   one if the decision changes.
5. Update this index and relevant C4 views.

An ADR does not authorize scope beyond the project decision. Security, privacy, and
external deployment approvals still belong to their real owners.
