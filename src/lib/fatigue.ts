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
        "FEM not completed. This must be completed before the fatigue event can be processed. Calculation is blocked.",
      errors,
      scenarioId: rule.id,
      scenarioTitle: rule.title,
      eventNumber: "--",
      payHours: "--",
      status: "BLOCKED",
      notes: "Complete the Fatigue Event Management report, then re-run the calculation.",
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
