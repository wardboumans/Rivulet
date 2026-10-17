import { body, error, json } from "@/lib/api";
import { normalizeDefinition, testRule } from "@/lib/automations";

/** Send a test for a rule as currently edited (it doesn't need to be saved). */
export async function POST(req: Request) {
  const b = await body<{ name: string; definition: unknown }>(req);
  try {
    return json(await testRule(b.name?.trim() ?? "", normalizeDefinition(b.definition)));
  } catch (e) {
    return error(e instanceof Error ? e.message : "Test failed");
  }
}
