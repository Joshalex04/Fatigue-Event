import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { calculateFatigue, type BidStatus, type ConditionId } from "@/lib/fatigue";

const bidStatus = z
  .enum(["LINE_HOLDER", "RSV_PR_OG", "RSV_FLYING"])
  .describe("Pilot bid status: Line Holder, Reserve on PR/OG, or Reserve Flying.");

export default defineTool({
  name: "calculate_fatigue_event",
  title: "Calculate fatigue event",
  description:
    "Compute duty time, fatigue hours, pay hours and CLEAR/HOLD status for a pilot fatigue event from sign-in time, time of fatigue and back-for-duty date/time.",
  inputSchema: {
    bidStatus,
    timeOfFatigue: z.string().regex(/^\d{4}$/).describe("Time of fatigue call, HHMM military."),
    signInTime: z.string().regex(/^\d{4}$/).describe("Sign-in time, HHMM military."),
    backForDutyDate: z.string().regex(/^\d{4}$/).describe("Back-for-duty date, DDMM."),
    backForDutyTime: z.string().regex(/^\d{4}$/).describe("Back-for-duty time, HHMM military."),
    femCompleted: z.boolean().describe("Whether the FEM has been completed."),
    conditions: z
      .array(z.string())
      .optional()
      .describe("Optional condition ids that add required entries."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const result = calculateFatigue({
      bidStatus: input.bidStatus as BidStatus,
      timeOfFatigue: input.timeOfFatigue,
      signInTime: input.signInTime,
      backForDutyDate: input.backForDutyDate,
      backForDutyTime: input.backForDutyTime,
      femCompleted: input.femCompleted,
      conditions: (input.conditions ?? []) as ConditionId[],
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { result },
    };
  },
});
