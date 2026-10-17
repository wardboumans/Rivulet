import { body, error, json } from "@/lib/api";
import { listRules, normalizeDefinition, providers, saveRule } from "@/lib/automations";
import type { RulesResponse } from "@/lib/types";

export function GET() {
  return json({ rules: listRules(), providers: providers() } satisfies RulesResponse);
}

export async function POST(req: Request) {
  const b = await body<{ name: string; enabled: boolean; definition: unknown }>(req);
  try {
    const definition = normalizeDefinition(b.definition);
    const id = saveRule({ name: b.name?.trim() || "Untitled rule", enabled: b.enabled ?? true, definition });
    return json({ id }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid rule");
  }
}
