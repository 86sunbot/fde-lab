# Version 3 Documentation Home

## Purpose

This folder explains not only how to run Version 3, but why every architectural
boundary exists. It is organized so a beginner can learn progressively while an
engineer can jump directly to a contract, decision, or operating procedure.

## Choose Your Reading Path

### I am new to AI

1. [Getting Started](getting-started.md)
2. [AI Foundations](concepts/ai-foundations.md)
3. [RAG Pipeline](concepts/rag-pipeline.md)
4. [Capability Walkthrough](capability-walkthrough.md)
5. [Glossary](glossary.md)

### I want to understand the architecture

1. [Architecture Guide](architecture/README.md)
2. [C4 Context](architecture/c4-context.md)
3. [C4 Container](architecture/c4-container.md)
4. [C4 Component](architecture/c4-component.md)
5. [C4 Code](architecture/c4-code.md)
6. [Request Lifecycle](architecture/request-lifecycle.md)
7. [Deployment View](architecture/deployment.md)
8. [Architecture Decisions](decisions/README.md)

### I want to modify the project

1. [Development Guide](development.md)
2. [Configuration](configuration.md)
3. [API Contract](api.md)
4. [Engineering Principles](engineering-principles.md)
5. [Test Strategy](testing.md)
6. [Security](security.md)

### I want to operate or troubleshoot it

1. [Runbook](runbook.md)
2. [Troubleshooting](troubleshooting.md)
3. [API Contract](api.md)
4. [Stored Test Evidence](test-results/README.md)

### I want to reuse it for another project

1. [Reuse Blueprint](reuse-blueprint.md)
2. [Production Engineering Concepts](concepts/production-engineering.md)
3. [Engineering Principles](engineering-principles.md)
4. [ADR Index and Template](decisions/README.md)
5. [References](references.md)

## Documentation Map

| Document | Question it answers | Primary audience |
| --- | --- | --- |
| `getting-started.md` | How do I run and verify it safely? | First-time user |
| `concepts/ai-foundations.md` | What do the AI terms mean? | AI beginner |
| `concepts/rag-pipeline.md` | How does document evidence become an answer? | Learner and developer |
| `concepts/production-engineering.md` | Why does V3 need production boundaries? | FDE learner |
| `architecture/` | What exists and how is it connected? | Architect and reviewer |
| `api.md` | What is the HTTP contract? | Client developer |
| `configuration.md` | What can be changed and what are the constraints? | Developer and operator |
| `development.md` | How should I read and safely change the code? | Contributor |
| `security.md` | What is protected and what risks remain? | Security reviewer |
| `testing.md` | What behavior is proven and at what layer? | Developer and reviewer |
| `runbook.md` | How is the service started, checked, and recovered? | Operator |
| `troubleshooting.md` | How do I diagnose symptoms systematically? | Operator and learner |
| `reuse-blueprint.md` | What can I carry into the next project? | FDE and architect |
| `glossary.md` | What does an unfamiliar term mean here? | Everyone |
| `decisions/` | Why did the architecture change? | Architect and reviewer |
| `test-results/` | What evidence shows that it works? | Reviewer and interviewer |

## Documentation Contract

Every document follows these rules:

- explain why before how;
- distinguish implemented behavior from future possibilities;
- link architecture claims to code, tests, or stored evidence;
- avoid presenting similarity as answer confidence;
- avoid presenting a local control as a distributed enterprise service;
- keep V1 -> V2 -> V3 continuity visible;
- never contain real secrets, private questions, full prompts, or sensitive logs.

## Current System Facts

These facts should remain consistent across the documentation:

- product version: `3.1.0`;
- API contract path: `/v1/questions`;
- one configured PDF;
- OpenAI embeddings and Responses API behind `OpenAIProvider`;
- in-memory cosine search with a persistent local JSON snapshot;
- semantic candidate retrieval plus deterministic reranking;
- evidence threshold, grounded prompt, visible sources, and abstention;
- one shared bearer application key;
- per-process rate limits, concurrency limits, metrics, and index state;
- model function calling deliberately excluded;
- 36 deterministic tests and three live behavior cases.

If code changes invalidate one of these facts, update the relevant C4 view, ADR,
runbook, test strategy, and README in the same pull request.
