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

export const FATIGUE_RULES: FatigueRule[] = [
  /* ---------------- Prior sign-in — can rejoin the sequence ---------------- */
  {
    id: "PRIOR-REJOIN-YES",
    label: "Prior sign-in · can rejoin sequence",
    when: { priorSignIn: true, rejoinSequence: true },
    entries: ["MODIFY_SEQUENCE", "INPUT_ABSENCE"],
    steps: [1, 2],
  },
  {
    id: "PRIOR-REJOIN-YES-RSVF-RAP",
    label: "RSV Flying · can rejoin · RAP answered",
    when: { priorSignIn: true, rejoinSequence: true, bidStatus: "RSV_FLYING" },
    requires: [
      { field: "rapStarted", message: "Answer “RAP Started” to complete the entries." },
    ],
  },
  {
    id: "PRIOR-REJOIN-YES-RSVF-RAP-STARTED",
    label: "RSV Flying · can rejoin · RAP started",
    when: {
      priorSignIn: true,
      rejoinSequence: true,
      bidStatus: "RSV_FLYING",
      rapStarted: true,
    },
    entries: ["MODIFY_RAP"],
  },
  {
    id: "PRIOR-REJOIN-YES-RSVF-RAP-NOT-STARTED",
    label: "RSV Flying · can rejoin · RAP not started",
    when: {
      priorSignIn: true,
      rejoinSequence: true,
      bidStatus: "RSV_FLYING",
      rapStarted: false,
    },
    entries: ["REMOVE_RAP"],
  },

  /* -------------- Prior sign-in — cannot rejoin the sequence -------------- */
  {
    id: "PRIOR-REJOIN-NO",
    label: "Prior sign-in · cannot rejoin sequence",
    when: { priorSignIn: true, rejoinSequence: false },
    entries: ["REMOVE_SEQUENCE", "INPUT_ABSENCE"],
    steps: [1, 3],
    requires: [
      { field: "recoveryFlying", message: "Answer “Recovery Flying” to complete the steps." },
    ],
  },
  {
    id: "PRIOR-REJOIN-NO-RSVF",
    label: "RSV Flying · cannot rejoin · assign RAP",
    when: { priorSignIn: true, rejoinSequence: false, bidStatus: "RSV_FLYING" },
    entries: ["ASSIGN_RAP"],
    notes: ["Assign a RAP — if Long Call, it may be converted to Short Call."],
  },
  {
    id: "PRIOR-REJOIN-NO-RECOVERY-YES",
    label: "Cannot rejoin · recovery flying available",
    when: { priorSignIn: true, rejoinSequence: false, recoveryFlying: true },
    entries: ["ASSIGN_SEQUENCE"],
    steps: [6, 2],
  },
  {
    id: "PRIOR-REJOIN-NO-RECOVERY-NO",
    label: "Cannot rejoin · no recovery flying",
    when: { priorSignIn: true, rejoinSequence: false, recoveryFlying: false },
    steps: [5],
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
