# Troubleshooting Guide

Start with the symptom, identify the failing boundary, and use the request ID to correlate
evidence. Avoid changing multiple settings before the cause is understood.

## Fast Diagnostic Sequence

```text
Can /health respond?
  no  -> process, port, dependency, or startup failure
  yes -> can /ready respond?
           no  -> document/index/provider initialization failure
           yes -> can authenticated /v1/questions respond?
                    no  -> auth, validation, rate, or upstream failure
                    yes -> retrieval or answer-quality investigation
```

## Address Already in Use

Symptom:

```text
[Errno 48] Address already in use
```

Find the process actually listening on port 8000:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Stop it gracefully using the real PID printed by `lsof`:

```bash
kill <PID>
```

Do not type the literal text `PID`. A suspended reload process can also hold the port;
`jobs -l` shows jobs in the current shell, and `fg` followed by `Ctrl+C` stops one.

## Backend Unavailable in Streamlit

1. Keep the Uvicorn terminal running. It is the backend process.
2. Confirm `curl http://localhost:8000/health` succeeds.
3. Confirm `BACKEND_URL=http://localhost:8000` for local execution.
4. Restart Streamlit after changing `.env`.

In Compose, the frontend uses `http://api:8000` because containers address each other
by service name.

## Configuration Validation Failure

Typical causes:

- one of the two required keys still begins with `replace-with-`;
- `APP_API_KEY` is shorter than 16 characters;
- `CHUNK_OVERLAP` is not smaller than `CHUNK_SIZE`;
- `CANDIDATE_K` is smaller than `TOP_K`;
- a numeric setting is outside its documented bounds.

Validate without revealing credentials:

```bash
python3 -c "from app.config import Settings; Settings(); print('configuration valid')"
```

## OpenAI `401` or Incorrect Key

An OpenAI authentication error refers to `OPENAI_API_KEY`. A response from this API
saying `Invalid API key` refers to `APP_API_KEY`. These are intentionally separate.

If an old placeholder appears in the OpenAI error, a shell variable may be overriding
`.env`. Inspect only whether it exists, not its value:

```bash
python3 -c "import os; print('shell key present:', bool(os.getenv('OPENAI_API_KEY')))"
```

Run `unset OPENAI_API_KEY`, restart the process, and let Pydantic load `.env`; or export
the correct value intentionally. Never paste the full key into terminal output shared
with other people.

## OpenAI `429` Insufficient Quota

This is different from the application's own rate limiter. OpenAI quota errors mean the
provider account needs usable API credits or billing configuration. Application `429`
responses say `Rate limit exceeded` and include `Retry-After`.

## `ModuleNotFoundError`

The wrong virtual environment or incomplete dependencies are usually the cause.

```bash
which python3
python3 -m pip install -r requirements-dev.txt
python3 -c "import fastapi, pydantic_settings, streamlit; print('dependencies available')"
```

`which python3` should point inside this version's `.venv`.

## Document Index Does Not Become Ready

Check the first exception after `document_index_initializing`. Common causes are:

- missing or unreadable `DOCUMENT_PATH`;
- scanned PDF without extractable text;
- document above byte or page limits;
- unavailable embedding model, network, credentials, or credits;
- unwritable `VECTOR_STORE_PATH` parent directory.

The application needs embeddings during the first index build. An unchanged valid
snapshot avoids re-embedding on later restarts.

## Stale or Corrupt Index

The signature automatically rejects most stale snapshots. To force one safe rebuild,
stop the API and remove only the configured snapshot:

```bash
rm .data/document-index.json
```

Restart the API and expect an embedding charge. Never remove a broad directory or use a
recursive deletion for this procedure.

## `401`, `422`, `429`, `502`, or `503`

| Status | Boundary | Investigation |
| --- | --- | --- |
| `401` | application authentication | Send `Authorization: Bearer $APP_API_KEY`; align frontend and backend values. |
| `422` | Pydantic contract | Check JSON shape, unknown fields, and question length. |
| `429` | application admission control | Wait for `Retry-After`; inspect normal traffic before tuning. |
| `502` | OpenAI provider | Check the correlated structured log, network, model access, credits, timeout, and retry settings. |
| `503` | readiness | Investigate document-index initialization. |

Every response includes `X-Request-ID`. Search the API logs for the same ID.

## Poor Answer Quality

Open the supporting sources first:

- Wrong sources: retrieval/chunking/reranking problem.
- Right sources but abstention: threshold may be too high.
- Right sources but unsupported answer: prompting/model behavior problem.
- No source contains the fact: document coverage problem; abstention is correct.

Do not interpret the displayed similarity as a probability or confidence score. Add the
question to an evaluation set before changing retrieval settings.

## Useful Evidence to Capture

When reporting a problem, include:

- product version and commit hash;
- command used to start each process;
- `/health` and `/ready` status;
- HTTP status and request ID;
- sanitized log event names and timing;
- whether the index was restored or rebuilt;
- question category without sensitive document content;
- expected versus actual behavior.

Never include credentials, authorization headers, prompts, full document chunks, or
private answers. See [Runbook](runbook.md) for normal operations and
[Security](security.md) for data-handling rules.
