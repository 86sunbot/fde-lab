# ADR-003 — Use Local Production Controls Before Distributed Infrastructure

## Status

Accepted

## Context

V3 must control access, cost, concurrency, and failures. Distributed products
such as an identity provider, API gateway, Redis, and a metrics platform could
solve larger versions of those problems, but this project currently runs as one
small deployment for one configured document.

## Decision

V3 will use:

- A separate bearer application API key
- Pydantic validation
- An in-process sliding-window rate limiter
- An asyncio semaphore for concurrent questions
- OpenAI request timeouts and bounded retries
- Request IDs, structured stdout logs, health, readiness, and in-process metrics

## Consequences

These controls make the current system safer and operable without external
infrastructure. They reset independently in each process and do not coordinate
across replicas.

If multi-instance deployment, enterprise identity, durable metrics, or
multi-tenant limits become requirements, this ADR should be superseded by
shared infrastructure rather than silently stretched beyond its scope.
