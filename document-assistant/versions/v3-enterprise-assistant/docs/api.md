# API Contract

Base URL for local development: `http://localhost:8000`

## Authentication

Protected endpoints require the application key, not the OpenAI key:

```http
Authorization: Bearer <APP_API_KEY>
```

## `GET /health`

Public liveness check. A successful response means the HTTP process is running.

```json
{
  "status": "ok",
  "version": "3.1.0"
}
```

## `GET /ready`

Public readiness check. A successful response means the configured document has
been embedded and can answer questions.

```json
{
  "status": "ready",
  "document": "document.pdf",
  "indexed_chunks": 8
}
```

Returns `503` when the index is unavailable.

## `POST /v1/questions`

Authenticated and rate-limited.

Request:

```json
{
  "question": "How does Defender for Identity detect lateral movement?"
}
```

The normalized question must contain 3–2,000 characters.

Response:

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

## `GET /metrics`

Authenticated operational snapshot:

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

Metrics are local to one running API process and reset on restart.

## Important Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Request completed |
| `401` | Missing or invalid application API key |
| `422` | Request validation failed |
| `429` | Rate limit exceeded; inspect `Retry-After` |
| `502` | OpenAI request failed |
| `503` | Document assistant is not ready |

Every HTTP response includes `X-Request-ID`. Question responses also include the
same value in the JSON body.
