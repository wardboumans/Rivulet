import { body, error, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const { name } = await body<{ name: string }>(req);
  if (!name?.trim()) return error("Folder name is required");
  const db = getDb();
  const existing = db.prepare("SELECT id FROM folders WHERE name = ?").get(name.trim()) as { id: number } | undefined;
  if (existing) return json(existing);
  const r = db.prepare("INSERT INTO folders (name, position) VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM folders))").run(name.trim());
  return json({ id: Number(r.lastInsertRowid) }, 201);
}
