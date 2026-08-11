# Version 3 Capability Validation

## Validation Date

2026-08-10

## Objective

Validate the complete V3 request journey and map every claimed engineering
capability to repeatable evidence.

## Automated Checks

```text
Ruff:  passed
Pytest: 34 passed
```

This is the historical capability-review count captured before the documentation
integrity tests were added. The current 36-test result is recorded in
[V3 documentation validation](v3-documentation-validation.md).

Two focused tests were added during this review:

- The question semaphore prevents more than the configured number of expensive
  workflows from running concurrently.
- The centralized OpenAI provider receives the configured timeout and bounded
  retry count.

Tests use provider fakes and consume no OpenAI credits.

## Live Operational Checks

The already-running local V3.1 service was exercised through HTTP.

| Check | Expected | Observed | Result |
| --- | --- | --- | --- |
| `GET /health` | Live process | `200`, version `3.1.0` | Pass |
| `GET /ready` | Ready index | `200`, `document.pdf`, 10 chunks | Pass |
| Question without bearer key | Reject | `401` | Pass |
| Invalid and unknown request fields | Reject before workflow | `422` | Pass |
| Authenticated `GET /metrics` | Operational snapshot | `200` | Pass |
| Response correlation | `X-Request-ID` present | Present on every checked response | Pass |

No secret value was printed or stored in this evidence.

## Live RAG Evaluation

```text
PASS | direct terminology | grounded with citations
PASS | semantic paraphrase | grounded with citations
PASS | unsupported question | abstained

3/3 evaluation cases passed
```

The live evaluation used the configured OpenAI provider and therefore consumed
a small amount of API credit.

## Interpretation

The results prove the V3 learning objective at its intended single-process
scope: validated and authenticated reception, admission controls, bounded
concurrency, separated services, persistent semantic retrieval, reranking,
grounding, generated answers, predictable failures, structured observability,
and basic evaluation.

Model function calling is not a failed test or missing production control. It
is deliberately outside V3 because there is only one mandatory document-search
operation and therefore no model routing decision.
