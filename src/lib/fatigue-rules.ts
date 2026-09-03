/**
 * Fatigue rules database.
 *
 * Every scenario is expressed as a declarative rule row using the template
 * below. Rules are evaluated in order; every rule whose `when` clause matches
 * the current answers contributes its entries, steps and notes to the plan.
 * To add or change a scenario, edit this table only — no UI or engine change.
 *
 * RULE TEMPLATE
 * -------------
 * {
 *   id:    "UNIQUE-ID",                 // stable identifier
 *   label: "Human readable scenario",   // shown in tooling / debugging
 *   when: {                             // all listed keys must match
 *     bidStatus?:      BidStatus,       // LINE_HOLDER | RSV_PR_OG | RSV_FLYING
 *     priorSignIn?:    boolean,         // fatigue call before sign-in
 *     rejoinSequence?: boolean,         // pilot can rejoin the sequence
 *     rapStarted?:     boolean,         // RSV Flying only
 *     recoveryFlying?: boolean,         // answer to step 4
 *   },
 *   requires?: [{ field, message }],    // unanswered inputs block the plan
 *   entries: EntryKey[],                // appended in order
 *   steps:   number[],                  // appended in order
 *   notes?:  string[],
 * }
 */

import type { BidStatus, EntryKey } from "./fatigue";

export type RuleField =
  | "priorSignIn"
  | "rejoinSequence"
  | "rapStarted"
  | "recoveryFlying";

export interface RuleWhen {
  bidStatus?: BidStatus;
  priorSignIn?: boolean;
  rejoinSequence?: boolean;
  rapStarted?: boolean;
  recoveryFlying?: boolean;
}

export interface RuleRequirement {
  field: RuleField;
  message: string;
}

export interface FatigueRule {
  id: string;
  label: string;
  when: RuleWhen;
  requires?: RuleRequirement[];
  entries?: EntryKey[];
  steps?: number[];
  notes?: string[];
}

/** Answers the rule engine matches against. */
export interface RuleFacts {
  bidStatus: BidStatus;
  priorSignIn: boolean | null;
  rejoinSequence: boolean | null;
  rapStarted: boolean | null;
  recoveryFlying: boolean | null;
}

const ASSIGN_RAP_NOTE =
  "Command: HYR/EMP#/FDT//RAP TIME — if Long Call, it may be converted to Short Call.";
const RSV_OG_PR_NOTE =
  "RSV on OG/PR: Recovery Flying may only be assigned on RSV days.";

export const FATIGUE_RULES: FatigueRule[] = [
  /* ================================================================== */
  /* PRIOR SIGN-IN — Line Holder / RSV on PR-OG                          */
  /* ================================================================== */
  {
    id: "PRIOR-REJOIN-YES-LH",
    label: "Line Holder · prior sign-in · can rejoin",
    when: { bidStatus: "LINE_HOLDER", priorSignIn: true, rejoinSequence: true },
    entries: ["MODIFY_SEQUENCE", "INPUT_ABSENCE"],
    steps: [1, 2],
  },
  {
    id: "PRIOR-REJOIN-YES-RSVPOG",
    label: "RSV PR-OG · prior sign-in · can rejoin",
    when: { bidStatus: "RSV_PR_OG", priorSignIn: true, rejoinSequence: true },
    entries: ["MODIFY_SEQUENCE", "INPUT_ABSENCE"],
    steps: [1, 2],
    notes: [RSV_OG_PR_NOTE],
  },
  {
    id: "PRIOR-REJOIN-NO-LH",
    label: "Line Holder · prior sign-in · cannot rejoin",
    when: { bidStatus: "LINE_HOLDER", priorSignIn: true, rejoinSequence: false },
    entries: ["REMOVE_SEQUENCE", "INPUT_ABSENCE"],
    steps: [1, 3],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
  },
  {
    id: "PRIOR-REJOIN-NO-RSVPOG",
    label: "RSV PR-OG · prior sign-in · cannot rejoin",
    when: { bidStatus: "RSV_PR_OG", priorSignIn: true, rejoinSequence: false },
    entries: ["REMOVE_SEQUENCE", "INPUT_ABSENCE"],
    steps: [1, 3],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
    notes: [RSV_OG_PR_NOTE],
  },
  {
    id: "PRIOR-REJOIN-NO-RECOVERY-YES",
    label: "Prior sign-in · cannot rejoin · recovery flying",
    when: { priorSignIn: true, rejoinSequence: false, recoveryFlying: true },
    steps: [6, 2],
  },
  {
    id: "PRIOR-REJOIN-NO-RECOVERY-NO",
    label: "Prior sign-in · cannot rejoin · no recovery flying",
    when: { priorSignIn: true, rejoinSequence: false, recoveryFlying: false },
    steps: [5],
  },

  /* ================================================================== */
  /* PRIOR SIGN-IN — RSV Flying                                          */
  /* ================================================================== */
  {
    id: "RSVF-PRIOR-REJOIN-YES",
    label: "RSV Flying · prior sign-in · can rejoin",
    when: { bidStatus: "RSV_FLYING", priorSignIn: true, rejoinSequence: true },
    entries: ["MODIFY_SEQUENCE", "SET_ABSENCE"],
    requires: [
      { field: "rapStarted", message: "Answer “RAP Started” to complete the entries." },
    ],
  },
  {
    id: "RSVF-PRIOR-REJOIN-YES-RAP-STARTED",
    label: "RSV Flying · prior · can rejoin · RAP started",
    when: {
      bidStatus: "RSV_FLYING",
      priorSignIn: true,
      rejoinSequence: true,
      rapStarted: true,
    },
    entries: ["MODIFY_RAP"],
  },
  {
    id: "RSVF-PRIOR-REJOIN-YES-RAP-NOT-STARTED",
    label: "RSV Flying · prior · can rejoin · RAP not started",
    when: {
      bidStatus: "RSV_FLYING",
      priorSignIn: true,
      rejoinSequence: true,
      rapStarted: false,
    },
    entries: ["REMOVE_RAP"],
  },
  {
    id: "RSVF-PRIOR-REJOIN-NO",
    label: "RSV Flying · prior sign-in · cannot rejoin",
    when: { bidStatus: "RSV_FLYING", priorSignIn: true, rejoinSequence: false },
    entries: ["REMOVE_SEQUENCE", "SET_ABSENCE", "ASSIGN_RAP"],
    steps: [7],
    notes: [ASSIGN_RAP_NOTE],
  },

  /* ================================================================== */
  /* AFTER SIGN-IN — Line Holder / RSV on PR-OG                          */
  /* ================================================================== */
  {
    id: "AFTER-REJOIN-YES-LH",
    label: "Line Holder · after sign-in · can rejoin",
    when: { bidStatus: "LINE_HOLDER", priorSignIn: false, rejoinSequence: true },
    entries: ["MODIFY_SEQUENCE", "REPORT_SEQUENCE", "FATIGUE_LEG", "ABSENCE"],
    steps: [9, 3],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
  },
  {
    id: "AFTER-REJOIN-YES-RSVPOG",
    label: "RSV PR-OG · after sign-in · can rejoin",
    when: { bidStatus: "RSV_PR_OG", priorSignIn: false, rejoinSequence: true },
    entries: ["MODIFY_SEQUENCE", "REPORT_SEQUENCE", "FATIGUE_LEG", "ABSENCE"],
    steps: [9, 3],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
    notes: [RSV_OG_PR_NOTE],
  },
  {
    id: "AFTER-REJOIN-YES-RECOVERY-YES",
    label: "After sign-in · can rejoin · recovery flying",
    when: { priorSignIn: false, rejoinSequence: true, recoveryFlying: true },
    steps: [6, 2],
  },
  {
    id: "AFTER-REJOIN-YES-RECOVERY-NO",
    label: "After sign-in · can rejoin · no recovery flying",
    when: { priorSignIn: false, rejoinSequence: true, recoveryFlying: false },
    steps: [1, 2],
  },
  {
    id: "AFTER-REJOIN-NO-LH",
    label: "Line Holder · after sign-in · cannot rejoin",
    when: { bidStatus: "LINE_HOLDER", priorSignIn: false, rejoinSequence: false },
    entries: ["REMOVE_SEQUENCE", "BUILT_REPORT_SEQUENCE", "REPORT_SEQUENCE", "ABSENCE"],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
  },
  {
    id: "AFTER-REJOIN-NO-RSVPOG",
    label: "RSV PR-OG · after sign-in · cannot rejoin",
    when: { bidStatus: "RSV_PR_OG", priorSignIn: false, rejoinSequence: false },
    entries: ["REMOVE_SEQUENCE", "BUILT_REPORT_SEQUENCE", "REPORT_SEQUENCE", "ABSENCE"],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
    notes: [RSV_OG_PR_NOTE],
  },
  {
    id: "AFTER-REJOIN-NO-RECOVERY-YES",
    label: "After sign-in · cannot rejoin · recovery flying",
    when: { priorSignIn: false, rejoinSequence: false, recoveryFlying: true },
    steps: [6, 2],
  },
  {
    id: "AFTER-REJOIN-NO-RECOVERY-NO",
    label: "After sign-in · cannot rejoin · no recovery flying",
    when: { priorSignIn: false, rejoinSequence: false, recoveryFlying: false },
    steps: [1, 2],
  },

  /* ================================================================== */
  /* AFTER SIGN-IN — RSV Flying                                          */
  /* ================================================================== */
  {
    id: "RSVF-AFTER",
    label: "RSV Flying · after sign-in",
    when: { bidStatus: "RSV_FLYING", priorSignIn: false },
    entries: [
      "REMOVE_SEQUENCE",
      "BUILT_REPORT_SEQUENCE",
      "REPORT_SEQUENCE",
      "FATIGUE_LEG",
      "ABSENCE",
      "ASSIGN_RAP",
    ],
    steps: [11, 12, 7],
    notes: [ASSIGN_RAP_NOTE],
    requires: [
      { field: "rapStarted", message: "Answer “RAP Started” to complete the entries." },
    ],
  },
  {
    id: "RSVF-AFTER-RAP-STARTED",
    label: "RSV Flying · after sign-in · RAP started",
    when: { bidStatus: "RSV_FLYING", priorSignIn: false, rapStarted: true },
    entries: ["SHORTEN_RAP"],
    steps: [13],
  },
  {
    id: "RSVF-AFTER-RAP-NOT-STARTED",
    label: "RSV Flying · after sign-in · RAP not started",
    when: { bidStatus: "RSV_FLYING", priorSignIn: false, rapStarted: false },
    entries: ["REMOVE_RAP"],
  },
];

function matches(when: RuleWhen, facts: RuleFacts): boolean {
  return (Object.keys(when) as (keyof RuleWhen)[]).every(
    (key) => when[key] === facts[key],
  );
}

/** All rules whose conditions match the current answers, in table order. */
export function matchRules(facts: RuleFacts): FatigueRule[] {
  return FATIGUE_RULES.filter((rule) => matches(rule.when, facts));
}
