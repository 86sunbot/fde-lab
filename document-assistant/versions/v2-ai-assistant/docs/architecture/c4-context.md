# C4 Level 1 — System Context

## Purpose

Document Assistant V2 lets a user ask a question about a local PDF and receive
an AI-generated answer grounded in retrieved document evidence.

```text
┌──────────┐       question / answer       ┌─────────────────────────┐
│   User   │ ◄───────────────────────────► │ AI Document Assistant V2│
└──────────┘                               └───────────┬─────────────┘
                                                     │
                                  reads              │ API requests
                            ┌────────────────┐        │
                            │ Local PDF file │        ▼
                            └────────────────┘   ┌────────────┐
                                                 │ OpenAI API │
                                                 └────────────┘
```

## People and Systems

### User

- Asks questions through Streamlit
- Receives a concise generated answer
- Inspects the retrieved supporting sources

### AI Document Assistant V2

- Extracts and chunks PDF text
- Creates and stores embedding vectors in memory
- retrieves semantically relevant chunks
- Builds a grounded prompt
- Requests an LLM-generated answer

### OpenAI API

- Converts text into embedding vectors
- Generates an answer from the supplied prompt and evidence

### Local PDF

- Is the sole knowledge source for answers

## Boundary

V2 is a local learning application. The OpenAI API is external, but there is no
application API, authentication layer, managed database, or deployment platform.
