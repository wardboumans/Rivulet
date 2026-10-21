import { body, error, json } from "@/lib/api";
import { addFeed } from "@/lib/feeds";
import { GOOGLE_NEWS_ICON, googleNewsFeedUrl } from "@/lib/googleNews";
import { resolveYouTube } from "@/lib/youtube";

/**
 * `source: "youtube"` treats `url` as a YouTube channel or playlist (link, @handle or ID);
 * `source: "google-news"` treats it as a Google News search in `edition`, named after the search.
 */
export async function POST(req: Request) {
  const { url, folderId, title, source, edition } = await body<{
    url: string;
    folderId: number | null;
    title: string;
    source: "youtube" | "google-news";
    edition: string;
  }>(req);
  if (!url?.trim())
    return error(
      source === "youtube" ? "Paste a YouTube channel or playlist link" : source === "google-news" ? "Type a search" : "A feed or website URL is required",
    );
  try {
    if (source === "google-news") {
      const result = await addFeed(googleNewsFeedUrl(url, edition ?? ""), folderId ?? null, title?.trim() || url.trim(), { iconUrl: GOOGLE_NEWS_ICON });
      return json(result, result.existed ? 200 : 201);
    }
    const yt = source === "youtube" ? await resolveYouTube(url) : null;
    const result = await addFeed(yt?.feedUrl ?? url, folderId ?? null, title?.trim() || undefined, { iconUrl: yt?.iconUrl });
    return json(result, result.existed ? 200 : 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not add feed", 422);
  }
}
