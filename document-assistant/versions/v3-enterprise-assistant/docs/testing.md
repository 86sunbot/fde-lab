# Test and Evaluation Strategy

Tests prove deterministic software contracts. Evaluation measures the behavior of the AI
workflow on representative questions. Version 3 needs both because a correct HTTP service
can still retrieve poor evidence, and a good answer once does not prove reliable software.

## Quality Layers

| Layer | Question answered | Network/OpenAI? | Location |
| --- | --- | --- | --- |
| Static check | Is Python formatted/imported according to project rules? | no | Ruff |
| Unit test | Does one component behave correctly at boundaries? | no | `tests/` |
| Service test | Does RAG orchestration connect deterministic components correctly? | no | `tests/test_rag.py` |
| API test | Does HTTP auth, validation, error, and response behavior hold? | no | `tests/test_api.py` |
| Documentation test | Are required learning artifacts present and local links valid? | no | `tests/test_documentation.py` |
| Container build | Can the deployable image be assembled? | package download may use network | Docker/CI |
| Live evaluation | Does the complete real integration behave on selected cases? | yes; uses credits | `scripts/evaluate.py` |
| Manual UI smoke test | Can a person operate and inspect the product? | yes for questions | Streamlit + report |

## Deterministic Suite

The test suite covers:

- strict configuration constraints and placeholder rejection;
- PDF byte/page limits, extraction, chunking, overlap, and fingerprinting;
- vector ranking, snapshot persistence, and stale-signature rejection;
- candidate reranking;
- grounded prompt rules and exact insufficient-evidence behavior;
- concurrency semaphore enforcement;
- centralized OpenAI timeout and retry configuration;
- service initialization and orchestration through a fake provider;
- bearer authentication, Pydantic validation, rate limiting, `Retry-After`, request IDs,
  health, readiness, response contracts, and protected metrics;
- privacy-safe retrieval traces, structured logging, and local metrics;
- evaluation scoring and frontend helper behavior;
- required documentation and internal-link integrity.

Run from the V3 root:

```bash
source .venv/bin/activate
python3 -m ruff check .
python3 -m pytest
```

Useful focused commands:

```bash
python3 -m pytest tests/test_api.py -q
python3 -m pytest tests/test_rag.py -q
python3 -m pytest tests/test_documentation.py -q
```

## Why OpenAI Is Replaced in Tests

Deterministic tests must be fast, repeatable, and safe without credentials or credits.
Live model output varies and external availability is outside this repository. The
`AIProvider` protocol lets tests inject a fake provider while production uses the
centralized OpenAI adapter.

Mocked tests do not prove that credentials, current model access, network connectivity, or
the live provider work. The live evaluation covers that integration boundary separately.

## Current Basic RAG Evaluation

`evals/cases.json` contains three intentional cases:

| Category | Expected behavior |
| --- | --- |
| Direct terminology | Grounded answer, returned sources, and citation label |
| Semantic paraphrase | Same behavior despite different wording |
| Unrelated question | Exact abstention response |

With the API running:

```bash
set -a
source .env
set +a
python3 scripts/evaluate.py
```

The two supported questions use embeddings and generation; the unrelated question still
uses a question embedding but should avoid generation when its best score is below the
threshold.

This 3-case set is a smoke evaluation, not a statistically meaningful benchmark. It does
not measure recall, faithfulness, citation accuracy, latency percentiles, cost, adversarial
robustness, or a large domain distribution.

## Growing the Evaluation Responsibly

For a real document/domain, build a reviewed dataset with:

- direct and paraphrased answerable questions;
- answers spanning chunk boundaries;
- similar topics where only one passage is correct;
- unsupported and ambiguous questions;
- document-specific terminology and abbreviations;
- expected source chunks or page references where feasible;
- security/adversarial cases appropriate to the data risk.

Separate evaluation data from the production PDF when licensing or privacy requires it.
Version cases and record why an expected result is correct.

## Diagnosing a Failure

| Observation | Likely layer |
| --- | --- |
| Correct chunk never appears among candidates | extraction, chunking, embedding, or candidate retrieval |
| Correct candidate loses before final sources | reranker |
| Correct source selected but threshold rejects | grounding threshold/calibration |
| Correct sources reach prompt but answer is wrong | prompt or generation |
| API returns wrong status/shape | application contract |
| Only live run fails | credentials, provider, network, current model, or live data |

## Milestone Evidence

Store sanitized release/capability reports under [Test Evidence](test-results/README.md).
Include commands, result, environment, artifacts, and limitations. Never store secrets or
sensitive source content. CI history is enough for routine automated runs.

See [Capability Walkthrough](capability-walkthrough.md) for the mapping between production
principles, code boundaries, and proof.
