# OPEN_DECISIONS — unresolved upstream decisions

These decisions are **OPEN** and block production deployment. Per the approved process they are
recorded here with owners and required evidence. **Nothing in this build guesses at them** — the
workshop uses clearly labeled synthetic stand-ins (documented per item) and the deterministic core
fails safe (abstains/blocks) wherever a real decision would be required.

| ID | Open decision | Owner / evidence required | Workshop stand-in (clearly labeled, not a guess) |
| :--- | :--- | :--- | :--- |
| **OD-01** | Exact performance target, observation window, and confidence method | Sponsor / Process Owner (after baseline reproduction) | Proxy thresholds in the Verification metrics table: median < 30 min, P90 < 45 min disruption→plan, marked with `*` |
| **OD-02** | Named real-source owners and access approvers | Director, FOC and Data Custodians | Fixture sources labeled `SYN-*`; license classes shown per PRD §6 but no real endpoints called |
| **OD-03** | Production data permissions, retention, encryption, and isolation | Data Owners + Privacy/Security/Compliance functions | Cargo/crew detail minimized behind recorded purpose gates (NFR-03 demo); nothing persisted beyond session memory |
| **OD-04** | Jurisdiction, legal applicability, and EU AI Act conclusion | Qualified Legal / Compliance Review | System framed as decision-support with human authority retained; no legal claim made anywhere in-product |
| **OD-05** | Feasible-option validation tolerance | Process Owner + Safety/Security/Compliance functions | Deterministic checks use PRD-stated constraints (UKC, class limits, MLC rest, thermal policy) with conservative margins; tolerance knobs in `fixtures.buildFacts` |
| **OD-06** | Production role model, authentication/authorization, and audit immutability | IT / Security / Control functions | Console role switcher demonstrates RBAC semantics only — no authN; audit log is append-only in memory, not tamper-proof |
| **OD-07** | Real provider/model, hosting/residency, cost budget, and change control | Sponsor, IT, Data/Security/Control functions | Model pinned as `gemini-2.5-flash@2025-06-17·synthetic-stand-in`, prompt `P-RECOV-07`; budgets (`policy.BUDGETS`) are workshop values |
| **OD-08** | Full comparative recovery-value, latency/cost, and integration PoC results | FDE Team with Process-Owner review | Recovery-value index (RVI) weights in `policy.SCORING` are auditable placeholders; A/B evidence pending |

## Rules for this build
1. When an open decision touches runtime behavior, the system **abstains or blocks** rather than assumes.
2. Every stand-in is named as synthetic in the UI, audit trail (`dataset SYN-140@v1.0`), and docs.
3. Resolving an OD requires: owner sign-off, evidence attached, a version bump in `policy.VERSIONS`,
   and a golden-set re-run (`npx vitest run` + Verification tab) with results recorded in
   `REQUIREMENTS_TRACEABILITY.md`.

## Status
- Resolved: **0** · Open: **8**
- No OD has been resolved by inference during implementation (per engineering rule: "do not guess").
