# Test Evidence

This folder stores dated evidence from meaningful release and capability validations.
Automated tests prove repeatable contracts; these reports also preserve the environment,
commands, live observations, and known limits of a specific milestone.

## Reports

| Report | Scope |
| --- | --- |
| [V3 enterprise manual validation](v3-enterprise-manual-validation.md) | Initial authenticated API and UI validation. |
| [V3.1 validation](v3.1-validation.md) | RAG hardening, persistence, automated checks, and live evaluation. |
| [V3 capability validation](v3-capability-validation.md) | Capability-by-capability proof against the engineering mental model. |
| [V3 documentation validation](v3-documentation-validation.md) | Flagship learning structure, code-claim review, link integrity, lint, and tests. |

Supporting command output is in `artifacts/`; screenshots are in `images/`.

## Evidence Rules

- Never store `.env`, credentials, authorization headers, private prompts, or sensitive
  document text.
- Record the date, version, commit when available, environment, exact commands, result,
  and limitations.
- Mark live OpenAI calls separately because they depend on external state and cost.
- Keep raw artifacts small and human-readable.
- Do not use screenshots as the only proof when a reproducible command or test can exist.

## Report Template

```markdown
# Version X.Y Validation

## Scope
What behavior or release was validated.

## Environment
- Date:
- Version:
- Commit:
- Python:
- Platform:

## Checks
| Check | Command or method | Expected | Actual | Result |

## Artifacts
Links to sanitized raw output or images.

## Known Limitations
What this validation does not prove.
```

Routine passing test runs do not each need a permanent artifact. GitHub Actions keeps CI
history; use this folder for learning milestones and release evidence.
