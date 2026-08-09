# AI Document Assistant — Version 2

## Purpose

Version 2 evolves the Version 1 retrieval assistant into a small
retrieval-augmented generation (RAG) application.

Version 1 answered: **Which document chunk shares words with the question?**

Version 2 answers: **Which chunks are related in meaning, and what grounded
answer can an LLM produce from them?**

## Architecture

```text
PDF
 ↓
Text extraction       reused from V1
 ↓
Chunking              reused from V1
 ↓
OpenAI embeddings     semantic representation
 ↓
In-memory vector store
 ↓
Cosine similarity     top 3 chunks
 ↓
Grounded prompt
 ↓
OpenAI LLM
 ↓
Generated answer + supporting sources
```

## Why Each New Component Exists

| Component | Problem it solves |
| --- | --- |
| Embeddings | Questions and passages can express the same meaning with different words. |
| Vector store | Each chunk must remain associated with its embedding for retrieval. |
| Semantic retrieval | The LLM should receive relevant evidence, not the complete PDF. |
| Prompt builder | The question and retrieved evidence need explicit grounding rules. |
| LLM | Retrieved passages are synthesized into a concise answer. |
| Supporting sources | The user must be able to inspect what the answer was based on. |

The vector store is intentionally an in-memory Python structure. An external
vector database would add operational complexity without solving a problem for
this single-document learning version.

## Technology

- Python
- Streamlit
- PyPDF
- scikit-learn cosine similarity
- OpenAI API
- `text-embedding-3-small` for embeddings
- `gpt-5.6-terra` for answer generation

No AI orchestration framework is used. The RAG steps remain visible in
`app.py`.

## Run Locally

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Configure `OPENAI_API_KEY` in the same terminal. Do not place the key in source
code or commit it.

```bash
read -s "OPENAI_API_KEY?Paste your OpenAI API key: "
export OPENAI_API_KEY
```

Start the app from this directory:

```bash
python3 -m streamlit run app.py
```

See `docs/runbook.md` for troubleshooting.

## Scope

Included:

- One local PDF named `document.pdf`
- PDF text extraction and character-based chunking reused from V1
- Batched document embeddings
- Cached in-memory vectors
- Semantic top-3 retrieval
- A grounded RAG prompt
- A generated answer with source labels
- Display of retrieved chunks and similarity scores

Deferred to Version 3:

- Application API
- Authentication and authorization
- Request validation
- Rate limiting and concurrency controls
- Persistent or managed vector infrastructure
- Production logging and observability
- Automated evaluation and comprehensive testing
- Deployment and CI/CD

## Known Limitations

- Only one local, text-based PDF is supported.
- Scanned PDFs require OCR, which is not included.
- The index is cached only for the running Streamlit environment.
- Starting with a new cache creates document embeddings again and incurs API cost.
- Retrieval can miss evidence when fixed-size chunks split related text.
- Grounding reduces hallucination risk but cannot eliminate it.
- Similarity is retrieval relevance, not answer confidence.

## Documentation

- `docs/architecture/` describes the current V2 architecture.
- `docs/decisions/` records why the architecture evolved.
- `docs/runbook.md` explains how to operate and troubleshoot the app.
- `VERSION` contains the version identifier.

## Version

2.0.0
