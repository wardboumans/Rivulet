import { renderOutputFeed, type OutputFeedFormat } from "@/lib/outputFeeds";

const FORMATS: Record<string, OutputFeedFormat> = { "": "rss", ".xml": "rss", ".rss": "rss", ".json": "json", ".opml": "opml" };

/**
 * A tag's or folder's public output feed: /feeds/<tag|folder>/<token>[.xml|.json|.opml]. The
 * random token is the only access control, so the login gate in proxy.ts lets /feeds/ through.
 */
export async function GET(req: Request, ctx: RouteContext<"/feeds/[kind]/[token]">) {
  const { kind, token: raw } = await ctx.params;
  const m = /^([\w-]+)(\.\w+)?$/.exec(raw);
  const format = m && FORMATS[(m[2] ?? "").toLowerCase()];
  if ((kind !== "tag" && kind !== "folder") || !m || !format) return new Response("Not found", { status: 404 });
  const origin = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  const feed = renderOutputFeed(kind, m[1], format, origin);
  if (!feed) return new Response("Not found", { status: 404 });
  return new Response(feed.body, {
    headers: {
      "Content-Type": feed.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300",
    },
  });
}
