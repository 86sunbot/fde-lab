# Getting Started

## Goal

By the end of this guide you will have:

- a running FastAPI backend;
- a running Streamlit frontend;
- a searchable document index;
- one grounded answer;
- one semantic-paraphrase answer;
- one evidence-based abstention;
- a passing deterministic test suite.

## Before You Start

You need:

- Python 3.9 or newer;
- an OpenAI API key with available credits;
- a text-based PDF;
- terminal access;
- ports `8000` and `8501` available.

The PDF must contain extractable text. Scanned-image PDFs require OCR, which is
outside V3's current scope.

## Understand the Two Keys

V3 uses two unrelated credentials:

| Key | Used by | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Backend only | Pays for and authorizes OpenAI embedding and generation requests |
| `APP_API_KEY` | Frontend and backend | Protects this application's costly API endpoints |

Never put the OpenAI key in Streamlit code, screenshots, Git, or browser-side
configuration.

## 1. Enter the V3 Directory

```bash
cd document-assistant/versions/v3-enterprise-assistant
```

Run this from the repository root. If the repository lives elsewhere, use its actual
location; the project does not depend on a particular home-directory path.

## 2. Create the Python Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
```

Why: the virtual environment isolates this version's Python dependencies from
other projects and from V1/V2.

## 3. Create Local Configuration

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Open `.env` and replace:

```text
OPENAI_API_KEY=replace-with-your-openai-api-key
APP_API_KEY=replace-with-a-long-random-application-key
```

Use the generated random value for `APP_API_KEY`. Do not add quotation marks
unless the value itself contains shell-significant characters.

Why: `.env.example` documents required settings safely. The real `.env` is
ignored by Git.

## 4. Choose the Document

Place a small text-based PDF at:

```text
document.pdf
```

For a public repository, prefer a small document you created yourself. Avoid
committing confidential, personal, or ambiguously licensed material.

Why start small: the first index creation sends every chunk to the embeddings
API. A small document makes cost, latency, and debugging easier to understand.

## 5. Run Deterministic Checks First

```bash
python3 -m ruff check .
python3 -m pytest -q
```

Expected result:

```text
All checks passed!
36 passed
```

These tests use fakes instead of OpenAI and consume no API credit.

## 6. Start the Backend

In terminal 1:

```bash
source .venv/bin/activate
python3 -m uvicorn app.main:create_app --factory --reload --reload-dir app
```

Expected startup sequence:

```text
document_index_initializing
document_index_persisted   # first run or changed document
document_index_ready
```

On an unchanged restart, expect `document_index_restored` instead of
`document_index_persisted`.

Why: the backend creates or restores the document index before reporting
readiness. The first index creation consumes embedding credit; compatible
restarts do not.

## 7. Verify the Backend

In terminal 2:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

Expected shapes:

```json
{"status":"ok","version":"3.1.0"}
```

```json
{"status":"ready","document":"document.pdf","indexed_chunks":10}
```

The chunk count is an example and changes with the PDF and chunk configuration.

`/health` means the process can respond. `/ready` means the document index can
serve questions. These are deliberately different signals.

## 8. Start the Frontend

In terminal 2:

```bash
source .venv/bin/activate
python3 -m streamlit run frontend/streamlit_app.py
```

Open `http://localhost:8501`.

The sidebar should show:

```text
Ready · <chunk count> chunks · document.pdf
```

## 9. Run the Three-Question Experiment

Use questions appropriate to your PDF.

### Direct terminology

Ask a question using words that appear in the document.

Expected: a concise answer with `[Source N]` labels and relevant source chunks.

### Semantic paraphrase

Ask the same idea with different words.

Expected: semantic retrieval should still find related evidence even when exact
word overlap is lower.

### Unsupported question

Ask something unrelated to the PDF.

Expected:

```text
I could not find that in the document.
```

The UI may still show the weak candidates considered during retrieval. Their
similarity scores are retrieval signals, not answer confidence.

## 10. Run the Live Evaluation

Keep the backend running, then load the application key for the evaluation
script:

```bash
set -a
source .env
set +a
python3 scripts/evaluate.py
```

Expected result:

```text
PASS | direct terminology | grounded with citations
PASS | semantic paraphrase | grounded with citations
PASS | unsupported question | abstained

3/3 evaluation cases passed
```

This step calls OpenAI and consumes a small amount of credit.

## 11. Stop the Application

Press `Ctrl+C` once in the Streamlit terminal and once in the Uvicorn terminal.

Do not press `Ctrl+Z`; it suspends the process and can leave the port occupied.

## What You Have Learned

You have now observed two distinct lifecycles:

1. indexing: PDF -> text -> chunks -> embeddings -> vector snapshot;
2. answering: question -> embedding -> retrieve -> rerank -> ground -> generate.

You have also tested the production shell around the AI workflow:

- service health and readiness;
- authentication and validation;
- request IDs and metrics;
- deterministic tests and live evaluation.

## Continue Learning

Read next:

1. [AI Foundations](concepts/ai-foundations.md)
2. [RAG Pipeline](concepts/rag-pipeline.md)
3. [Production Engineering](concepts/production-engineering.md)
4. [Request Lifecycle](architecture/request-lifecycle.md)
5. [Development Guide](development.md)
