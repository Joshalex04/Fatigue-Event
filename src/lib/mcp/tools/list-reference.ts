import { defineTool } from "@lovable.dev/mcp-js";
import { BID_STATUS_OPTIONS, CONDITION_OPTIONS, ENTRY_DEFS, STEP_TEXTS } from "@/lib/fatigue";

export default defineTool({
  name: "list_reference",
  title: "List entry and step reference",
  description:
    "Return the reference data used by the fatigue calculator: bid statuses, condition options, entry templates with labels, and the numbered scheduler steps.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const reference = {
      bidStatuses: BID_STATUS_OPTIONS,
      conditions: CONDITION_OPTIONS,
      entries: ENTRY_DEFS,
      steps: STEP_TEXTS,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(reference, null, 2) }],
      structuredContent: reference,
    };
  },
});
