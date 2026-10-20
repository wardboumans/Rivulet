import { body, error, json } from "@/lib/api";
import { addFeed } from "@/lib/feeds";
import { resolveYouTube } from "@/lib/youtube";

/** `source: "youtube"` treats `url` as a YouTube channel or playlist (link, @handle or ID). */
export async function POST(req: Request) {
  const { url, folderId, title, source } = await body<{ url: string; folderId: number | null; title: string; source: "youtube" }>(req);
  if (!url?.trim()) return error(source === "youtube" ? "Paste a YouTube channel or playlist link" : "A feed or website URL is required");
  try {
    const yt = source === "youtube" ? await resolveYouTube(url) : null;
    const result = await addFeed(yt?.feedUrl ?? url, folderId ?? null, title?.trim() || undefined, { iconUrl: yt?.iconUrl });
    return json(result, result.existed ? 200 : 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not add feed", 422);
  }
}
