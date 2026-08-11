# Enterprise Document Assistant V3 — Runbook

The runbook is for operating the current system. It assumes the architecture is already
chosen; use ADRs for design changes and [Troubleshooting](troubleshooting.md) for detailed
fault diagnosis.

## Service Summary

| Item | Value |
| --- | --- |
| Backend | FastAPI/Uvicorn on port `8000` |
| Frontend | Streamlit on port `8501` |
| Knowledge source | one configured text-based PDF |
| Live index | process memory |
| Restart persistence | local JSON snapshot at `VECTOR_STORE_PATH` |
| External dependency | OpenAI embeddings and generation APIs |
| Liveness | `GET /health` |
| Readiness | `GET /ready` |
| Protected metrics | `GET /metrics` |

## Prerequisites

- Python 3.9 or newer, or Docker with Docker Compose;
- OpenAI API key with available API credits;
- a long random application key;
- configured, permitted, text-based `document.pdf`;
- free local ports `8000` and `8501`.

## First-Time Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements-dev.txt
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Put the OpenAI credential and generated application key in `.env`. Do not commit it.
Review all settings in [Configuration](configuration.md).

## Pre-Start Checks

```bash
source .venv/bin/activate
python3 -c "from app.config import Settings; Settings(); print('configuration valid')"
test -r document.pdf && echo "document readable"
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:8501 -sTCP:LISTEN
```

No output from either `lsof` command means the port is available.

## Start Locally

Terminal 1, from the V3 root:

```bash
source .venv/bin/activate
python3 -m uvicorn app.main:create_app --factory --reload --reload-dir app
```

Expected startup events:

1. `document_index_initializing`;
2. either `document_index_restored` or `document_index_persisted`;
3. `document_index_ready`;
4. Uvicorn reports application startup complete.

A cache miss embeds all chunks and uses OpenAI credits. An unchanged restart restores the
snapshot without recreating document embeddings.

Terminal 2:

```bash
source .venv/bin/activate
python3 -m streamlit run frontend/streamlit_app.py
```

Open `http://localhost:8501`.

## Verify After Startup

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
```

Load the app key and test authentication:

```bash
set -a
source .env
set +a
curl -i http://localhost:8000/metrics \
  -H "Authorization: Bearer $APP_API_KEY"
```

Then use the three-question experiment:

1. direct document wording;
2. semantic paraphrase;
3. unrelated fact that should produce the exact abstention.

Inspect returned sources and request IDs, not only the prose answer.

## Automated and Live Checks

```bash
python3 -m ruff check .
python3 -m pytest
python3 scripts/evaluate.py
```

The last command calls the live API and uses OpenAI credits for supported cases. See
[Testing](testing.md) before interpreting results.

## Start With Docker Compose

Compose reads `.env` for interpolation:

```bash
docker compose up --build
```

The API health check gates the frontend dependency. The `document-index` volume preserves
the snapshot across container recreation.

Inspect status and logs:

```bash
docker compose ps
docker compose logs api
docker compose logs frontend
```

## Normal Shutdown

Local processes: press `Ctrl+C` in the Streamlit terminal, then in the Uvicorn terminal.

Compose:

```bash
docker compose down
```

Do not add `-v` unless intentionally deleting the persisted index volume. The PDF remains
the source of truth, so the index is reconstructable but rebuilding consumes time and
embedding credits.

## Operational Checks

| Check | Healthy signal | Frequency for a learning deployment |
| --- | --- | --- |
| Liveness | `/health` returns `200` | after start and when connectivity fails |
| Readiness | `/ready` returns `200` with expected document/chunk count | after start or document change |
| Request path | grounded answer or intentional abstention | after release/model/document change |
| Logs | JSON events with request IDs, no sensitive content | during troubleshooting |
| Metrics | expected request/error/activity counts | during capacity experiments |
| Evaluation | all reviewed cases pass | before a milestone commit/release |

Current metrics and rate state are process-local and reset on restart. They are not a
durable audit or a multi-replica operational view.

## Safe Index Rebuild

The signature normally invalidates stale data. To force a rebuild:

1. Stop the API.
2. Confirm the configured path in `.env`.
3. Remove only the snapshot:

```bash
rm .data/document-index.json
```

4. Restart and confirm `document_index_persisted` followed by readiness.

Do not use a recursive deletion. A rebuild requires valid OpenAI credentials and credits.

## Document Replacement

1. Confirm permission to use and distribute the new PDF.
2. Stop the API.
3. Replace `DOCUMENT_PATH` or the configured file.
4. Restart; the fingerprint should force re-indexing.
5. Confirm document name and chunk count through `/ready`.
6. Replace the domain evaluation cases and rerun them.
7. Update docs/test evidence if this is a published project milestone.

## Incident Triage

1. Capture timestamp, product version, HTTP status, and `X-Request-ID`.
2. Check `/health`, then `/ready`.
3. Find the correlated structured log event.
4. Classify the boundary: client, validation/auth/rate, RAG, index, provider, or process.
5. Protect secrets and source data while sharing evidence.
6. Apply the smallest reversible recovery action.
7. Verify through the same failing request and relevant tests.

Use [Troubleshooting](troubleshooting.md) for specific symptoms. Use
[Security](security.md) immediately for possible credential exposure.

## Recovery Model

The PDF is the rebuild source. The JSON snapshot reduces startup cost but is not the sole
copy of knowledge. If the snapshot is missing, corrupt, or stale, the API rebuilds it. If
the PDF is lost and no approved backup exists, the index is not an acceptable canonical
backup.

## Deployment Boundary

The Docker image is the deployable artifact. A real deployment still requires explicit
ownership for platform, TLS/domain, secret storage, identity, telemetry retention, data
policy, scaling, backup, cost controls, release/CD, and rollback. These cannot be selected
safely from repository context alone.
