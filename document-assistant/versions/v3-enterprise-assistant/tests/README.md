# Automated Tests

These tests prove application behavior without OpenAI credentials, network calls, or API
cost. Shared fixtures in `conftest.py` provide validated test settings and fake services.

| Test file | Primary proof |
| --- | --- |
| `test_api.py` | routes, auth, validation, rate limiting, request IDs, metrics |
| `test_config.py` | settings bounds and cross-field relationships |
| `test_document.py` | extraction limits, chunking, overlap, fingerprinting |
| `test_vector_store.py` | similarity ranking, persistence, invalidation |
| `test_reranker.py` | candidate reranking behavior |
| `test_rag.py` | initialization, grounding, abstention, concurrency, traces |
| `test_openai_provider.py` | centralized timeout/retry client configuration |
| `test_observability.py` | structured logging and metrics behavior |
| `test_frontend.py` | frontend helper behavior |
| `test_evaluation.py` | evaluation scoring logic |
| `test_documentation.py` | required documentation and local link integrity |

Run all deterministic checks:

```bash
python3 -m ruff check .
python3 -m pytest
```

A unit test should assert one stable behavior and name the failure clearly. Do not weaken
an assertion merely because an implementation change broke it; decide whether the public
behavior or the implementation is wrong.

Live model behavior belongs in `evals/` and `scripts/evaluate.py`, not the deterministic
test suite. See `docs/testing.md` for the complete strategy.
