# API Contract

Version 3 introduces an HTTP boundary so clients use a stable, validated contract instead
of importing RAG functions or calling OpenAI directly.

Local base URL: `http://localhost:8000`

Interactive OpenAPI documentation is available while the API runs at `/docs`. It is useful
for learning and local testing; a public deployment should decide deliberately whether to
expose it.

## Authentication

`/health` and `/ready` are public. `/metrics` and `/v1/questions` require the application
key—not the OpenAI key:

```http
Authorization: Bearer <APP_API_KEY>
```

Load local values without printing them:

```bash
set -a
source .env
set +a
```

## Cross-Cutting Behavior

- Request and response bodies are JSON.
- Pydantic rejects unknown request fields and invalid types.
- Every response includes `X-Request-ID`.
- Error bodies use `detail`; application and upstream errors also include `request_id`.
- Protected question requests share a per-process, per-app-key sliding-window rate limit.
- The `/v1` prefix versions the public contract, not the product release.

## `GET /health`

Public liveness check. `200` means the HTTP process can respond; it does not prove the
document index or OpenAI integration is usable.

```bash
curl -i http://localhost:8000/health
```

```json
{
  "status": "ok",
  "version": "3.1.0"
}
```

## `GET /ready`

Public readiness check. `200` means the configured document index is available in the
running process.

```bash
curl -i http://localhost:8000/ready
```

Example response; chunk count varies with the document and chunk settings:

```json
{
  "status": "ready",
  "document": "document.pdf",
  "indexed_chunks": 10
}
```

Returns `503` when the index is unavailable.

## `POST /v1/questions`

Runs the authenticated RAG workflow and is rate-limited.

```bash
curl -i http://localhost:8000/v1/questions \
  -H "Authorization: Bearer $APP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question":"How does Defender for Identity detect lateral movement?"}'
```

Request schema:

```json
{
  "question": "How does Defender for Identity detect lateral movement?"
}
```

The normalized question must be a string containing 3 through 2,000 characters. Extra
fields are rejected.

Example successful response:

```json
{
  "request_id": "884bd58e-5c2f-4fd1-aeb1-34645e98489d",
  "answer": "The document-grounded answer [Source 1].",
  "sources": [
    {
      "source_number": 1,
      "chunk_number": 3,
      "similarity": 0.81,
      "text": "Retrieved document text..."
    }
  ]
}
```

`similarity` is the semantic retrieval score from the vector store. It is used for the
evidence threshold and displayed as retrieval relevance; it is not a probability that the
answer is correct. Candidate reranking affects order but does not replace this returned
semantic value.

When evidence is insufficient, the endpoint still returns `200` with the exact answer:

```text
I could not find that in the document.
```

Sources are returned so a human can inspect what retrieval considered. Citation labels in
the answer are requested by the prompt and are not independently verified by code.

## `GET /metrics`

Returns a protected, process-local operational snapshot:

```bash
curl -i http://localhost:8000/metrics \
  -H "Authorization: Bearer $APP_API_KEY"
```

```json
{
  "total_requests": 10,
  "question_requests": 4,
  "error_responses": 1,
  "rate_limited_requests": 1,
  "active_requests": 1,
  "average_duration_ms": 123.45
}
```

Metrics reset when the process restarts and do not aggregate multiple replicas.

## Error Contract

Representative error:

```json
{
  "detail": "A bearer API key is required"
}
```

| Status | Meaning | Typical action |
| --- | --- | --- |
| `200` | Request completed, including intentional abstention | Inspect answer and evidence. |
| `401` | Missing or invalid application key | Correct the bearer credential. |
| `422` | Request validation failed | Correct JSON shape, type, or length. |
| `429` | Local rate limit exceeded | Wait for the `Retry-After` header. |
| `500` | Unexpected application failure | Correlate the request ID with logs. |
| `502` | Embedding or generation provider failed | Check provider status, credentials, credits, network, timeout, and logs. |
| `503` | Document index is unavailable | Investigate startup/readiness. |

## What the Contract Does Not Provide

- PDF upload or multi-document selection;
- individual accounts, roles, or tenant isolation;
- streaming answers;
- conversation history;
- asynchronous job submission;
- guaranteed citation verification;
- public internet security by itself.

See [Security](security.md), [Request Lifecycle](architecture/request-lifecycle.md), and
[Troubleshooting](troubleshooting.md) for the surrounding behavior.
