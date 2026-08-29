# TEST_PLAN — Maritime Fleet Disruption & Voyage Recovery Orchestrator

Deterministic suite: `src/domain/goldenSet.ts` (fixed epoch `2026-03-02T06:00Z`, fixed inputs — identical results everywhere).
Execution: in-app (Verification tab) and headless (`npx vitest run` → `src/domain/goldenSet.test.ts`).
Dataset: SYN-140 synthetic v1.0 — workshop only, not production evidence.

## Coverage categories

### 1. Nominal
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-01 | Ingest disruption → assemble context → generate options → Master approves OPT-COLOMBO → FOC commits → publish replan → Master closes | Full chain `DisruptionDetected → … → Nominal` audited; 0 duplicate actions; approval by `master` only |
| Live demo | Operations → "Run full recovery demo" | Same chain with visible state-rail progression |

### 2. Edge cases
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-04 | Ingest event with +47 s source-clock drift; enable AIS-gap condition | `ClockDriftNormalized` audit; 35-min AIS gap exposed (no interpolation); no crash, no invented data |
| Dedupe burst | Replay same idempotency key 3× | 1 materialized event, N `DuplicateDropped` audits, 0 operational actions |

### 3. Stale data
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-05 | Toggle "Stale weather (GS-05)" → re-assemble → generate | Weather shown STALE (370 m > 180 m limit); corridor option blocked (cannot verify safety); commercial optimization blocked; conservative OPT-SLOW remains; stale never concealed |

### 4. Unavailable source
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-06 | Toggle "Port feed down (GS-06)" → re-assemble → generate | Port shown UNAVAILABLE after 3 retries; `MATERIAL_MISSING` abstention; manual fallback checklist raised |

### 5. Unauthorized action
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-07 | As Analyst, press Approve | `Blocked` state; `SecurityViolationRaised` (violation severity) with actor identity; 0 successful unauthorized actions; Safety-role rollback restores last safe state |
| Nav-write probe | Governance → push heading change (any role incl. Master) | `NavWriteProhibited`; success count stays 0 |
| RBAC matrix | Attempt commit/publish/close/reconcile with unpermitted roles | Refused + audited (`ExecutionBlocked`, `ReplanRefused`, `CloseRefused`, `ReconciliationRefused`) |

### 6. Misuse / adversarial
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-12 | Ingest: empty vesselId; unknown type; negative timestamp | All 3 `InputRejected`; event log & case set unchanged; 3 rejection audits with reasons |
| Approve infeasible | As Master, attempt approval of OPT-FULL | `InfeasibleApprovalBlocked`; policy gate refuses even a valid signature on unsafe work |

### 7. Manual fallback
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-08 | Drop link → ingest offline (spool) → assemble/generate from cache → request advisory → restore | Edge spool captures; deterministic options generated offline (essential = 100%); advisory `AdvisoryUnavailable` with manual fallback; spool syncs with re-checked idempotency |
| GS-06 fallback | As above | FOC alerted, checklist: voice-net, Master assessment, manual plan recorded |

### 8. Rollback & reconciliation
| ID | Steps | Expected |
| :--- | :--- | :--- |
| GS-07 rollback | After violation, `clearViolation` as Safety | `RollbackExecuted` with before/after; case at `RecoveryOptionGenerated` |
| GS-05R | Drop link → Shore ETA edit → restore → resolve divergence | `ReconciliationPending`; vessel vs shore values shown; `StateReconciled` records chosen value + before/after; case resumes only after all fields resolved — no silent overwrite |
| Kill-switch | Cost tab / O3 toggle; token budget breach path | `AdvisoryKilled` / `CostLimitBreached`; deterministic core unaffected |

### 9. Golden set & metrics (regression gate)
Run full suite; gate on **all** of:
- 13/13 scenarios pass;
- `dupOperationalActions = 0`, `unauthorizedSuccess = 0`, `navWriteSuccess = 0`, `offlineEssentialFailures = 0`;
- provenance completeness = 100%;
- median disruption→plan < 30 min and P90 < 45 min (**workshop proxy targets — exact targets are OPEN DECISION OD-01**).

## Negative tests (forbidden actions)
1. Non-Master approval → blocked + audited (vitest).
2. Navigation write for every role → 0 successes (vitest).
3. Replay idempotency → 2 drops, 1 materialized event (vitest).

## Not covered (by design, pending OPEN_DECISIONS)
- Real provider latency/cost, production RBAC/authN, audit immutability, legal applicability — see `OPEN_DECISIONS.md`.
