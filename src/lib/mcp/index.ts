import { defineMcp } from "@lovable.dev/mcp-js";
import calculateFatigueEvent from "./tools/calculate-fatigue-event";
import buildEntriesPlanTool from "./tools/build-entries-plan";
import listReference from "./tools/list-reference";

export default defineMcp({
  name: "fatigue-event",
  title: "Fatigue Event",
  version: "0.1.0",
  instructions:
    "Tools for the Fatigue Event crew-scheduling calculator. Use `calculate_fatigue_event` for duty time, fatigue hours and CLEAR/HOLD status; `build_entries_plan` for the ordered CSS entry codes and scheduler steps; `list_reference` for entry templates, step text and option values.",
  tools: [calculateFatigueEvent, buildEntriesPlanTool, listReference],
});
