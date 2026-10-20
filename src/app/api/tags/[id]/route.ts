import { body, error, intParam, json } from "@/lib/api";
import { deleteTag, getTag, rulesUsingTag, updateTag } from "@/lib/tags";

/** The tag plus the rules that assign it (shown before deleting). */
export async function GET(_req: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const id = intParam((await ctx.params).id);
  const tag = id && getTag(id);
  return tag ? json({ tag, rules: rulesUsingTag(tag.id) }) : error("Not found", 404);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id || !getTag(id)) return error("Not found", 404);
  const b = await body<{ name: string; outputFeed: boolean; regenerateToken: boolean }>(req);
  try {
    return json(updateTag(id, b));
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not update tag");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  return json({ rulesChanged: deleteTag(id) });
}
