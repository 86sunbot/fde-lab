// Synthetic workshop fixtures — NOT production evidence (PRD §2, data contracts).
// All numbers are deterministic functions of (caseId, overrides, now).

import type {
  AbstentionRecord,
  CaseOverrides,
  ContextBundle,
  ConstraintCheck,
  RecoveryOption,
  SourceId,
  SourceSnapshot,
  Vessel,
} from "./types";
import { SCORING, SOURCE_POLICY, THRESHOLDS } from "./policy";

export const FLEET: Vessel[] = [
  {
    id: "VB-01", name: "MV Aurora Bay", imo: "IMO 9731145", kind: "Container · 4,200 TEU",
    route: "Rotterdam → Singapore", position: "12°41.2′N 068°12.7′E", sogKn: 18.2, hdg: 97,
    draftM: 10.6, status: "disruption", caseId: "CS-014", blip: { x: 63, y: 36 },
  },
  {
    id: "VB-02", name: "MV Boreal Crown", imo: "IMO 9587720", kind: "Bulk carrier · 82 k dwt",
    route: "Santos → Qingdao", position: "25°18.9′S 044°52.1′W", sogKn: 13.6, hdg: 91,
    draftM: 13.9, status: "disruption", caseId: "CS-021", blip: { x: 24, y: 66 },
  },
  {
    id: "VB-03", name: "MV Cassia Meridian", imo: "IMO 9614482", kind: "Product tanker · 50 k dwt",
    route: "Fujairah → Durban", position: "14°02.5′N 058°33.0′E", sogKn: 12.9, hdg: 201,
    draftM: 11.2, status: "nominal", blip: { x: 71, y: 52 },
  },
  {
    id: "VB-04", name: "MV Delft Horizon", imo: "IMO 9482267", kind: "Feeder · 1,100 TEU",
    route: "Hamburg → Gdańsk", position: "54°11.8′N 007°58.3′E", sogKn: 14.1, hdg: 42,
    draftM: 7.8, status: "offline", blip: { x: 42, y: 21 },
  },
];

export interface DisruptionDef {
  type: string;
  summary: string;
  criticalSources: SourceId[];
}

export const DISRUPTION_DEFS: Record<string, DisruptionDef> = {
  ENGINE_COOLING: {
    type: "ENGINE_COOLING",
    summary: "Main engine jacket-water temp Δ +14 °C over baseline (96 °C vs 82 °C nominal).",
    criticalSources: ["telemetry", "weather", "port", "crew"],
  },
  PORT_CONGESTION: {
    type: "PORT_CONGESTION",
    summary: "Qingdao berth congestion — original berth withdrawn; berthing window missed.",
    criticalSources: ["port", "weather", "cargo"],
  },
};

export interface CaseFacts {
  tempDevC: number;
  waveHs: number;
  waveLimit: number;
  draftM: number;
  ukcReq: number;
  colomboDraft: number;
  colomboBerth: boolean;
  portBDraft: number;
  reeferMarginH: number;
  restOk: boolean;
  thermalAtSlowOk: boolean;
  thermalAtFullOk: boolean;
  slackHrs: number;
  noticeAltHrs: number;
  noticeMaxHrs: number;
  anchorageOpen: boolean;
  aisGapMin: number;
}

export function buildFacts(caseId: string, ov: CaseOverrides): CaseFacts {
  const tight = !!ov.tightWindow;
  if (caseId === "CS-021") {
    return {
      tempDevC: 0, waveHs: 3.1, waveLimit: 2.5, draftM: 13.9, ukcReq: 0.9,
      colomboDraft: 0, colomboBerth: false, portBDraft: 0, reeferMarginH: 99,
      restOk: true, thermalAtSlowOk: true, thermalAtFullOk: true,
      slackHrs: 0, noticeAltHrs: 30, noticeMaxHrs: 24, anchorageOpen: false,
      aisGapMin: ov.aisGap ? 35 : 0,
    };
  }
  return {
    tempDevC: 14, waveHs: 4.2, waveLimit: 5.5, draftM: 10.6, ukcReq: 0.8,
    colomboDraft: 12.0, colomboBerth: true, portBDraft: 9.8, reeferMarginH: 6,
    restOk: true, thermalAtSlowOk: true, thermalAtFullOk: false,
    slackHrs: tight ? 2 : 96, noticeAltHrs: 6, noticeMaxHrs: 24, anchorageOpen: true,
    aisGapMin: ov.aisGap ? 35 : 0,
  };
}

const MIN = 60_000;

interface SourceRow {
  id: SourceId;
  label: string;
  retrievedAgoMin: number | null;
  staleAfterMin: number;
  headline: string;
  detail: string;
  critical: boolean;
}

function baseSources(caseId: string): SourceRow[] {
  if (caseId === "CS-021") {
    return [
      { id: "telemetry", label: "Vessel telemetry", retrievedAgoMin: 4, staleAfterMin: THRESHOLDS.telemetryStaleAfterMin, headline: "All params nominal · seq 5512", detail: "Main/aux engines, generators, ballast — 1 Hz aggregate.", critical: false },
      { id: "ais", label: "AIS / voyage plan", retrievedAgoMin: 7, staleAfterMin: THRESHOLDS.aisStaleAfterMin, headline: "25°18.9′S 044°52.1′W · SOG 13.6 kn", detail: "Class-A positional, voyage plan v7 lodged.", critical: false },
      { id: "weather", label: "Weather / ocean", retrievedAgoMin: 26, staleAfterMin: THRESHOLDS.weatherStaleAfterMin, headline: "Anchorage swell 3.1 m @ 9 s", detail: "Combined model run 00Z; swell exceeds 2.5 m anchorage limit.", critical: true },
      { id: "port", label: "Port feed — Qingdao", retrievedAgoMin: 31, staleAfterMin: THRESHOLDS.portStaleAfterMin, headline: "Berth withdrawn · alt berth 7 notice 30 h", detail: "Terminal ops feed; berth 7 shortest notice 30 h, anchorage closed to arrivals.", critical: true },
      { id: "cargo", label: "Cargo / charter", retrievedAgoMin: 55, staleAfterMin: THRESHOLDS.cargoStaleAfterMin, headline: "Laycan slack 0 h · 68 kt soya beans", detail: "Charter party laycan window closed; off-hire clause active. Tenant-isolated.", critical: true },
      { id: "crew", label: "Crew", retrievedAgoMin: 130, staleAfterMin: THRESHOLDS.crewStaleAfterMin, headline: "Rest hours compliant · 22 POB", detail: "MLC rest records green for 72 h horizon. Personal data gated.", critical: false },
    ];
  }
  return [
    { id: "telemetry", label: "Vessel telemetry", retrievedAgoMin: 2, staleAfterMin: THRESHOLDS.telemetryStaleAfterMin, headline: "JW temp 96 °C · Δ +14 °C · seq 8841", detail: "Jacket-water loop, lube oil, scavenge air — 1 Hz aggregate, offline-cached.", critical: true },
    { id: "ais", label: "AIS / voyage plan", retrievedAgoMin: 6, staleAfterMin: THRESHOLDS.aisStaleAfterMin, headline: "12°41.2′N 068°12.7′E · SOG 18.2 kn", detail: "Class-A positional; voyage plan v12 lodged (Rotterdam → Singapore).", critical: false },
    { id: "weather", label: "Weather / ocean", retrievedAgoMin: 22, staleAfterMin: THRESHOLDS.weatherStaleAfterMin, headline: "Corridor B Hs 4.2 m · fcst +18 h", detail: "Combined wave model 00Z run; corridor B within 5.5 m class limit through +48 h.", critical: true },
    { id: "port", label: "Port feed — Colombo / Belawan", retrievedAgoMin: 35, staleAfterMin: THRESHOLDS.portStaleAfterMin, headline: "Colombo A3 open · 12.0 m · Belawan 9.8 m", detail: "Berth availability + published drafts; agent reports cross-checked where available.", critical: true },
    { id: "cargo", label: "Cargo / customer", retrievedAgoMin: 61, staleAfterMin: THRESHOLDS.cargoStaleAfterMin, headline: "380 reefer plugs · 6 h power margin", detail: "Reefer manifest aggregated; customer-level detail minimized & tenant-isolated.", critical: false },
    { id: "crew", label: "Crew", retrievedAgoMin: 118, staleAfterMin: THRESHOLDS.crewStaleAfterMin, headline: "Rest hours compliant · 2nd engineer aboard", detail: "MLC rest records green for 96 h horizon; qualified engineer onboard. Personal data gated.", critical: true },
  ];
}

export function makeSources(caseId: string, now: number, ov: CaseOverrides, online: boolean): SourceSnapshot[] {
  return baseSources(caseId).map((row) => {
    const unavail = row.id === "port" && !!ov.portDown;
    const agoMin = row.id === "weather" && ov.staleWeather ? 370 : row.retrievedAgoMin ?? 0;
    const retrievedAt = unavail ? null : now - agoMin * MIN;
    let status: SourceSnapshot["status"] = "fresh";
    if (unavail) status = "unavailable";
    else if (!online) status = "cached";
    else if (retrievedAt !== null && now - retrievedAt > row.staleAfterMin * MIN) status = "stale";

    let headline = row.headline;
    let detail = row.detail;
    let conflict: SourceSnapshot["conflict"];
    let note: string | undefined;

    if (row.id === "weather" && ov.staleWeather) {
      headline = "Corridor B Hs — forecast run 6 h 10 m old";
      note = "STALE — provider feed not refreshed since 00Z run.";
    }
    if (row.id === "port" && ov.conflict) {
      conflict = { withLabel: "Port agent report (05:12Z)", valueA: "12.0 m", valueB: "9.5 m" };
      headline = "Colombo A3 draft — CONFLICT: feed 12.0 m vs agent 9.5 m";
      note = "Semantic conflict preserved — no silent resolution.";
    }
    if (row.id === "port" && unavail) {
      headline = "Port feed unreachable — 3 retries exhausted";
      detail = "HTTP 503 then timeout; deterministic backoff complete. Manual fallback required.";
    }
    if (row.id === "ais" && ov.aisGap) {
      note = "AIS gap 35 min between fixes (no interpolation applied).";
    }
    if (!online && status === "cached") {
      note = "Cached at vessel edge — last sync value shown, not refreshed.";
    }

    return {
      id: row.id,
      label: row.label,
      status,
      retrievedAt,
      elapsedMin: retrievedAt === null ? null : Math.round((now - retrievedAt) / MIN),
      staleAfterMin: row.staleAfterMin,
      license: SOURCE_POLICY[row.id].license,
      headline,
      detail,
      critical: row.critical,
      conflict,
      note,
    };
  });
}

// ---------- deterministic option evaluation (O2 constraint core) ----------

function chk(
  id: string, label: string, kind: ConstraintCheck["kind"], sourceId: SourceId,
  critical: boolean, pass: boolean | null, detail: string,
): ConstraintCheck {
  return { id, label, kind, sourceId, critical, pass, detail };
}

function score(o: Pick<RecoveryOption, "delayHrs" | "costUsd" | "risk">): number {
  return Math.round(
    (SCORING.base + SCORING.wDelay * o.delayHrs + SCORING.wCost * o.costUsd + SCORING.riskAdj[o.risk]) * 10,
  ) / 10;
}

function finalize(o: RecoveryOption): RecoveryOption {
  const failed = o.checks.filter((c) => c.pass === false);
  const undeterminedCritical = o.checks.filter((c) => c.critical && c.pass === null);
  if (failed.length > 0) {
    const safetyHit = failed.some((c) => c.kind === "safety" || c.kind === "maintenance" || c.kind === "crew");
    return {
      ...o,
      feasible: false,
      blockedReason:
        failed.map((c) => c.detail).join(" · ") +
        (safetyHit ? "  [safety/maintenance constraint overrides commercial value]" : ""),
    };
  }
  if (undeterminedCritical.length > 0) {
    return {
      ...o,
      feasible: false,
      blockedReason: `Cannot verify: ${undeterminedCritical.map((c) => c.label).join(", ")} — evidence not fresh/consistent. Not generated as actionable.`,
    };
  }
  return { ...o, feasible: true, recoveryScore: score(o) };
}

function refsFor(checks: ConstraintCheck[], ctx: ContextBundle): string[] {
  const ids = Array.from(new Set(checks.map((c) => c.sourceId)));
  return ids.map((id) => {
    const s = ctx.sources.find((x) => x.id === id);
    if (!s) return `${id}@?`;
    if (s.status === "unavailable") return `${id}@UNAVAIL`;
    if (s.status === "stale") return `${id}@STALE-${s.elapsedMin}m`;
    return `${id}@${s.elapsedMin}m`;
  });
}

export interface OptionEvalResult {
  options: RecoveryOption[];
  abstain: AbstentionRecord | null;
  commercialBlocked: string | null;
}

export function evaluateOptions(
  caseId: string, ctx: ContextBundle, facts: CaseFacts, ov: CaseOverrides,
  now: number, includeAdvisory: boolean,
): OptionEvalResult {
  const src = (id: SourceId) => ctx.sources.find((s) => s.id === id)!;
  const undet = (id: SourceId): boolean | null => {
    const s = src(id);
    if (ov.conflict && id === "port") return null;
    if (s.status === "stale" || s.status === "unavailable" || s.status === "cached") {
      // cached (offline) evidence is permitted for ESSENTIAL continuation only when it was fresh at cache time
      return s.status === "cached" ? true : null;
    }
    return true;
  };

  // 1) material missing → abstain before generating anything (FR-03)
  const missing = ctx.sources.filter((s) => s.critical && s.status === "unavailable");
  if (missing.length > 0) {
    return {
      options: [],
      commercialBlocked: null,
      abstain: {
        at: now, code: "MATERIAL_MISSING",
        reason: `Material source unavailable: ${missing.map((m) => m.label).join(", ")}. Option generation withheld.`,
        manualFallback: true,
        missingSources: missing.map((m) => m.id),
      },
    };
  }

  // 2) conflicting evidence on a critical source → abstain on a single option (GS-09)
  if (ov.conflict) {
    const portSnap = src("port");
    return {
      options: [],
      commercialBlocked: null,
      abstain: {
        at: now, code: "CONFLICTING_EVIDENCE",
        reason: `Conflicting evidence on ${portSnap.label}: ${portSnap.conflict?.valueA} (feed) vs ${portSnap.conflict?.valueB} (agent). No single option issued.`,
        manualFallback: true,
        missingSources: ["port"],
      },
    };
  }

  const staleWeather = !!ov.staleWeather && caseId === "CS-014";
  const commercialBlocked = staleWeather
    ? `Weather feed STALE (${src("weather").elapsedMin} m old > ${src("weather").staleAfterMin} m limit) — commercial optimization blocked; conservative options only.`
    : null;

  let options: RecoveryOption[] = [];

  if (caseId === "CS-021") {
    const slowChecks = [
      chk("c-shift-notice", "Alt-berth notice time", "port", "port", true,
        facts.noticeAltHrs <= facts.noticeMaxHrs ? true : false,
        `Notice required ${facts.noticeAltHrs} h vs terminal max ${facts.noticeMaxHrs} h.`),
      chk("c-shift-rest", "Crew rest horizon", "crew", "crew", true,
        facts.restOk ? true : false, "MLC rest hours compliant for +10 h shift."),
    ];
    const anchChecks = [
      chk("c-anch-open", "Anchorage open / swell limit", "safety", "port", true,
        facts.anchorageOpen ? true : false,
        `Anchorage ${facts.anchorageOpen ? "open" : "closed — swell 3.1 m exceeds 2.5 m limit"}.`),
      chk("c-anch-wave", "Transit Hs within class limit", "safety", "weather", true,
        undet("weather") === null ? null : facts.waveHs <= facts.waveLimit + 1.4,
        `Swell ${facts.waveHs} m vs transit allowance ${facts.waveLimit + 1.4} m.`),
    ];
    const delayChecks = [
      chk("c-delay-slack", "Charter laycan slack", "commercial", "cargo", true,
        facts.slackHrs >= 12 ? true : false,
        `Laycan slack ${facts.slackHrs} h < 12 h required — off-hire penalty triggered.`),
      chk("c-delay-rest", "Crew rest horizon", "crew", "crew", true,
        facts.restOk ? true : false, "MLC rest hours compliant for +20 h hold."),
    ];
    options = [
      finalize({ id: "OPT-SHIFT", label: "Shift to alternate berth 7", summary: "Re-berth at Qingdao terminal 7 when notice window allows.", advisory: false, feasible: false, checks: slowChecks, delayHrs: 10, costUsd: 40_000, risk: "low", recoveryScore: 0, evidenceRefs: [], effects: { destination: "Qingdao ( berth 7 )", note: "Terminal shift within port" } }),
      finalize({ id: "OPT-ANCH", label: "Move to offshore anchorage queue", summary: "Proceed to designated anchorage; queue for next window.", advisory: false, feasible: false, checks: anchChecks, delayHrs: 26, costUsd: 58_000, risk: "medium", recoveryScore: 0, evidenceRefs: [], effects: { destination: "Qingdao anchorage A", note: "Holding pattern, re-approach at window" } }),
      finalize({ id: "OPT-DELAY", label: "Hold position — delay departure ops", summary: "Stay on current berth/pilotage hold until congestion clears.", advisory: false, feasible: false, checks: delayChecks, delayHrs: 20, costUsd: 210_000, risk: "medium", recoveryScore: 0, evidenceRefs: [], effects: { note: "No movement; commercial penalty applies" } }),
    ].map((o) => ({ ...o, evidenceRefs: refsFor(o.checks, ctx) }));
  } else {
    const slowChecks = [
      chk("c-slow-thermal", "JW temp at reduced load", "maintenance", "telemetry", true,
        facts.thermalAtSlowOk ? true : false, "JW temp projected ≤ 88 °C at 12 kn (policy limit 92 °C)."),
      chk("c-slow-rest", "Crew rest horizon", "crew", "crew", true,
        facts.restOk ? true : false, "MLC rest hours compliant for +50 h extension."),
      chk("c-slow-reefer", "Reefer power margin", "cargo", "cargo", false,
        facts.reeferMarginH >= 4 ? true : false, `Reefer margin ${facts.reeferMarginH} h ≥ 4 h minimum.`),
      chk("c-slow-slack", "Delivery window slack", "commercial", "cargo", true,
        facts.slackHrs >= 52 ? true : false, `Delivery slack ${facts.slackHrs} h vs required 52 h buffer at 12 kn.`),
    ];
    const colChecks = [
      chk("c-col-wave", "Corridor Hs within class limit", "safety", "weather", true,
        staleWeather ? null : facts.waveHs <= facts.waveLimit,
        staleWeather
          ? "Hs limit cannot be verified — weather feed STALE."
          : `Corridor B Hs ${facts.waveHs} m ≤ ${facts.waveLimit} m class limit.`),
      chk("c-col-draft", "Berth draft + UKC", "safety", "port", true,
        facts.colomboDraft >= facts.draftM + facts.ukcReq ? true : false,
        `Colombo A3 ${facts.colomboDraft.toFixed(1)} m vs required ${(facts.draftM + facts.ukcReq).toFixed(1)} m (UKC ${facts.ukcReq} m).`),
      chk("c-col-berth", "Berth availability window", "port", "port", false,
        facts.colomboBerth ? true : false, "Berth A3 available inside 12 h arrival window."),
      chk("c-col-rest", "Crew rest horizon", "crew", "crew", true,
        facts.restOk ? true : false, "MLC rest hours compliant for diversion + inspection."),
      chk("c-col-slack", "Delivery window slack", "commercial", "cargo", true,
        facts.slackHrs >= 30 ? true : false, `Delivery slack ${facts.slackHrs} h vs required 30 h buffer for diversion.`),
    ];
    const pbChecks = [
      chk("c-pb-draft", "Berth draft + UKC", "safety", "port", true,
        facts.portBDraft >= facts.draftM + facts.ukcReq ? true : false,
        `Belawan ${facts.portBDraft.toFixed(1)} m < required ${(facts.draftM + facts.ukcReq).toFixed(1)} m — hard block.`),
      chk("c-pb-rest", "Crew rest horizon", "crew", "crew", true, true, "MLC rest hours compliant."),
    ];
    const fullChecks = [
      chk("c-full-thermal", "JW temp at full load", "maintenance", "telemetry", true,
        facts.thermalAtFullOk ? true : false,
        "JW temp 96 °C exceeds 92 °C policy limit at full load — commercial saving ($180 k) overridden by safety constraint."),
      chk("c-full-slack", "Delivery window slack", "commercial", "cargo", false, true, "Slack sufficient at 18 kn."),
    ];
    options = [
      finalize({ id: "OPT-SLOW", label: "Slow-steaming — 12 kn, monitor cooling loop", summary: "Reduce load to hold temperature under limit; continue to Singapore with enhanced watch.", advisory: false, feasible: false, checks: slowChecks, delayHrs: 50, costUsd: 32_000, risk: "low", recoveryScore: 0, evidenceRefs: [], effects: { speedKn: 12, note: "Enhanced engine-room watch 4 h cycles" } }),
      finalize({ id: "OPT-COLOMBO", label: "Divert to Colombo — inspection at anchorage A3", summary: "Divert for 22 h inspection window; resume voyage on completion.", advisory: false, feasible: false, checks: colChecks, delayHrs: 29, costUsd: 145_000, risk: "low", recoveryScore: 0, evidenceRefs: [], effects: { destination: "Colombo (LKCMB)", eta: "+29 h", note: "Inspection at anchorage A3" } }),
      finalize({ id: "OPT-PORTB", label: "Divert to nearest — Belawan", summary: "Shortest-track diversion to Belawan for shore support.", advisory: false, feasible: false, checks: pbChecks, delayHrs: 18, costUsd: 96_000, risk: "medium", recoveryScore: 0, evidenceRefs: [], effects: { destination: "Belawan (IDBLW)", note: "Draft-limited port" } }),
      finalize({ id: "OPT-FULL", label: "Maintain 18 kn — defer inspection to arrival", summary: "No operational change; inspection deferred to Singapore.", advisory: false, feasible: false, checks: fullChecks, delayHrs: 0, costUsd: 12_000, risk: "high", recoveryScore: 0, evidenceRefs: [], effects: { note: "Deferred inspection on arrival" } }),
    ].map((o) => ({ ...o, evidenceRefs: refsFor(o.checks, ctx) }));

    if (includeAdvisory) {
      const a1Checks = [
        chk("c-a1-thermal", "JW temp at 14 kn derate", "maintenance", "telemetry", true, true, "Staged derating holds ≤ 90 °C per model (synthetic advisory)."),
        chk("c-a1-wave", "Corridor Hs within class limit", "safety", "weather", true,
          staleWeather ? null : facts.waveHs <= facts.waveLimit,
          staleWeather ? "Hs limit cannot be verified — weather feed STALE." : `Corridor Hs ${facts.waveHs} m ≤ ${facts.waveLimit} m.`),
        chk("c-a1-draft", "Berth draft + UKC", "safety", "port", true,
          facts.colomboDraft >= facts.draftM + facts.ukcReq ? true : false,
          `Colombo A3 ${facts.colomboDraft.toFixed(1)} m ≥ required ${(facts.draftM + facts.ukcReq).toFixed(1)} m.`),
        chk("c-a1-rest", "Crew rest horizon", "crew", "crew", true, true, "Rest compliant with day-4 inspection window."),
        chk("c-a1-slack", "Delivery window slack", "commercial", "cargo", true,
          facts.slackHrs >= 36 ? true : false, `Delivery slack ${facts.slackHrs} h ≥ 36 h buffer.`),
      ];
      const a1 = finalize({ id: "OPT-A1", label: "Staged derating 14 kn + Colombo inspection (day 4)", summary: "Advisory-suggested hybrid: partial derate now, inspection window in Colombo on day 4.", advisory: true, feasible: false, checks: a1Checks, delayHrs: 34, costUsd: 118_000, risk: "low", recoveryScore: 0, evidenceRefs: [], effects: { destination: "Colombo (LKCMB)", speedKn: 14, note: "Inspection window day 4" } });
      options = [...options, { ...a1, evidenceRefs: refsFor(a1Checks, ctx) }];
    }
  }

  // 3) all candidates infeasible with fully-determined evidence → abstain (GS-03)
  const anyFeasible = options.some((o) => o.feasible);
  if (options.length > 0 && !anyFeasible) {
    return {
      options,
      commercialBlocked,
      abstain: {
        at: now, code: "NO_FEASIBLE_OPTION",
        reason: "No candidate satisfies all deterministic constraints. System declines to recommend; manual planning engaged.",
        manualFallback: true,
        missingSources: [],
      },
    };
  }

  return { options, abstain: null, commercialBlocked };
}
