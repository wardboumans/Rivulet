import { body, error, json } from "@/lib/api";
import { addFeed } from "@/lib/feeds";

export async function POST(req: Request) {
  const { url, folderId, title } = await body<{ url: string; folderId: number | null; title: string }>(req);
  if (!url?.trim()) return error("A feed or website URL is required");
  try {
    const result = await addFeed(url, folderId ?? null, title?.trim() || undefined);
    return json(result, result.existed ? 200 : 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not add feed", 422);
  }
}
