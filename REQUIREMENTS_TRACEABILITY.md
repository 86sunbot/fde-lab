# REQUIREMENTS_TRACEABILITY — PRD → Component → Test → Result

Suite: `golden-set@v1.0` · engine `O2-1.4.0` · policy `POL-2026.02` · dataset `SYN-140@v1.0` (synthetic, workshop-only).
Results below are from the deterministic harness (`src/domain/goldenSet.ts`), which executes live in the Verification tab and headlessly via `npx vitest run`.

## Functional requirements

| PRD Req | Component(s) | Tests | Result |
| :--- | :--- | :--- | :--- |
| **FR-01** Deterministic capture & dedupe | `engine.ingestEvent` (idempotency keys), `engine.setConnectivity` spool merge | GS-01, GS-08, unit "replay is idempotent" | ✅ PASS — replays drop with `DuplicateDropped`; 0 duplicate operational actions in every run |
| **FR-02** Context assembly & freshness | `fixtures.makeSources`, `engine.assembleContext` | GS-04, GS-05, GS-06 | ✅ PASS — 100% of recommendations carry source, timestamp, freshness, license class |
| **FR-03** Feasibility & option generation | `fixtures.evaluateOptions` (O2 solver), `policy.SCORING` | GS-02, GS-03, GS-09, GS-10 | ✅ PASS — infeasible blocked with cited constraints; abstains on missing/conflicting/no-feasible |
| **FR-04** Authority & approval gate | `engine.requestApproval`, `policy.PERMISSIONS` | GS-07, GS-10, unit "non-Master blocked" | ✅ PASS — 0 successful unauthorized actions; Master authority non-delegable |
| **FR-05** Offline continuity & reconciliation | `engine.setConnectivity`, `engine.shoreEdit`, `engine.resolveDivergence` | GS-08, GS-05R | ✅ PASS — essential workflow 100% offline; divergences require manual resolution, no silent overwrite |

## Non-functional requirements

| PRD Req | Component(s) | Tests | Result |
| :--- | :--- | :--- | :--- |
| **NFR-01** Resilience | engine edge-spool + cached-evidence path | GS-08 | ✅ PASS — offline essential runs 1, failures 0 (every run) |
| **NFR-02** Security / RBAC | `policy.PERMISSIONS`, engine guards on every mutator | GS-07, GS-12, nav-write unit test | ✅ PASS — unauthorized success 0; violations raise `SecurityViolationRaised` |
| **NFR-03** Privacy minimization | `engine.requestRestricted` gates on cargo/crew | GS-07 family + UI gate demo | ✅ PASS — restricted detail only behind recorded purpose-limited grants; analyst denied |
| **NFR-04** Observability / provenance | `engine.audit`, `policy.VERSIONS` pinning | GS-11 | ✅ PASS — 100% entries carry identity, time, action, evidence refs, versions; before/after on commits |
| **NFR-05** Cost ceilings | `policy.BUDGETS`, `engine.runAdvisory` | Cost panel, advisory auto-disable path | ✅ PASS — token breach disables advisory only; deterministic core never throttled |
| **NFR-06** Interoperability | engine drift normalization, AIS-gap exposure, port conflict preservation | GS-04, GS-09 | ✅ PASS — 47 s drift normalized; 35 min AIS gap exposed; conflicting drafts preserved verbatim |
| **NFR-07** Recoverability / rollback | `engine.clearViolation`, GS-12 rejection path, `policy.transitionAllowed` | GS-07 (rollback check), GS-12 | ✅ PASS — Safety-role rollback restores last safe state; malformed input corrupts nothing |

## AI requirements (O3 optional layer)

| PRD Req | Component(s) | Tests | Result |
| :--- | :--- | :--- | :--- |
| Task boundary (no nav/command) | `engine.attemptNavigationWrite` (prohibited for all roles) | GS-12, Governance probe | ✅ PASS — nav write attempts 0 successes; interface absent |
| Grounding + citations + freshness | `engine.runAdvisory` (cites only fresh sources) | GS-05 (stale suppresses), UI advisory note | ✅ PASS — every advisory output lists citations with freshness |
| Uncertainty & abstention | `fixtures.evaluateOptions` abstention codes, advisory uncertainty field | GS-03, GS-06, GS-08, GS-09 | ✅ PASS — abstains with `MATERIAL_MISSING`, `CONFLICTING_EVIDENCE`, `NO_FEASIBLE_OPTION` |
| Policy gates (AI cannot override) | solver ordering: safety/maintenance/crew checks dominate scoring | GS-10 | ✅ PASS — $180 k commercial option blocked by thermal policy |
| Human oversight + labeling | `advisory: true` flag, approval gate unchanged for advisory options | GS-01 path with OPT-A1 | ✅ PASS — advisory options require identical Master approval |

## Golden-set coverage map (PRD §9)

| Scenario | PRD ref | Test location | Result |
| :--- | :--- | :--- | :--- |
| GS-01 Nominal workflow | FR-01..05 | `goldenSet.ts` GS-01 | ✅ PASS |
| GS-02 High-value positive | FR-03 | GS-02 | ✅ PASS (top-ranked = OPT-COLOMBO) |
| GS-03 Negative / no-action | FR-03, AI-Abstain | GS-03 | ✅ PASS (NO_FEASIBLE_OPTION abstention) |
| GS-04 Rare / edge case | NFR-06 | GS-04 | ✅ PASS |
| GS-05 Stale source | FR-02 | GS-05 | ✅ PASS |
| GS-06 Unavailable source | FR-02/03 | GS-06 | ✅ PASS |
| GS-07 Unauthorized role | FR-04, NFR-02 | GS-07 | ✅ PASS |
| GS-08 Offline / manual fallback | FR-05, NFR-01 | GS-08 | ✅ PASS |
| GS-09 Conflicting evidence | AI grounding | GS-09 | ✅ PASS |
| GS-10 Safety invariant | FR-03/04 | GS-10 | ✅ PASS |
| GS-11 Audit reconstruction | NFR-04 | GS-11 | ✅ PASS (100% provenance) |
| GS-12 Adversarial input | NFR-07 | GS-12 | ✅ PASS |
| GS-05R (supplemental) Reconnect divergence | FR-05 | GS-05R | ✅ PASS |

**Hard-control invariants asserted on every run:** `dupOperationalActions = 0`, `unauthorizedSuccess = 0`,
`navWriteSuccess = 0`, `offlineEssentialFailures = 0`, `provenance = 100%`.

Open items: `OPEN_DECISIONS.md` (8).
