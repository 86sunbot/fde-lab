import { createContext, useContext, useMemo, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import type { EventInput, OrchestratorState, Role } from "./domain/types";
import type { CaseOverrides } from "./domain/types";
import * as E from "./domain/engine";

export type Action =
  | { type: "ROLE"; role: Role }
  | { type: "VIEW"; view: OrchestratorState["view"] }
  | { type: "INGEST"; event: EventInput }
  | { type: "REPLAY_LAST" }
  | { type: "MALFORMED"; kind: "novessel" | "badtype" | "badclock" }
  | { type: "OVERRIDE"; caseId: string; key: keyof CaseOverrides; value: boolean }
  | { type: "ASSEMBLE"; caseId: string }
  | { type: "GENERATE"; caseId: string }
  | { type: "SELECT"; caseId: string; optionId: string }
  | { type: "APPROVE"; caseId: string; optionId: string }
  | { type: "REJECT"; caseId: string; optionId: string }
  | { type: "COMMIT"; caseId: string }
  | { type: "PUBLISH"; caseId: string }
  | { type: "CLOSE"; caseId: string }
  | { type: "CLEAR_VIOLATION"; caseId: string }
  | { type: "CONNECTIVITY"; online: boolean }
  | { type: "SHORE_EDIT"; caseId: string }
  | { type: "RESOLVE"; caseId: string; field: string; to: "vessel" | "shore" }
  | { type: "ADVISORY"; caseId: string }
  | { type: "ADVISORY_TOGGLE" }
  | { type: "NAV_WRITE" }
  | { type: "RESTRICTED"; caseId: string; kind: "cargo" | "crew" }
  | { type: "SET_CASE"; caseId: string }
  | { type: "RESET" }
  | { type: "TOAST_DISMISS"; id: number };

function reducer(state: OrchestratorState, action: Action): OrchestratorState {
  const now = Date.now();
  const role = state.role;
  switch (action.type) {
    case "ROLE": return E.setRole(state, action.role);
    case "VIEW": return E.setView(state, action.view);
    case "INGEST": return E.ingestEvent(state, action.event, now);
    case "REPLAY_LAST": {
      const last = state.eventLog[state.eventLog.length - 1];
      if (!last) return state;
      return E.ingestEvent(state, {
        eventId: `${last.eventId}-R${now % 1000}`, vesselId: last.vesselId, type: last.type,
        tsSource: last.tsSource, origin: last.origin, summary: `${last.summary} [retransmit]`,
        idemKey: last.idemKey,
      }, now);
    }
    case "MALFORMED": {
      const bad: EventInput =
        action.kind === "novessel"
          ? { eventId: `EV-BAD-${now % 10000}`, vesselId: "", type: "TELEMETRY_ALERT", tsSource: now, origin: "vessel", summary: "packet with empty vesselId" }
          : action.kind === "badtype"
            ? { eventId: `EV-BAD-${now % 10000}`, vesselId: "VB-01", type: "WARP_DRIVE" as EventInput["type"], tsSource: now, origin: "vessel", summary: "packet with unknown type" }
            : { eventId: `EV-BAD-${now % 10000}`, vesselId: "VB-01", type: "POSITION_REPORT", tsSource: -1, origin: "vessel", summary: "packet with negative clock" };
      return E.ingestEvent(state, bad, now);
    }
    case "OVERRIDE": return E.setOverride(state, action.caseId, action.key, action.value, now);
    case "ASSEMBLE": return E.assembleContext(state, action.caseId, now, role);
    case "GENERATE": return E.generateOptions(state, action.caseId, now, role);
    case "SELECT": return E.selectOption(state, action.caseId, action.optionId, role, now);
    case "APPROVE": return E.requestApproval(state, action.caseId, action.optionId, role, now);
    case "REJECT": return E.rejectOption(state, action.caseId, action.optionId, role, now);
    case "COMMIT": return E.commitAction(state, action.caseId, role, now);
    case "PUBLISH": return E.publishReplan(state, action.caseId, role, now);
    case "CLOSE": return E.closeCase(state, action.caseId, role, now);
    case "CLEAR_VIOLATION": return E.clearViolation(state, action.caseId, role, now);
    case "CONNECTIVITY": return E.setConnectivity(state, action.online, now);
    case "SHORE_EDIT": return E.shoreEdit(state, action.caseId, now, role);
    case "RESOLVE": return E.resolveDivergence(state, action.caseId, action.field, action.to, role, now);
    case "ADVISORY": return E.runAdvisory(state, action.caseId, role, now);
    case "ADVISORY_TOGGLE": return E.setAdvisoryEnabled(state, !state.advisoryEnabled, now);
    case "NAV_WRITE": return E.attemptNavigationWrite(state, role, now);
    case "RESTRICTED": return E.requestRestricted(state, action.caseId, action.kind, role, now);
    case "SET_CASE": return E.setActiveCase(state, action.caseId);
    case "RESET": return E.createInitialState(Date.now(), "live");
    case "TOAST_DISMISS": return E.dismissToast(state, action.id);
    default: return state;
  }
}

interface Ctx {
  state: OrchestratorState;
  dispatch: Dispatch<Action>;
}

const OrchestratorContext = createContext<Ctx | null>(null);

export function OrchestratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => E.createInitialState(Date.now(), "live"));
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>;
}

export function useOrchestrator(): Ctx {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) throw new Error("useOrchestrator must be used inside OrchestratorProvider");
  return ctx;
}
