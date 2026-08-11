# Request and Startup Lifecycles

## Why a Dynamic View Is Needed

C4 views show what exists. This document shows when components act and where a
request can stop.

## Startup: Compatible Snapshot

```mermaid
sequenceDiagram
    participant U as Uvicorn/FastAPI
    participant R as DocumentAssistant
    participant D as Document processor
    participant V as Vector store
    participant O as OpenAI provider

    U->>R: initialize()
    R->>D: fingerprint document
    D-->>R: document hash
    R->>R: build index signature
    R->>V: restore(snapshot, signature)
    V-->>R: compatible snapshot restored
    R-->>U: ready with chunk count
    Note over O: No document embedding call
```

## Startup: Cache Miss or Changed Document

```mermaid
sequenceDiagram
    participant U as Uvicorn/FastAPI
    participant R as DocumentAssistant
    participant D as Document processor
    participant V as Vector store
    participant O as OpenAI provider

    U->>R: initialize()
    R->>D: fingerprint document
    D-->>R: document hash
    R->>V: restore(snapshot, signature)
    V-->>R: miss, stale, or corrupt
    R->>D: validate and extract PDF
    D-->>R: page-marked text
    R->>D: split into chunks
    D-->>R: chunks
    R->>O: embed all chunks
    O-->>R: aligned vectors
    R->>V: replace in-memory index
    R->>V: atomically persist snapshot
    R-->>U: ready with chunk count
```

## Successful Question

```mermaid
sequenceDiagram
    actor User
    participant UI as Streamlit
    participant API as FastAPI
    participant SEC as Security
    participant RAG as DocumentAssistant
    participant VS as Vector store
    participant RR as Reranker
    participant OA as OpenAI provider

    User->>UI: enter question
    UI->>API: POST /v1/questions + bearer key
    API->>API: assign request ID and start metrics
    API->>SEC: authenticate and check rate
    SEC-->>API: admitted
    API->>API: validate QuestionRequest
    API->>RAG: answer(normalized question)
    RAG->>RAG: acquire concurrency slot
    RAG->>OA: embed question
    OA-->>RAG: question vector
    RAG->>VS: search CANDIDATE_K
    VS-->>RAG: semantic candidates
    RAG->>RR: rerank and select TOP_K
    RR-->>RAG: selected sources
    RAG->>RAG: evidence threshold passes
    RAG->>OA: generate from grounded prompt
    OA-->>RAG: answer text
    RAG-->>API: AnswerResult + sources
    API->>API: validate QuestionResponse
    API-->>UI: 200 + answer + sources + X-Request-ID
    UI-->>User: render answer and evidence
```

## Unsupported Question

```mermaid
sequenceDiagram
    participant API as FastAPI
    participant RAG as DocumentAssistant
    participant VS as Vector store
    participant OA as OpenAI provider

    API->>RAG: answer(question)
    RAG->>OA: embed question
    OA-->>RAG: question vector
    RAG->>VS: retrieve and rerank
    VS-->>RAG: weak candidates
    RAG->>RAG: similarity below threshold
    RAG-->>API: abstention + inspected sources
    Note over OA: No generation request
```

## Failure Branches

```mermaid
flowchart TD
    REQ["Incoming request"] --> AUTH{"Bearer key valid?"}
    AUTH -->|"No"| E401["401 Unauthorized"]
    AUTH -->|"Yes"| RATE{"Within rate limit?"}
    RATE -->|"No"| E429["429 + Retry-After"]
    RATE -->|"Yes"| VALID{"Payload valid?"}
    VALID -->|"No"| E422["422 Validation Error"]
    VALID -->|"Yes"| READY{"Index ready?"}
    READY -->|"No"| E503["503 Not Ready"]
    READY -->|"Yes"| WORK["Execute RAG workflow"]
    WORK --> UP{"OpenAI operation succeeds?"}
    UP -->|"No"| E502["502 Upstream Failure"]
    UP -->|"Yes"| OK["200 Answer or Abstention"]
    WORK -. "unexpected exception" .-> E500["500 Generic Error"]
```

## Observability Along the Path

Every branch receives an `X-Request-ID`. The middleware records total duration
and final status. Retrieval logs add candidate/selection metadata when the
workflow reaches that stage.

Because content is intentionally omitted from logs, operators use the request
ID plus returned sources and user-reported question context during diagnosis.
