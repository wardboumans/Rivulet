import { body, error, json } from "@/lib/api";
import { buildFtsQuery, listMonitors, normalizeQuery, saveMonitor } from "@/lib/monitors";

export function GET() {
  return json(listMonitors());
}

export async function POST(req: Request) {
  const b = await body<{ name: string; query: unknown; folderId: number | null }>(req);
  const query = normalizeQuery(b.query);
  if (!buildFtsQuery(query)) return error("Add at least one keyword to monitor");
  const name = b.name?.trim() || query.groups[0][0].text;
  const id = saveMonitor({ name, query, folderId: b.folderId ?? null });
  return json({ id }, 201);
}
