# Test artifacts

This directory documents the expected outputs of the V1 test run. Runtime artifacts are deliberately
not committed here.

| Step | Expected artifact or evidence | Safe to commit? |
|---|---|---|
| Static checks | Ruff and compile output | Yes, as a pass/fail note |
| `doctor` | Deployment preflight output | Yes, if secrets and paths are removed |
| Offline `create` | `generated-rules/*.json` review artifact | No; generated files are ignored |
| `validate` | Validation status and KQL output | Yes, as a sanitized summary |
| `REJECT` review | No-deployment confirmation | Yes, as a sanitized summary |
| `APPROVE` review | Preview/apply output and deployment-input files | No; keep local and sanitize any report |
| Foundry test | Provider/model connectivity result | Yes, without endpoint secrets or tokens |

Use [the V1 test runbook](../docs/TEST-RUNBOOK.md) for the exact sequence. A local run note may be
created as `test-artifacts/<date>-<machine>.md`, but it must not contain API keys, access tokens,
subscription secrets, or unsanitized deployment output.
