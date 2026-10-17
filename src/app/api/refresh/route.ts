import { body, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { refreshAll, refreshFeed, type FeedRow } from "@/lib/feeds";

export async function POST(req: Request) {
  const { feedId } = await body<{ feedId: number }>(req);
  if (feedId) {
    const feed = getDb().prepare("SELECT * FROM feeds WHERE id = ?").get(feedId) as FeedRow | undefined;
    return json({ added: feed ? await refreshFeed(feed) : 0 });
  }
  return json({ added: await refreshAll() });
}
