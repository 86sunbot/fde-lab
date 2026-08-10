# Security Notes

## Protected Assets

- OpenAI API key and purchased credits
- Application API key
- PDF contents
- User questions and generated answers
- Service availability

## Implemented Controls

- The OpenAI key exists only in the backend environment.
- Protected endpoints require a separate bearer application key.
- Key comparison uses a constant-time function.
- Raw keys are never placed in logs or limiter identifiers.
- Questions have length and non-whitespace validation.
- The configured PDF has explicit byte and page limits before extraction.
- Rate and concurrency limits protect expensive operations.
- External calls have timeouts and bounded retries.
- Containers run as a non-root user.
- `.env` and local caches are excluded from Git and Docker build context.
- Logs omit request bodies, prompts, source text, answers, and credentials.
- Retrieval traces contain only chunk numbers, scores, counts, sufficiency, and
  timing.
- Retrieved document text is marked as untrusted content in the RAG prompt.

## Remaining Risks

- A shared bearer key does not identify individual users.
- In-memory limits do not coordinate across multiple API replicas.
- The configured PDF is trusted at deployment time; upload scanning is absent.
- Prompt injection defenses reduce but cannot eliminate model manipulation.
- Retrieved source text and answers are returned to any holder of the app key.
- TLS must be terminated by the eventual deployment platform or reverse proxy.
- Secrets require a managed secret store in a real hosted environment.

## Do Not Log

- `OPENAI_API_KEY`
- `APP_API_KEY`
- Authorization headers
- Full questions or answers by default
- Complete document chunks or prompts

## When to Upgrade Authentication

Replace the shared application key with an identity provider when the system
needs multiple users, revocation, roles, audit attribution, or organizational
single sign-on. That decision requires a real identity environment.
