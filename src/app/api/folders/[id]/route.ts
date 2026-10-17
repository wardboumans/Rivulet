import { body, error, intParam, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function PATCH(req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  const patch = await body<{ name: string; collapsed: boolean }>(req);
  const db = getDb();
  if (patch.name?.trim()) db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(patch.name.trim(), id);
  if (patch.collapsed !== undefined) db.prepare("UPDATE folders SET collapsed = ? WHERE id = ?").run(patch.collapsed ? 1 : 0, id);
  return json({ ok: true });
}

/** Deleting a folder keeps its feeds; they move to the top level (ON DELETE SET NULL). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  getDb().prepare("DELETE FROM folders WHERE id = ?").run(id);
  return json({ ok: true });
}
