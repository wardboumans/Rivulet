import { body, error, intParam, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { deleteFolder, folderAutomations } from "@/lib/feeds";
import { setFolderOutputFeed } from "@/lib/outputFeeds";

/** The rules and filters that would be deleted with this folder (for the delete dialog). */
export async function GET(_req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  return json(folderAutomations(id));
}

/** Returns the folder's name and output feed token after the change. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  const patch = await body<{ name: string; collapsed: boolean; outputFeed: boolean; regenerateToken: boolean }>(req);
  const db = getDb();
  if (patch.name?.trim()) db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(patch.name.trim(), id);
  if (patch.collapsed !== undefined) db.prepare("UPDATE folders SET collapsed = ? WHERE id = ?").run(patch.collapsed ? 1 : 0, id);
  setFolderOutputFeed(id, patch);
  const folder = db.prepare("SELECT id, name, feed_token FROM folders WHERE id = ?").get(id) as
    | { id: number; name: string; feed_token: string | null }
    | undefined;
  return folder ? json({ id: folder.id, name: folder.name, feedToken: folder.feed_token }) : error("Not found", 404);
}

/** `?feeds=delete` deletes the folder's feeds too; otherwise they move to the top level. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  deleteFolder(id, new URL(req.url).searchParams.get("feeds") === "delete");
  return json({ ok: true });
}
