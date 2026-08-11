# Document Assistant — Retrieval to Production

This project shows how a document assistant evolves through three deliberate
architectural milestones:

```text
V1: classical retrieval
        ↓
V2: semantic retrieval and grounded generation
        ↓
V3: an engineerable, observable, and testable service
```

The repository is an FDE learning project, but the implementations and
engineering artifacts are treated as a real system. Each version is independently
understandable and preserves the lessons of the version before it.

## Version Story

| Version | Architectural question | Main workflow | Status |
| --- | --- | --- | --- |
| [V1 — Retrieval Assistant](versions/v1-retrieval/README.md) | How does document retrieval work without AI? | PDF → chunks → TF-IDF → cosine similarity → retrieved text | Complete — 1.0.0 |
| [V2 — AI Document Assistant](versions/v2-ai-assistant/README.md) | How does a modern grounded AI assistant work? | PDF → embeddings → semantic search → prompt → LLM → cited answer | Complete — 2.0.0 |
| [V3 — Enterprise Document Assistant](versions/v3-enterprise-assistant/README.md) | How do we make the capability operable and defensible? | Client → authenticated API → validated RAG service → observable response | Complete — 3.1.0 |

The detailed architectural comparison is recorded in
[docs/evolution.md](docs/evolution.md).

## Architecture Evolution

```text
V1
PDF → extraction → fixed chunks → TF-IDF → cosine similarity → best chunk

V2
PDF → extraction → fixed chunks → embeddings → vector search
    → grounded prompt → LLM → answer + sources

V3.1
Browser → Streamlit client → authenticated FastAPI boundary
    → strict validation → boundary-aware chunks → persistent vectors
    → semantic candidates → deterministic reranking → evidence gate
    → grounded LLM answer + citations
    → request IDs + logs + metrics + tests + evaluation
```

## What Version 3 Teaches

V3 is frozen around eight engineering principles:

1. Validate everything entering the system.
2. Separate responsibilities.
3. Fail predictably.
4. Protect resources.
5. Keep external dependencies behind clients.
6. Trust evidence, not the LLM.
7. Make failures observable.
8. Prove behavior.

The implementation mapping is in
[V3 engineering principles](versions/v3-enterprise-assistant/docs/engineering-principles.md).

## Repository Structure

```text
document-assistant/
├── README.md
├── docs/
│   └── evolution.md
└── versions/
    ├── v1-retrieval/
    ├── v2-ai-assistant/
    └── v3-enterprise-assistant/
```

Every version contains its own application, dependencies, README, `VERSION`, C4
architecture views, ADRs, runbook, and validation evidence.

## Recommended Reading Order

1. Read the V1 README and its retrieval validation results.
2. Compare the V1 results with V2's semantic-retrieval validation.
3. Read V2's semantic-retrieval ADR and inspect its visible RAG pipeline.
4. Start V3 at its
   [documentation home](versions/v3-enterprise-assistant/docs/README.md).
5. Follow the beginner concepts, then zoom through the C4 views and request lifecycle.
6. Review V3's engineering principles, automated tests, live evaluation, and stored
   evidence.
7. Use the
   [reuse blueprint](versions/v3-enterprise-assistant/docs/reuse-blueprint.md) to separate
   transferable engineering foundations from domain-specific choices.

This order makes each new technology answer a limitation that is already
visible in the previous version.

## Deliberate Scope

This is not a multi-tenant document platform. It intentionally uses one
configured text-based PDF, a small transparent local vector index, and a simple
application API key. Managed vector infrastructure, enterprise identity,
distributed limits, OCR, multi-document ingestion, and cloud deployment require
concrete requirements before they are introduced.

## Security

API keys belong only in ignored `.env` files or process environment variables.
Never place real credentials in source code, `.env.example`, screenshots, test
artifacts, or commits. Before publishing, also confirm that every tracked PDF and
screenshot is permitted and contains no private information. See the
[V3 security guide](versions/v3-enterprise-assistant/docs/security.md).
