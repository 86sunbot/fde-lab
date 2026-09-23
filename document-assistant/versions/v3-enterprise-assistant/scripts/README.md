# Operational Scripts

This folder contains repeatable commands that are larger than a one-line runbook action.

`evaluate.py` calls an already-running V3 API using `BACKEND_URL` and `APP_API_KEY`, then
checks the cases in `evals/cases.json`. It validates high-level behavior; it does not test
the OpenAI service independently or calculate a complete quality score.

Rules for future scripts:

- accept configuration through validated arguments or environment variables;
- never print credentials or authorization headers;
- return a non-zero exit code on failure;
- keep side effects explicit and bounded;
- document required preconditions and cost-producing operations;
- add unit tests for reusable decision logic.

Normal startup commands stay in `docs/runbook.md`; scripts are for repeatable workflows,
not hidden application architecture.
