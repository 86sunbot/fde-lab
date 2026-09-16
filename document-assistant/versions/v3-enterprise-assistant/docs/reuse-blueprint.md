# Reuse Blueprint

This project is intentionally designed so roughly 70% of its engineering foundation can
support a future AI application. Reuse the principles and boundaries; do not copy domain
assumptions blindly.

## The 70/30 Rule

The reusable 70% is application engineering:

- validated settings and API models;
- application factory and lifecycle;
- authentication boundary;
- rate and concurrency protection;
- external-provider isolation;
- structured errors, logs, request IDs, health, readiness, and metrics;
- deterministic test seams, Docker packaging, CI, ADRs, C4, and runbook structure.

The project-specific 30% is domain behavior:

- source format and ingestion;
- chunking rules;
- embedding and generation models;
- retrieval, reranking, threshold, and prompt;
- evaluation questions and acceptance criteria;
- authentication strength, data policy, and deployment environment.

If the new application changes only labels but retains the old document, evaluation, and
security assumptions, it has been copied rather than architected.

## Reusable Layers

| Layer | Reuse directly | Reconsider for every project |
| --- | --- | --- |
| API | factory pattern, Pydantic contracts, error mapping | routes, payloads, version policy |
| Security | secrets outside code, constant-time key comparison | user identity, roles, tenancy, revocation |
| Capacity | rate/concurrency concepts | limits, distributed coordination, queue requirements |
| AI provider | one centralized client and protocol seam | models, budgets, data-retention policy |
| Retrieval | candidate-then-rerank shape | data source, chunking, vector technology, ranking |
| Grounding | evidence-only prompt and abstention | threshold, citation verification, risk tolerance |
| Observability | request IDs and structured events | telemetry backend, retention, privacy fields, SLOs |
| Quality | unit/API/evaluation separation | evaluation dataset, labels, target metrics |
| Delivery | container and CI concepts | platform, TLS, secrets, CD, rollback |

## Starting a New Project

1. Write the user problem and one measurable success behavior.
2. Identify the trusted knowledge source and its data sensitivity.
3. Copy the project skeleton without `.env`, `.data`, `document.pdf`, test artifacts, or
   Git history.
4. Rename product metadata and replace domain examples.
5. Define new request/response models and evaluation cases first.
6. Replace ingestion and RAG policy deliberately.
7. Revisit the threat model, authentication, limits, and deployment boundary.
8. Update C4 views and write ADRs for the decisions that changed.
9. Run deterministic tests, then a controlled live evaluation.

## Suggested Skeleton

```text
new-ai-project/
├── app/
│   ├── main.py                 # API and lifecycle
│   ├── config.py               # validated environment configuration
│   ├── models.py               # public contracts
│   ├── security.py             # authentication and admission control
│   ├── observability.py        # request IDs, logs, metrics
│   └── services/               # domain, provider, retrieval, orchestration
├── frontend/                   # optional client
├── evals/                      # behavior cases
├── tests/                      # deterministic proof
├── scripts/                    # repeatable operations/evaluation
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── concepts/
│   └── test-results/
├── .env.example
├── Dockerfile
├── compose.yaml
├── README.md
└── VERSION
```

## Questions to Answer Before Reusing a Component

- What concrete limitation does it solve in the new project?
- Which party owns its operation and failure recovery?
- What data crosses the boundary?
- What is the cost unit: document, request, token, user, or deployment?
- How will failure be visible?
- What test proves the behavior?
- What assumption from this single-PDF system no longer holds?

## Common Reuse Mistakes

- Calling a JSON snapshot a production vector database.
- Treating a shared key as user authentication.
- Treating rate limiting as a durable work queue.
- Copying a similarity threshold without a representative evaluation set.
- Adding tool calling when there is no routing decision.
- Assuming citations are verified because the prompt requested them.
- Shipping local per-process metrics as a complete observability platform.
- declaring production readiness without deployment ownership, TLS, secret storage,
  backup, rollback, and data-policy decisions.

## Reusable Documentation Contract

Every derived project should keep:

- a README that explains the problem and fastest success path;
- current C4 views;
- ADRs that explain consequential decisions;
- a runbook that supports operation and recovery;
- a version file and release validation evidence;
- concepts and a glossary when the intended reader is new to the domain.

The source repository is a reference implementation, not a universal template. The goal
is to transfer engineering judgment, not merely files.
