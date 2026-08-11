# Security Guide

Version 3 introduces explicit security controls around an expensive, document-backed AI
service. It is safe for controlled learning and local operation when configured correctly;
it is not a complete enterprise identity or internet-exposure design.

## Protected Assets

| Asset | Main risk |
| --- | --- |
| OpenAI API key and credits | Credential theft or unbounded paid usage |
| Application API key | Unauthorized access to protected endpoints |
| PDF contents | Disclosure of private knowledge |
| Questions, sources, and answers | Sensitive user or document information leakage |
| Service capacity | Resource exhaustion and denial of service |
| Logs and test artifacts | Accidental secondary copies of sensitive data |

## Trust Boundaries

```text
User -> Streamlit client -> FastAPI -> OpenAI
                              |
                              +-> configured PDF and local index
```

- The browser/user side is not trusted with `OPENAI_API_KEY`.
- The local frontend is trusted with the shared `APP_API_KEY` so it can call the API.
- The API validates input before business logic.
- PDF source text is evidence but is treated as untrusted instructions in the prompt.
- OpenAI is an external processor receiving question-derived embeddings and grounded
  prompts; deployment owners must evaluate applicable data policy.

## Implemented Controls

### Secret Separation

The OpenAI key is used only by the backend provider. A separate application key protects
question and metrics endpoints. `.env` is excluded from Git and the Docker build context.
Configuration objects use secret types to reduce accidental representation.

### Authentication

Protected endpoints require `Authorization: Bearer <APP_API_KEY>`. Comparison is constant-
time, and only a short SHA-256-derived identifier is used by the rate limiter. Raw keys
are not limiter identifiers or log fields.

This is service access control, not individual identity. All holders share the same
permissions and attribution.

### Input and Resource Limits

- Questions must be strings with 3 through 2,000 normalized characters.
- Unknown JSON fields are rejected.
- The configured PDF has byte and page limits before full indexing.
- A sliding-window rate limit bounds admitted protected requests per app key and process.
- A semaphore bounds simultaneously active question pipelines.
- OpenAI calls have configured timeouts and bounded retries.

### Grounding and Prompt-Injection Reduction

The prompt says to use only retrieved sources, treat source tags as evidence rather than
instructions, cite evidence, and abstain when unsupported. A semantic threshold can stop
low-evidence questions before generation.

These controls reduce risk but do not prove that every model response is correctly
grounded. Returned source text permits human inspection; citation verification is future
work if risk requires it.

### Privacy-Safe Observability

Default logs contain routes, status, duration, request IDs, chunk identifiers, scores,
counts, and evidence decisions. They deliberately omit credentials, authorization headers,
full questions, answers, prompts, and source text.

### Container Baseline

The container runs the application as a non-root user. Runtime secrets are injected rather
than copied into the image. This is a useful baseline, not a complete container hardening
or host-security program.

## Do Not Commit or Log

- `.env` or any real secret;
- `OPENAI_API_KEY` or `APP_API_KEY` values;
- authorization headers;
- private PDFs or persisted indexes unless publication is intentional and licensed;
- complete questions, answers, prompts, or source chunks by default;
- screenshots containing credentials, billing information, or private document content.

Before making the repository public, run:

```bash
git status --short
git ls-files | rg '(^|/)(\.env|\.data)(/|$)|\.pdf$'
git log -p --all -- .env
```

The sample `document.pdf` is tracked in this repository. Confirm that it is safe and
licensed for public distribution; a clean Git status alone cannot establish that.

## Remaining Risks and Production Upgrades

| Current limitation | Upgrade trigger | Likely design change |
| --- | --- | --- |
| Shared app key | multiple users, revocation, roles, or audit identity | OIDC/OAuth identity provider and authorization policy |
| Per-process limiter | multiple replicas or consistent global limits | shared distributed rate-limit state or gateway |
| No durable queue | long-running jobs or guaranteed work admission | job API, durable queue, workers, status endpoint |
| Trusted deployment PDF | user uploads | malware scanning, MIME validation, quarantine, per-tenant storage, deletion policy |
| Prompt-requested citations | high-stakes factual traceability | deterministic citation mapping/verification |
| Local JSON index | multiple documents, replicas, large scale | managed storage/vector system with access controls and backup |
| No TLS in app | network deployment | TLS termination, secure domain, proxy/gateway configuration |
| Local logs/metrics | operational SLOs and incident response | centralized telemetry, retention, alerts, dashboards |
| No tenant boundary | customer isolation | tenant identity, storage partitioning, encryption, authorization tests |

## Incident Response Basics

If a key may be exposed:

1. Stop or isolate the affected service.
2. Revoke/rotate the exposed OpenAI or application key at its authority.
3. Remove the value from working files and deployment configuration.
4. Inspect Git history, logs, screenshots, CI output, and shared artifacts for copies.
5. Redeploy all processes with the new value.
6. Review usage and logs for abuse without spreading the secret further.
7. Record cause and preventive action.

Removing a secret from the latest commit does not remove it from Git history. If a real
credential was committed, rotate it first and then use an approved history-rewrite process
with repository-owner coordination.

See [Configuration](configuration.md), [Runbook](runbook.md), and
[API Contract](api.md).
