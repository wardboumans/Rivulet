import { body, error, intParam, json } from "@/lib/api";
import { buildFtsQuery, deleteMonitor, getMonitor, normalizeQuery, saveMonitor } from "@/lib/monitors";

export async function GET(_req: Request, ctx: RouteContext<"/api/monitors/[id]">) {
  const id = intParam((await ctx.params).id);
  const m = id && getMonitor(id);
  return m ? json(m) : error("Not found", 404);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/monitors/[id]">) {
  const id = intParam((await ctx.params).id);
  const existing = id && getMonitor(id);
  if (!existing) return error("Not found", 404);
  const b = await body<{ name: string; query: unknown; folderId: number | null }>(req);
  const query = b.query !== undefined ? normalizeQuery(b.query) : existing.query;
  if (!buildFtsQuery(query)) return error("Add at least one keyword to monitor");
  saveMonitor({
    id: existing.id,
    name: b.name?.trim() || existing.name,
    query,
    folderId: b.folderId !== undefined ? b.folderId : existing.folderId,
  });
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/monitors/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  deleteMonitor(id);
  return json({ ok: true });
}
