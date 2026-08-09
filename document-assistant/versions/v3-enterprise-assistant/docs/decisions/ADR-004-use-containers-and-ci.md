# ADR-004 — Use Containers and Continuous Integration

## Status

Accepted

## Context

V2 depends on a manually prepared laptop environment and manual verification.
That creates installation drift and makes regressions easy to publish.

## Decision

V3 will provide:

- A non-root Docker image
- Docker Compose for the API and frontend
- A GitHub Actions workflow that installs dependencies, lints, tests, and builds
  the deployment image

The workflow will not deploy to a cloud provider until the provider, environment,
access policy, domain, and credential ownership are explicitly selected.

## Consequences

- Local and CI runtimes become reproducible.
- Every V3 change receives automatic quality checks.
- The image is ready to become a deployment artifact.
- Actual continuous deployment remains an explicit future integration rather
  than a hardcoded vendor assumption.
