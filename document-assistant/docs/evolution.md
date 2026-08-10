# Architecture Evolution

## Why Three Versions

Each version represents a fundamental architectural shift rather than a bundle
of unrelated features:

| Version | Learning objective | System responsibility |
| --- | --- | --- |
| V1 | Information retrieval | Find and return relevant document text. |
| V2 | Generative AI | Retrieve semantic evidence and synthesize a grounded answer. |
| V3 | Production engineering | Expose, protect, operate, and prove the capability. |

## Component Evolution

| Concern | V1 | V2 | V3.1 |
| --- | --- | --- | --- |
| Text source | One local PDF | Reused | Validated local PDF with byte/page limits |
| Chunking | Fixed overlapping characters | Reused | Boundary-aware overlapping chunks |
| Representation | TF-IDF vectors | OpenAI embeddings | OpenAI embeddings with persistent snapshot |
| Retrieval | Lexical cosine top 1 | Semantic cosine top 3 | Semantic candidates plus deterministic reranking |
| Evidence policy | Best match always returned | Grounded prompt | Evidence threshold plus grounded prompt |
| Output | Retrieved passage | Generated answer and sources | Validated API response, citations, request ID |
| Application boundary | Streamlit application | Streamlit application | Streamlit client plus FastAPI backend |
| Security | None | Environment-held OpenAI key | App authentication, rate and concurrency limits |
| Observability | Similarity displayed | Sources and scores displayed | JSON logs, metrics, latency and retrieval traces |
| Verification | Manual retrieval checks | Manual RAG checks | Unit/service/API tests plus live evaluation |
| Deployment | Local Python | Local Python | Docker image, Compose and CI |

## What Was Preserved

- PDF extraction and chunk-based retrieval remain visible from V1 onward.
- Cosine similarity remains understandable rather than hidden by an
  orchestration framework.
- V2's grounding, citations, and source inspection remain part of V3.
- V3 creates production boundaries around the capability instead of replacing
  it with a new application.

## What Changed and Why

### V1 to V2

TF-IDF depends heavily on shared words. The V1 manual experiment showed that a
high lexical score could retrieve a less useful section, while a paraphrased
question could receive a low score despite reaching better evidence. Embeddings
were introduced to represent meaning, and the LLM was introduced only after the
semantic retrieval step was visible.

### V2 to V3

V2 combined UI, AI credentials, retrieval, and generation in one Streamlit
process. V3 introduced an authenticated API boundary, strict validation,
resource controls, centralized external clients, stable errors, observability,
tests, and packaging.

### V3.0 to V3.1

Manual validation created a baseline for evidence-backed improvements. V3.1
added boundary-aware chunking, restart persistence, candidate retrieval,
deterministic reranking, early insufficient-evidence handling, privacy-safe
retrieval traces, PDF resource limits, and a small live evaluation dataset.

## Architectural Boundary

The final version is intentionally production-oriented, not a claim of
unlimited scale. It demonstrates engineering principles in one small deployment.
Distributed infrastructure should be introduced only when real traffic,
identity, persistence, or availability requirements justify it.
