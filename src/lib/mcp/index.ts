import { auth, defineMcp } from "@lovable.dev/mcp-js";
import calculateFatigueEvent from "./tools/calculate-fatigue-event";
import buildEntriesPlanTool from "./tools/build-entries-plan";
import listReference from "./tools/list-reference";

const supabaseUrl = (
  process.env["SUPABASE_URL"] ??
  process.env["VITE_SUPABASE_URL"] ??
  "https://supabase.invalid"
).replace(/\/+$/, "");

export default defineMcp({
  name: "fatigue-event",
  title: "Fatigue Event",
  version: "0.1.0",
  instructions:
    "Tools for the Fatigue Event crew-scheduling calculator. Use `calculate_fatigue_event` for duty time, fatigue hours and CLEAR/HOLD status; `build_entries_plan` for the ordered CSS entry codes and scheduler steps; `list_reference` for entry templates, step text and option values.",
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: ["authenticated"],
    jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    resourceName: "Fatigue Event",
  }),
  tools: [calculateFatigueEvent, buildEntriesPlanTool, listReference] as never,
});

