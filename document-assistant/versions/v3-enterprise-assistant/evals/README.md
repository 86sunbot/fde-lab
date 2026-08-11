# Evaluation Cases

`cases.json` is the smallest behavior evaluation for the configured sample PDF. It asks:

1. Can the system answer a direct question with sources and citations?
2. Can semantic retrieval handle a paraphrase?
3. Does the system abstain on an unrelated question?

These three cases are a smoke evaluation, not a statistical benchmark. A new document or
domain needs its own representative cases, including difficult answerable questions,
unsupported questions, terminology variation, and known retrieval boundaries.

Run the cases against a live API:

```bash
set -a
source .env
set +a
python3 scripts/evaluate.py
```

Supported cases use OpenAI credits. Store milestone results under `docs/test-results/`
after removing credentials and sensitive content.
