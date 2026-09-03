import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buildEntriesPlan, planToText, type BidStatus } from "@/lib/fatigue";

const yesNo = z
  .boolean()
  .nullish()
  .transform((v) => (v === undefined ? null : v));

export default defineTool({
  name: "build_entries_plan",
  title: "Build entries and steps",
  description:
    "Generate the ordered CSS entry codes (with labels) and the numbered scheduler steps for a fatigue event, based on bid status, rejoin/RAP/recovery answers and the event details.",
  inputSchema: {
    bidStatus: z.enum(["LINE_HOLDER", "RSV_PR_OG", "RSV_FLYING"]),
    rejoinSequence: yesNo.describe("Can the pilot rejoin the sequence? true/false, null if unknown."),
    rapStarted: yesNo.describe("RAP started? Reserve Flying only."),
    recoveryFlying: yesNo.describe("Recovery flying? true/false, null if unknown."),
    employeeNumber: z.string().default("").describe("Pilot employee number."),
    sequenceNumber: z.string().default("").describe("Sequence number (digits)."),
    sequenceDate: z.string().regex(/^\d{4}$/).describe("Sequence date, DDMM."),
    eventDate: z.string().regex(/^\d{4}$/).describe("Event date (fatigue call date), DDMM."),
    timeOfFatigue: z.string().regex(/^\d{4}$/).describe("Time of fatigue, HHMM."),
    signInTime: z.string().regex(/^\d{4}$/).describe("Sign-in time, HHMM."),
    signInDate: z.string().regex(/^\d{4}$/).optional().describe("Sign-in date, DDMM."),
    backForDutyDate: z.string().regex(/^\d{4}$/).describe("Back-for-duty date, DDMM."),
    backForDutyTime: z.string().regex(/^\d{4}$/).describe("Back-for-duty time, HHMM."),
    airportBase: z.string().optional().describe("Airport base, e.g. MIA."),
    equipment: z.string().optional().describe("Equipment, e.g. 737."),
  },
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const si = Number(input.signInTime.slice(0, 2)) * 60 + Number(input.signInTime.slice(2));
    const tf = Number(input.timeOfFatigue.slice(0, 2)) * 60 + Number(input.timeOfFatigue.slice(2));
    const plan = buildEntriesPlan({
      bidStatus: input.bidStatus as BidStatus,
      priorSignIn: tf < si,
      rejoinSequence: input.rejoinSequence ?? null,
      rapStarted: input.rapStarted ?? null,
      recoveryFlying: input.recoveryFlying ?? null,
      employeeNumber: input.employeeNumber,
      sequenceNumber: input.sequenceNumber,
       sequenceDate: input.sequenceDate,
       eventDate: input.eventDate,
       timeOfFatigue: input.timeOfFatigue,
       signInTime: input.signInTime,
       signInDate: input.signInDate,
       backForDutyDate: input.backForDutyDate,
       backForDutyTime: input.backForDutyTime,
      ...(input.airportBase ? { airportBase: input.airportBase } : {}),
      ...(input.equipment ? { equipment: input.equipment } : {}),
    });
    return {
      content: [{ type: "text", text: plan.ready ? planToText(plan) : plan.pending.join("\n") }],
      structuredContent: { plan },
    };
  },
});
