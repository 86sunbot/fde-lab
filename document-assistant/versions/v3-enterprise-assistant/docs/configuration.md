# Configuration Guide

Version 3 keeps deployment-specific values outside Python code. This matters because
the same application should run in development, tests, containers, and a future hosted
environment without editing its source.

Configuration is loaded by `app/config.py` from environment variables and, for local
development, from `.env`. Pydantic validates all settings before the API starts. A bad
configuration therefore fails early instead of producing a less obvious runtime error.

## Secret and Non-Secret Configuration

Two values are secrets:

- `OPENAI_API_KEY` authorizes the backend to call OpenAI.
- `APP_API_KEY` authorizes a client to call protected endpoints in this application.

They solve different problems and must not be the same value. Neither belongs in Git,
logs, screenshots, source code, or documentation examples.

All remaining values are operational configuration. They are not credentials, but they
still influence cost, quality, safety, and capacity.

## Complete Settings Reference

| Environment variable | Default | Validation | Why it exists |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | none | required; placeholder rejected | Authenticates OpenAI requests. |
| `APP_API_KEY` | none | required; at least 16 characters; placeholder rejected | Protects this application's private endpoints. |
| `ENVIRONMENT` | `development` | `development`, `test`, or `production` | Names the runtime environment. |
| `LOG_LEVEL` | `INFO` | logging level string | Controls log verbosity. |
| `DOCUMENT_PATH` | `document.pdf` | valid path is checked during startup | Selects the single PDF knowledge source. |
| `VECTOR_STORE_PATH` | `.data/document-index.json` | writable path is required at persistence time | Stores the reusable local index snapshot. |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | provider validates model access | Converts text into retrieval vectors. |
| `GENERATION_MODEL` | `gpt-5.6-terra` | provider validates model access | Generates a grounded answer from retrieved evidence. |
| `OPENAI_TIMEOUT_SECONDS` | `60` | greater than 0; at most 300 | Bounds how long an OpenAI call may occupy resources. |
| `OPENAI_MAX_RETRIES` | `2` | 0 through 5 | Bounds SDK retries for transient failures. |
| `MAX_DOCUMENT_BYTES` | `20000000` | 1,024 through 1,000,000,000 | Prevents unexpectedly large PDF processing. |
| `MAX_DOCUMENT_PAGES` | `200` | 1 through 10,000 | Bounds extraction and indexing work. |
| `CHUNK_SIZE` | `1200` | 200 through 10,000 | Sets the approximate number of characters per chunk. |
| `CHUNK_OVERLAP` | `200` | 0 through 2,000 and smaller than chunk size | Preserves context across chunk boundaries. |
| `CANDIDATE_K` | `6` | 1 through 50 and at least `TOP_K` | Controls how many semantic candidates reach reranking. |
| `TOP_K` | `3` | 1 through 10 | Controls how many final sources enter the prompt. |
| `MINIMUM_SIMILARITY_SCORE` | `0.20` | -1.0 through 1.0 | Sets the early insufficient-evidence threshold. |
| `MAX_CONCURRENT_QUESTIONS` | `3` | 1 through 20 | Bounds simultaneous expensive RAG work per process. |
| `RATE_LIMIT_REQUESTS` | `10` | 1 through 10,000 | Sets admissions allowed per limiter window and app key. |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | 1 through 3,600 | Sets the sliding-window duration. |
| `BACKEND_URL` | `http://localhost:8000` | consumed by frontend and evaluation client | Tells clients where the API is available. |

`APP_NAME` and `APP_VERSION` also exist in the settings model, but normal operators do
not need to override them. Product version is sourced from the package by default.

## Recommended Local Setup

Copy the safe template and edit only the copy:

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Paste the generated random value after `APP_API_KEY=` and your OpenAI credential after
`OPENAI_API_KEY=`. Values do not require quotation marks unless the shell syntax of a
manually exported value requires them.

Validate the configuration without printing either secret:

```bash
python3 -c "from app.config import Settings; s=Settings(); print('configuration valid')"
```

## Tuning Without Guessing

Change one variable at a time and record the evaluation result.

| Symptom | First setting to investigate | Trade-off |
| --- | --- | --- |
| Relevant detail is split between chunks | `CHUNK_OVERLAP` | More duplicated text and a larger index. |
| Chunks mix unrelated topics | `CHUNK_SIZE` | Smaller chunks may lose surrounding context. |
| Correct passage is not considered | `CANDIDATE_K` | More reranking work. |
| Prompt receives too little evidence | `TOP_K` | More prompt tokens and possible distraction. |
| Valid questions abstain too often | `MINIMUM_SIMILARITY_SCORE` | Lower values increase unsupported-answer risk. |
| Irrelevant questions reach the LLM | `MINIMUM_SIMILARITY_SCORE` | Higher values may reject legitimate paraphrases. |
| OpenAI failures take too long | timeout and retries | Lower values reduce recovery opportunities. |
| Service overloads its upstream dependency | concurrency and rate settings | Lower values reduce throughput. |

Similarity is retrieval relevance, not answer confidence. Threshold changes must be
tested with answerable, paraphrased, and unsupported questions.

## Index Invalidation

The persisted index is reused only when its signature matches the current document,
embedding model, chunk size, chunk overlap, byte limit, and page limit. A relevant
change causes a rebuild automatically. Generation-model, prompt, rate-limit, and
frontend changes do not require re-embedding the PDF.

## Hosted Environments

For a real deployment, inject secrets through the platform's secret manager rather than
shipping a `.env` file. Set non-secret values through deployment configuration. The
repository deliberately does not choose a cloud provider because that decision depends
on identity, data residency, networking, cost, and operational ownership.

See [Security](security.md) for credential handling and [Runbook](runbook.md) for
runtime procedures.
