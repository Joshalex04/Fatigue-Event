import { matchRules, type RuleFacts } from "./fatigue-rules";
/**

 * Fatigue Event calculation engine.
 *
 * All airline-specific rules live in the RULES table below so the scenario
 * matching and required entries can be swapped for the official steps
 * without touching the UI.
 */

export type BidStatus = "LINE_HOLDER" | "RSV_PR_OG" | "RSV_FLYING";

export const BID_STATUS_OPTIONS: { value: BidStatus; label: string }[] = [
  { value: "LINE_HOLDER", label: "Line Holder" },
  { value: "RSV_PR_OG", label: "RSV on PR-OG" },
  { value: "RSV_FLYING", label: "RSV Flying" },
];

/** Optional conditions the crew scheduler can toggle; each adds a required entry. */
export type ConditionId =
  | "HOTEL_NEEDED"
  | "DEADHEAD"
  | "TRIP_REMOVED"
  | "SICK_CALL_FOLLOW"
  | "INTL_SEGMENT"
  | "CREW_REPLACED";

export const CONDITION_OPTIONS: {
  id: ConditionId;
  label: string;
  hint: string;
  code: string;
  value: string;
  tone: "normal" | "warn";
}[] = [
  {
    id: "HOTEL_NEEDED",
    label: "Hotel / rest facility required",
    hint: "Crew member cannot commute home before rest.",
    code: "HTL-REQ",
    value: "BOOK HOTEL",
    tone: "normal",
  },
  {
    id: "DEADHEAD",
    label: "Deadhead back to base",
    hint: "Positioning segment required after the fatigue call.",
    code: "DH-BASE",
    value: "ADD DH SEGMENT",
    tone: "normal",
  },
  {
    id: "TRIP_REMOVED",
    label: "Remaining trip removed",
    hint: "Balance of the sequence is pulled from the line.",
    code: "TRP-RMV",
    value: "REMOVE REMAINDER",
    tone: "normal",
  },
  {
    id: "SICK_CALL_FOLLOW",
    label: "Converted / follows a sick call",
    hint: "Fatigue call linked to an existing sick event.",
    code: "SK-LINK",
    value: "LINK SICK EVENT",
    tone: "warn",
  },
  {
    id: "INTL_SEGMENT",
    label: "International segment involved",
    hint: "Augmented / international rules apply.",
    code: "INTL-FLG",
    value: "INTL REVIEW",
    tone: "normal",
  },
  {
    id: "CREW_REPLACED",
    label: "Crew replacement assigned",
    hint: "A reserve was assigned to cover the open position.",
    code: "CRW-RPL",
    value: "ASSIGN COVER",
    tone: "normal",
  },
];

export interface FatigueInput {
  bidStatus: BidStatus;
  /** hhmm */
  timeOfFatigue: string;
  /** hhmm */
  signInTime: string;
  /** ddmm */
  backForDutyDate: string;
  /** hhmm */
  backForDutyTime: string;
  femCompleted: boolean;
  /** Toggled conditions that add their own required entries. */
  conditions?: ConditionId[];
}


export interface EntryLine {
  code: string;
  value: string;
  tone: "normal" | "warn";
}

export interface FatigueResult {
  blocked: boolean;
  blockReason?: string;
  errors: string[];
  scenarioId: string;
  scenarioTitle: string;
  eventNumber: string;
  payHours: string;
  status: "CLEAR" | "HOLD" | "BLOCKED";
  notes: string;
  entries: EntryLine[];
}

const HHMM = /^([01]\d|2[0-3])[0-5]\d$/;
const DDMM = /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])$/;

export function parseHhmm(value: string): number | null {
  if (!HHMM.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(2));
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Minutes from sign-in to the fatigue call, rolling past midnight. */
export function dutyElapsed(signIn: number, fatigue: number): number {
  return fatigue >= signIn ? fatigue - signIn : fatigue + 1440 - signIn;
}

interface Rule {
  id: string;
  title: string;
  eventNumber: string;
  /** Minimum rest floor applied before crew is back for duty, in minutes. */
  restFloor: number;
  /** How pay is derived for this bid status. */
  pay: (elapsed: number) => number;
  entryCodes: string[];
}

const RULES: Record<BidStatus, Rule> = {
  LINE_HOLDER: {
    id: "SCENARIO 1",
    title: "Line Holder Fatigue",
    eventNumber: "12",
    restFloor: 10 * 60,
    // Line holder is credited the duty already flown at the fatigue call.
    pay: (elapsed) => elapsed,
    entryCodes: ["FAT-EVT", "PAY", "SCHED-HOLD"],
  },
  RSV_PR_OG: {
    id: "SCENARIO 2",
    title: "RSV PR-OG Fatigue",
    eventNumber: "14",
    restFloor: 10 * 60,
    // Reserve on PR/OG is credited elapsed duty with a minimum guarantee.
    pay: (elapsed) => Math.max(elapsed, 60),
    entryCodes: ["FAT-EVT", "PAY", "SCHED-HOLD"],
  },
  RSV_FLYING: {
    id: "SCENARIO 3",
    title: "Reserve on RSV Flying Fatigue",
    eventNumber: "16",
    restFloor: 12 * 60,
    // Reserve flying carries the reserve daily guarantee floor.
    pay: (elapsed) => Math.max(elapsed, 4 * 60 + 15),
    entryCodes: ["FAT-EVT", "PAY", "RSV-REL", "SCHED-HOLD"],
  },
};

export function calculateFatigue(input: FatigueInput): FatigueResult {
  const errors: string[] = [];
  const signIn = parseHhmm(input.signInTime);
  const fatigue = parseHhmm(input.timeOfFatigue);
  const backTime = parseHhmm(input.backForDutyTime);

  if (signIn === null) errors.push("Sign-in time must be a valid hhmm value.");
  if (fatigue === null) errors.push("Time of fatigue must be a valid hhmm value.");
  if (backTime === null) errors.push("Back for duty time must be a valid hhmm value.");
  if (!DDMM.test(input.backForDutyDate))
    errors.push("Back for duty date must be a valid ddmm value.");

  const rule = RULES[input.bidStatus];

  if (!input.femCompleted) {
    return {
      blocked: true,
      blockReason:
        "FEM not completed. This must be completed before the fatigue event can be processed.",
      errors,
      scenarioId: rule.id,
      scenarioTitle: rule.title,
      eventNumber: "--",
      payHours: "--",
      status: "BLOCKED",
      notes: "Complete the Fatigue Event Management report, then re-run.",
      entries: [{ code: "FEM-REQ", value: "PENDING", tone: "warn" }],
    };
  }

  if (errors.length > 0 || signIn === null || fatigue === null || backTime === null) {
    return {
      blocked: true,
      blockReason: "Correct the highlighted input fields to run the calculation.",
      errors,
      scenarioId: rule.id,
      scenarioTitle: rule.title,
      eventNumber: "--",
      payHours: "--",
      status: "BLOCKED",
      notes: "",
      entries: [],
    };
  }

  const elapsed = dutyElapsed(signIn, fatigue);
  const payMinutes = elapsed;
  const restAvailable = dutyElapsed(fatigue, backTime);
  const restShort = restAvailable < rule.restFloor;

  const entries: EntryLine[] = [
    { code: "FAT-EVT", value: input.timeOfFatigue, tone: "normal" },
    { code: `PAY-${formatMinutes(payMinutes).replace(":", "")}`, value: formatMinutes(payMinutes), tone: "normal" },
  ];

  if (rule.entryCodes.includes("RSV-REL")) {
    entries.push({ code: "RSV-REL", value: input.signInTime, tone: "normal" });
  }

  entries.push({
    code: "SCHED-HOLD",
    value: `${input.backForDutyDate} · ${input.backForDutyTime}`,
    tone: "normal",
  });

  if (restShort) {
    entries.push({
      code: "REST-SHORT",
      value: `MIN ${formatMinutes(rule.restFloor)}`,
      tone: "warn",
    });
  }

  // Each toggled condition contributes its required entry.
  for (const option of CONDITION_OPTIONS) {
    if (input.conditions?.includes(option.id)) {
      entries.push({ code: option.code, value: option.value, tone: option.tone });
    }
  }

  return {
    blocked: false,
    errors: [],
    scenarioId: rule.id,
    scenarioTitle: rule.title,
    eventNumber: rule.eventNumber,
    payHours: formatMinutes(payMinutes),
    status: restShort ? "HOLD" : "CLEAR",
    notes: restShort
      ? `Rest to back-for-duty is ${formatMinutes(restAvailable)} against a ${formatMinutes(rule.restFloor)} floor — hold the crew member until the floor is met.`
      : `Duty elapsed ${formatMinutes(elapsed)}. Rest to back-for-duty ${formatMinutes(restAvailable)} meets the ${formatMinutes(rule.restFloor)} floor.`,
    entries,
  };
}

export function entriesToText(result: FatigueResult): string {
  return result.entries.map((e, i) => `${i + 1}. ${e.code}  ${e.value}`).join("\n");
}

/* ------------------------------------------------------------------ */
/* Entries & Steps engine                                              */
/* ------------------------------------------------------------------ */

export type EntryKey =
  | "REMOVE_SEQUENCE"
  | "INPUT_ABSENCE"
  | "MODIFY_SEQUENCE"
  | "MODIFY_RAP"
  | "REMOVE_RAP"
  | "SET_ABSENCE"
  | "ASSIGN_RAP"
  | "ASSIGN_SEQUENCE";

/*
 * Entry legends:
 *  EMP#   employee number
 *  SEQNUM sequence number
 *  DT     sequence date (DD)
 *  FDT    event date (DDMM)
 *  TDT    back-for-duty date (DDMM)
 *  STM    start time (HHMM)
 *  FTM    time of fatigue + 1 minute (HHMM)
 *  TTM    back-for-duty time (HHMM)
 */
export const ENTRY_DEFS: Record<EntryKey, { label: string; template: string }> = {
  REMOVE_SEQUENCE: { label: "Remove Sequence", template: "2G/EMP#/SEQNUM/DT/FT" },
  INPUT_ABSENCE: { label: "Input Absence", template: "A4/EMP#/FT/FDT/TDT//FTM/TTM" },
  MODIFY_SEQUENCE: { label: "Modify Sequence", template: "HE/SEQ/DT/25/MI" },
  MODIFY_RAP: { label: "Modify RAP", template: "HYR(V)/EMP#/START DT/END DT//START TIME/END TIME" },
  REMOVE_RAP: { label: "Remove RAP", template: "HYR(V)/EMP#/DATE//R" },
  SET_ABSENCE: { label: "Set Absence", template: "A4/EMP#/FT/DT/TDT///TTM" },
  ASSIGN_RAP: { label: "Assign RAP", template: "HYR/EMP#/DATE//RAP TIME" },
  ASSIGN_SEQUENCE: { label: "Assign Sequence", template: "HU/EMP#/SEQ#/DATE/FT" },
};

export const CSS_CALENDAR_URL = "https://css.aa.com/cme/calendarview";

export const STEP_TEXTS: Record<number, string> = {
  1: `Go to ${CSS_CALENDAR_URL} — click on RFW.`,
  2: "Select I'm Done.",
  3: "Click on the Fatigue Red Puck, open Sequence Look.",
  4: "",
  5: "Click on RFW, and select I am Done.",
  6: "Assign best Solution. HU/EMP#/SEQ#/DATE/FT.",
  7: "Assign a RAP (entry: Assign RAP).",
  8: "If Long Call RSV, it may be converted to Short Call.",
};

const MONTHS3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** ddmm -> DDMMM (e.g. 0109 -> 01SEP). Returns null for invalid input. */
export function ddmmToDdMmm(ddmm: string): string | null {
  if (!DDMM.test(ddmm)) return null;
  return `${ddmm.slice(0, 2)}${MONTHS3[Number(ddmm.slice(2)) - 1]}`;
}

export interface PlanInput {
  bidStatus: BidStatus;
  /** Time of fatigue before sign-in time. */
  priorSignIn: boolean | null;
  rejoinSequence: boolean | null;
  rapStarted: boolean | null;
  recoveryFlying: boolean | null;
  employeeNumber: string;
  sequenceNumber: string;
  /** ddmm */
  sequenceDate: string;
  /** ddmm */
  eventDate: string;
  /** hhmm */
  timeOfFatigue: string;
  /** hhmm */
  signInTime: string;
  /** ddmm */
  backForDutyDate: string;
  /** hhmm */
  backForDutyTime: string;
}

export interface PlanEntry {
  key: EntryKey;
  label: string;
  code: string;
}

export interface PlanStep {
  n: number;
  text: string;
}

export interface EntriesPlan {
  ready: boolean;
  pending: string[];
  entries: PlanEntry[];
  steps: PlanStep[];
  notes: string[];
}

/** hhmm + 1 minute, rolling past midnight. Returns null for invalid input. */
function plusOneMinute(hhmm: string): string | null {
  const mins = parseHhmm(hhmm);
  if (mins === null) return null;
  const next = (mins + 1) % 1440;
  return `${String(Math.floor(next / 60)).padStart(2, "0")}${String(next % 60).padStart(2, "0")}`;
}

function fillTemplate(key: EntryKey, input: PlanInput): string {
  const emp = input.employeeNumber.trim() || "EMP#";
  const seq = input.sequenceNumber.trim() || "SEQNUM";
  // DT: sequence date as DD
  const dt = DDMM.test(input.sequenceDate) ? input.sequenceDate.slice(0, 2) : "DT";
  // FDT: event date as DDMMM
  const fdt = ddmmToDdMmm(input.eventDate) ?? "FDT";
  // TDT: back-for-duty date as DDMMM
  const tdt = ddmmToDdMmm(input.backForDutyDate) ?? "TDT";
  // FTM: time of fatigue + 1 minute
  const ftm = plusOneMinute(input.timeOfFatigue) ?? "FTM";
  // TTM: back-for-duty time
  const ttm = parseHhmm(input.backForDutyTime) !== null ? input.backForDutyTime : "TTM";
  // STM: start (sign-in) time
  const stm = parseHhmm(input.signInTime) !== null ? input.signInTime : "STM";
  switch (key) {
    case "REMOVE_SEQUENCE":
      return `2G/${emp}/${seq}/${dt}/FT`;
    case "INPUT_ABSENCE":
      return `A4/${emp}/FT/${fdt}/${tdt}//${ftm}/${ttm}`;
    case "MODIFY_SEQUENCE":
      return `HE/${seq}/${dt}/25/MI`;
    case "MODIFY_RAP":
      return `HYR(V)/${emp}/${dt}/${dt}//${stm}/END TIME`;
    case "REMOVE_RAP":
      return `HYR(V)/${emp}/${fdt}//R`;
    case "SET_ABSENCE":
      return `A4/${emp}/FT/${dt}/${tdt}///${ttm}`;
    case "ASSIGN_RAP":
      return `HYR/${emp}/${fdt}//RAP TIME`;
    case "ASSIGN_SEQUENCE":
      return `HU/${emp}/${seq}/${fdt}/FT`;
  }
}

function entry(key: EntryKey, input: PlanInput): PlanEntry {
  return { key, label: ENTRY_DEFS[key].label, code: fillTemplate(key, input) };
}

function stepsOf(nums: number[]): PlanStep[] {
  return nums.map((n) => ({ n, text: STEP_TEXTS[n] ?? "" }));
}

/** Build the labeled entries and ordered steps from the rules database. */
export function buildEntriesPlan(input: PlanInput): EntriesPlan {
  const pending: string[] = [];
  const notes: string[] = [];
  const entries: PlanEntry[] = [];
  const stepNums: number[] = [];

  if (input.priorSignIn === null) {
    pending.push("Enter a valid sign-in time and time of fatigue.");
    return { ready: false, pending, entries, steps: [], notes };
  }
  if (!input.priorSignIn) {
    pending.push("After sign-in scenario steps are not defined yet — prior sign-in rules shown only.");
    return { ready: false, pending, entries, steps: [], notes };
  }
  if (input.rejoinSequence === null) {
    pending.push("Answer “Can Rejoin Sequence?” to generate the entries and steps.");
    return { ready: false, pending, entries, steps: [], notes };
  }

  const facts: RuleFacts = {
    bidStatus: input.bidStatus,
    priorSignIn: input.priorSignIn,
    rejoinSequence: input.rejoinSequence,
    rapStarted: input.rapStarted,
    recoveryFlying: input.recoveryFlying,
  };

  for (const rule of matchRules(facts)) {
    for (const req of rule.requires ?? []) {
      if (facts[req.field] === null && !pending.includes(req.message)) {
        pending.push(req.message);
      }
    }
    for (const key of rule.entries ?? []) {
      if (!entries.some((e) => e.key === key)) entries.push(entry(key, input));
    }
    for (const n of rule.steps ?? []) stepNums.push(n);
    for (const note of rule.notes ?? []) notes.push(note);
  }

  return { ready: pending.length === 0, pending, entries, steps: stepsOf(stepNums), notes };
}


export function planToText(plan: EntriesPlan): string {
  const lines: string[] = ["ENTRIES"];
  plan.entries.forEach((e, i) => lines.push(`${i + 1}. ${e.label}: ${e.code}`));
  if (plan.steps.length > 0) {
    lines.push("", "STEPS");
    plan.steps.forEach((s) => lines.push(`${s.n}. ${s.text}`));
  }
  plan.notes.forEach((n) => lines.push("", `NOTE: ${n}`));
  return lines.join("\n");
}
