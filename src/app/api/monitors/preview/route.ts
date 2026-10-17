import { body, json } from "@/lib/api";
import { normalizeQuery } from "@/lib/monitors";
import { previewQuery } from "@/lib/queries";

export async function POST(req: Request) {
  const b = await body<{ query: unknown; folderId: number | null }>(req);
  return json(previewQuery(normalizeQuery(b.query), b.folderId ?? null));
}
