import { body, error, intParam, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function PATCH(req: Request, ctx: RouteContext<"/api/feeds/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  const patch = await body<{ title: string; folderId: number | null }>(req);
  const db = getDb();
  if (patch.title !== undefined && patch.title.trim()) db.prepare("UPDATE feeds SET title = ? WHERE id = ?").run(patch.title.trim(), id);
  if (patch.folderId !== undefined) db.prepare("UPDATE feeds SET folder_id = ? WHERE id = ?").run(patch.folderId, id);
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/feeds/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  getDb().prepare("DELETE FROM feeds WHERE id = ?").run(id);
  return json({ ok: true });
}
