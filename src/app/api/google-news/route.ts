import Parser from "rss-parser";
import { error, json } from "@/lib/api";
import { googleNewsFeedUrl, stripSource } from "@/lib/googleNews";
import { fetchTextWithRetry } from "@/lib/http";
import type { GoogleNewsPreview } from "@/lib/types";

const parser: Parser<Record<string, unknown>, { source?: string | { _?: string } }> = new Parser({
  customFields: { item: [["source", "source"]] },
});

/** The newest results of a Google News search, shown before following it. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim();
  if (!q) return error("Type a search");
  const feedUrl = googleNewsFeedUrl(q, params.get("edition") ?? "");
  try {
    const res = await fetchTextWithRetry(feedUrl, { timeoutMs: 15000 });
    if (res.status >= 400) return error(`Google News returned HTTP ${res.status}`, 502);
    const feed = await parser.parseString(res.text);
    const items = feed.items.slice(0, 20).map((it) => {
      const source = (typeof it.source === "string" ? it.source : it.source?._)?.trim() || null;
      const published = Date.parse(it.isoDate ?? it.pubDate ?? "");
      return {
        title: stripSource(it.title?.trim() ?? null, source) ?? "(untitled)",
        source,
        url: it.link ?? null,
        publishedAt: Number.isNaN(published) ? null : published,
      };
    });
    return json({ feedUrl, items } satisfies GoogleNewsPreview);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not reach Google News", 502);
  }
}
