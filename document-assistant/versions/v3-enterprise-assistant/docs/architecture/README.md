# Architecture Guide

## Why Multiple Views Exist

One diagram cannot clearly explain users, running applications, internal
components, code dependencies, request timing, and deployment at the same time.
This folder uses progressive zoom levels.

The C4 model provides four static views:

| Level | Question | Audience |
| --- | --- | --- |
| 1 — Context | Who uses the system and what external systems does it depend on? | Everyone |
| 2 — Container | What applications and data stores run? | Technical stakeholders |
| 3 — Component | What major responsibilities exist inside the backend? | Developers and architects |
| 4 — Code | Which modules, classes, and functions implement those components? | Developers |

In C4 terminology, a container means an application or data store. It does not
necessarily mean a Docker container.

## Recommended Reading Order

1. [System Context](c4-context.md)
2. [Container View](c4-container.md)
3. [Component View](c4-component.md)
4. [Code View](c4-code.md)
5. [Request Lifecycle](request-lifecycle.md)
6. [Deployment View](deployment.md)

The first four documents explain static structure. The request lifecycle adds
time and sequence. The deployment view shows where the containers run.

## Architectural Style

V3 is a small layered service with explicit dependency direction:

```text
Presentation client
  -> HTTP API boundary
  -> application orchestration
  -> domain/infrastructure services
  -> external provider
```

Key rules:

- Streamlit depends on the HTTP contract, not backend internals.
- FastAPI depends on application services.
- services do not import FastAPI or Streamlit.
- OpenAI SDK calls exist only in `OpenAIProvider`.
- retrieval remains explicit Python rather than a hidden orchestration framework.

## Primary Runtime Flows

### Startup

```text
validate configuration
  -> fingerprint PDF
  -> restore compatible index OR extract/chunk/embed/persist
  -> mark assistant ready
```

### Question

```text
receive
  -> authenticate
  -> rate-limit
  -> validate
  -> acquire concurrency slot
  -> embed question
  -> retrieve candidates
  -> rerank
  -> evidence gate
  -> abstain OR generate
  -> return sources and request ID
```

## Trust Boundaries

| Boundary | Trusted side | Untrusted or external side |
| --- | --- | --- |
| Browser -> frontend | Application UI code | User-entered question |
| Frontend -> backend | Authenticated application client | HTTP network and payload |
| Backend -> PDF | Deployment configuration | Document content, including prompt-like text |
| Backend -> OpenAI | Validated prompt construction | Remote provider availability and output |
| Backend -> logs | Privacy-safe metadata | Any content that could contain questions or document text |

See [Security](../security.md) for controls and residual risks.

## Architecture Change Rule

When a structural change is made:

1. update the relevant C4 view;
2. add or supersede an ADR when the decision is architecturally meaningful;
3. update request lifecycle or deployment views if runtime behavior changes;
4. update tests and stored validation evidence;
5. update the runbook if operation changes.

Architecture documents show the current system. ADRs preserve why the system
changed.
