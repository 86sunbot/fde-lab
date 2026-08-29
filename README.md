# NORTHWATCH FOC — Maritime Fleet Disruption & Voyage Recovery Orchestrator

Workshop build implementing the approved PRD on the **Option 2 (O2)** architecture: event-sourced
synchronization plus a deterministic constraint engine, with **Option 3 (O3)** retrieval-grounded
advisory permitted only as a separately tested, policy-gated optional layer.

> **Synthetic data only.** The 140-row CSV and 12 golden scenarios are workshop profiling data,
> not production evidence. No secrets, no regulated data, no real integrations.
>
> **Known workshop defect:** independent verification found that 15 of 17 Vitest tests pass.
> GS-08 (offline advisory fallback) currently fails because its audit/fallback state is not
> returned by the advisory function. This project is a learning demo and is not production-ready.

---

## 1. Run locally

```bash
npm install
npm run dev        # interactive console at http://localhost:5173
npm run build      # production bundle (dist/)
npx vitest run     # golden-set + negative tests (src/domain/goldenSet.test.ts)
```

The console runs the deterministic suite in-browser through the
**Verification tab → "Re-run suite"**. Results, metrics, and thresholds are reported live;
the GS-08 defect must be corrected before treating the suite as a passing verification result.

## 2. What the console demonstrates

| PRD item | Where in the UI |
| :--- | :--- |
| FR-01 capture & dedupe | Operations → Durable event log · "Replay last (dedupe test)" |
| FR-02 context & freshness | Operations → Context panel (source, timestamp, freshness, license class) |
| FR-03 feasibility / abstention | Operations → Options board · condition toggles (GS-03/05/06/09) |
| FR-04 approval gate | Operations → Master approval gate · role switcher (GS-07 demo) |
| FR-05 offline & reconciliation | "Drop link / Restore link / Shore ETA edit" scenario buttons |
| NFR-02 RBAC / NFR-07 rollback | Role switcher + "Safety rollback" on frozen cases |
| NFR-03 privacy gates | Restricted cargo/crew cards → "Request access (audited)" |
| NFR-04 provenance | Audit rail — every entry carries identity, time, evidence refs, pinned versions |
| NFR-05 cost ceilings | Cost tab — sat KB + AI tokens vs budget; advisory auto-disable |
| Data-contract prohibition | Governance → "Push heading change to ECDIS" probe (always blocked) |
| PRD §9 golden set | Verification tab — 13 scenarios, metrics vs thresholds |

**Fastest tour:** open Operations → "Run full recovery demo" (Master approve → FOC commit →
replan → close). Then switch role to *Analyst* and press Approve → watch the case freeze with a
`SecurityViolationRaised` audit entry; roll back as *Safety & Compliance*.

## 3. Architecture

```
src/domain/policy.ts      centralized rules: versions, budgets, thresholds, RBAC, state machine
src/domain/types.ts       domain contracts
src/domain/fixtures.ts    synthetic fleet/sources/facts + deterministic constraint solver (O2 core)
src/domain/engine.ts      pure event-sourced engine: ingest/dedupe → context → options →
                          approval gate → controlled execution → offline spool → reconciliation
src/domain/goldenSet.ts   deterministic GS-01..GS-12 (+GS-05R) regression suite
src/domain/goldenSet.test.ts  vitest wrapper + negative tests (forbidden actions)
src/store.tsx             React reducer bound to the pure engine
src/components/*          FOC console (operations / verification / governance views)
```

Engineering rules honored:

- Domain rules, permissions, policy gates and state transitions live **only** in
  `policy.ts` + `engine.ts`. UI cannot bypass them.
- Every audit entry pins material versions: engine `O2-1.4.0`, policy `POL-2026.02`,
  dataset `SYN-140@v1.0`, app `0.9.0-workshop`, and for advisory output model
  `gemini-2.5-flash@2025-06-17·synthetic-stand-in` + prompt `P-RECOV-07`.
- Hard controls enforced deterministically: 0 duplicate operational actions from replay,
  0 successful unauthorized actions, 0 navigation writes (interface absent), abstention on
  missing/stale/conflicting material evidence, manual reconciliation before any overwrite,
  advisory kill-switch + budget auto-disable.

## 4. Google AI Studio — Build-mode handoff

1. **Context files (attach in order):** `README.md`, `REQUIREMENTS_TRACEABILITY.md`,
   `TEST_PLAN.md`, `OPEN_DECISIONS.md`, then `src/domain/policy.ts`, `src/domain/types.ts`,
   `src/domain/fixtures.ts`, `src/domain/engine.ts`, `src/domain/goldenSet.ts`.
2. **Prompt scaffold:** "Implement only the approved PRD (attached traceability map). Keep the
   O2 deterministic core pure and side-effect free. O3 advisory may only add labeled, cited,
   approval-gated suggestions. Re-run `runGoldenSet()` after every change; all 13 scenarios and
   the metrics table must pass. Do not resolve items in OPEN_DECISIONS.md — escalate them."
3. **Model settings:** temperature ≤ 0.2 for engine work; record any prompt change as a new
   `P-RECOV-xx` version in `policy.ts` and in the audit `versions` block.
4. **Gate before merge:** correct GS-08, then require `npx vitest run` green + in-app
   Verification tab green + no new OPEN_DECISIONS resolved by guess.

## 5. Test commands & results (this session)

| Command | Result |
| :--- | :--- |
| `npm run build` | Qwen Code reported a passing build; independent local build verification is still pending. |
| `runGoldenSet()` in-app harness | Qwen Code reported 13/13 green; this must be rerun after GS-08 is fixed. |
| `npx vitest run` | Independently run: **15/17 pass**. GS-08 offline advisory fallback and the aggregate-suite test fail. |

Remaining open decisions: see `OPEN_DECISIONS.md` (8 items, all owner-assigned, none guessed).
