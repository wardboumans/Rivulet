import { body, error, json } from "@/lib/api";
import { normalizeDefinition, runRuleOnExisting } from "@/lib/automations";

/** Apply a rule's tag, mark read and Read later actions (as currently edited) to existing matching articles. */
export async function POST(req: Request) {
  const b = await body<{ definition: unknown }>(req);
  try {
    return json(runRuleOnExisting(normalizeDefinition(b.definition)));
  } catch (e) {
    return error(e instanceof Error ? e.message : "Run failed");
  }
}
