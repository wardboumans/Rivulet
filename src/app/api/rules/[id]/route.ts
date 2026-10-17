import { body, error, intParam, json } from "@/lib/api";
import { deleteRule, getRule, normalizeDefinition, recentMatches, saveRule, setRuleEnabled } from "@/lib/automations";

export async function GET(_req: Request, ctx: RouteContext<"/api/rules/[id]">) {
  const id = intParam((await ctx.params).id);
  const rule = id && getRule(id);
  return rule ? json({ rule, matches: recentMatches(rule.id) }) : error("Not found", 404);
}

/** `{ enabled }` alone toggles the rule; anything else replaces its name and definition. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/rules/[id]">) {
  const id = intParam((await ctx.params).id);
  const existing = id && getRule(id);
  if (!existing) return error("Not found", 404);
  const b = await body<{ name: string; enabled: boolean; definition: unknown }>(req);
  if (b.definition === undefined) {
    if (b.enabled !== undefined) setRuleEnabled(existing.id, b.enabled);
    return json({ ok: true });
  }
  try {
    saveRule({
      id: existing.id,
      name: b.name?.trim() || existing.name,
      enabled: b.enabled ?? existing.enabled,
      definition: normalizeDefinition(b.definition),
    });
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid rule");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/rules/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  deleteRule(id);
  return json({ ok: true });
}
