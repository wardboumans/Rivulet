import Parser from "rss-parser";
import crypto from "node:crypto";
import { getDb } from "./db";
import { fetchText } from "./http";
import { firstImage, htmlToText, sanitizeHtml } from "./html";
import { purgeRuleMatches, runRulesForNewArticles } from "./automations";
import { applyFiltersToArticles } from "./filters";
import { indexArticle } from "./search";
import { getSettings } from "./settings";

type MediaAttr = { $?: { url?: string; medium?: string; type?: string } };
type Item = Parser.Item & {
  "content:encoded"?: string;
  mediaContent?: MediaAttr[];
  mediaThumbnail?: MediaAttr | MediaAttr[];
  mediaGroup?: { "media:content"?: MediaAttr[]; "media:thumbnail"?: MediaAttr[] };
  author?: string;
  "dc:creator"?: string;
  id?: string;
};

const parser: Parser<Record<string, unknown>, Item> = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["media:group", "mediaGroup"],
      ["dc:creator", "dc:creator"],
      ["id", "id"],
    ],
  },
});

export type FeedRow = {
  id: number;
  folder_id: number | null;
  title: string;
  feed_url: string;
  site_url: string | null;
  icon_url: string | null;
  icon_checked: number;
  etag: string | null;
  last_modified: string | null;
  last_fetched_at: number | null;
  last_error: string | null;
};

function looksLikeFeed(text: string) {
  const head = text.slice(0, 2000).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<rdf:rdf");
}

function attr(tag: string, name: string) {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
}

function findFeedLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    const type = attr(tag, "type")?.toLowerCase() ?? "";
    const href = attr(tag, "href");
    if (rel.includes("alternate") && /(rss|atom)\+xml|application\/feed\+json/.test(type) && href) {
      try {
        out.push(new URL(href, base).href);
      } catch {}
    }
  }
  return out;
}

export function findIcon(html: string, base: string): string | undefined {
  let best: { href: string; score: number } | undefined;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(m[0], "rel")?.toLowerCase() ?? "";
    const href = attr(m[0], "href");
    if (!href || !rel.includes("icon")) continue;
    const score = rel.includes("apple-touch") ? 1 : rel === "icon" || rel === "shortcut icon" ? 2 : 0;
    if (!best || score > best.score) {
      try {
        best = { href: new URL(href, base).href, score };
      } catch {}
    }
  }
  return best?.href;
}

/** Given a site or feed URL, return the URL of an actual feed plus the fetched XML. */
export async function discoverFeed(input: string): Promise<{ feedUrl: string; xml: string; etag: string | null; lastModified: string | null; pageHtml?: string }> {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const res = await fetchText(url);
  if (res.status >= 400) throw new Error(`HTTP ${res.status} fetching ${url}`);
  if (looksLikeFeed(res.text)) return { feedUrl: res.url, xml: res.text, etag: res.etag, lastModified: res.lastModified };

  const candidates = findFeedLinks(res.text, res.url);
  const origin = new URL(res.url).origin;
  for (const p of ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/feeds/posts/default"]) {
    candidates.push(origin + p);
  }
  for (const c of [...new Set(candidates)]) {
    try {
      const r = await fetchText(c, { timeoutMs: 10000 });
      if (r.status < 400 && looksLikeFeed(r.text)) {
        return { feedUrl: r.url, xml: r.text, etag: r.etag, lastModified: r.lastModified, pageHtml: res.text };
      }
    } catch {}
  }
  throw new Error("No RSS or Atom feed found at that address");
}

function mediaUrl(item: Item): string | undefined {
  const pick = (list?: MediaAttr | MediaAttr[]) => {
    const arr = Array.isArray(list) ? list : list ? [list] : [];
    return arr.find((m) => m.$?.url && (!m.$.medium || m.$.medium === "image") && (!m.$.type || m.$.type.startsWith("image")))?.$?.url;
  };
  return (
    pick(item.mediaThumbnail) ||
    pick(item.mediaContent) ||
    pick(item.mediaGroup?.["media:thumbnail"]) ||
    pick(item.mediaGroup?.["media:content"]) ||
    (item.enclosure?.url && (item.enclosure.type ?? "image").startsWith("image") ? item.enclosure.url : undefined)
  );
}

/** Feeds put odd shapes in text fields (Atom authors arrive as `{ name: [...] }`); flatten to a string. */
function text(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return text(o.name ?? o._ ?? o["#"] ?? o.$);
  }
  return null;
}

function itemDate(item: Item, now: number): number {
  const raw = item.isoDate || item.pubDate;
  const t = raw ? Date.parse(raw) : NaN;
  if (Number.isNaN(t)) return now;
  return Math.min(t, now);
}

/** Parse feed XML and insert new articles. Returns the number of new articles. */
async function storeItems(feed: FeedRow, xml: string): Promise<{ added: number; ids: number[]; title?: string; siteUrl?: string }> {
  const parsed = await parser.parseString(xml);
  const db = getDb();
  const now = Date.now();
  const siteUrl = siteFromChannelLink(text(parsed.link), feed.feed_url) || feed.site_url || undefined;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO articles (feed_id, guid, url, title, author, content, excerpt, image_url, published_at, created_at)
    VALUES (@feed_id, @guid, @url, @title, @author, @content, @excerpt, @image_url, @published_at, @created_at)
  `);

  // Items older than the retention window are skipped: purgeOld() deletes read ones, and without
  // their rows INSERT OR IGNORE would re-add them as unread on the next fetch.
  const cutoff = retentionCutoff();

  let added = 0;
  const toIndex: { id: number; title: string; content: string }[] = [];
  db.transaction(() => {
    for (const item of parsed.items) {
      const publishedAt = itemDate(item, now);
      if (cutoff && publishedAt < cutoff) continue;
      const rawLink = text(item.link);
      const link = rawLink ? safeUrl(rawLink, siteUrl ?? feed.feed_url) : undefined;
      const rawHtml = text(item["content:encoded"]) || text(item.content) || text(item.summary) || "";
      const plain = htmlToText(rawHtml);
      const rawTitle = text(item.title);
      const guid =
        text(item.guid) || text(item.id) || link || crypto.createHash("sha1").update(`${rawTitle ?? ""}|${rawHtml.slice(0, 500)}`).digest("hex");
      const content = rawHtml ? sanitizeHtml(rawHtml, link ?? siteUrl) : "";
      const title = (rawTitle && htmlToText(rawTitle)) || plain.slice(0, 80) || "(untitled)";
      const r = insert.run({
        feed_id: feed.id,
        guid,
        url: link ?? null,
        title,
        author: text(item.creator) || text(item["dc:creator"]) || text(item.author),
        content,
        excerpt: plain.slice(0, 400),
        image_url: mediaUrl(item) || firstImage(rawHtml, link ?? siteUrl) || null,
        published_at: publishedAt,
        created_at: now,
      });
      if (r.changes) {
        added++;
        toIndex.push({ id: Number(r.lastInsertRowid), title, content });
      }
    }
    for (const a of toIndex) indexArticle(a.id, a.title, a.content);
  })();

  const ids = toIndex.map((a) => a.id);
  // Hide filtered articles before anything else (counts, rules) sees them.
  applyFiltersToArticles(ids);
  return { added, ids, title: parsed.title?.trim() || undefined, siteUrl };
}

/** Some feeds put their own feed URL in the channel <link>; fall back to the site origin then. */
function siteFromChannelLink(link: string | null, feedUrl: string): string | undefined {
  const url = link ? safeUrl(link, feedUrl) : undefined;
  if (url && url !== feedUrl && !/\/(feed|rss)\/?$|\.(xml|rss|atom)$/i.test(new URL(url).pathname)) return url;
  try {
    return new URL(url ?? feedUrl).origin + "/";
  } catch {
    return undefined;
  }
}

function safeUrl(u: string, base: string) {
  try {
    return new URL(u.trim(), base).href;
  } catch {
    return undefined;
  }
}

async function resolveIcon(siteUrl: string | undefined, pageHtml?: string): Promise<string | null> {
  if (!siteUrl) return null;
  try {
    const html = pageHtml ?? (await fetchText(siteUrl, { accept: "text/html", timeoutMs: 8000 })).text;
    return findIcon(html, siteUrl) ?? new URL("/favicon.ico", siteUrl).href;
  } catch {
    try {
      return new URL("/favicon.ico", siteUrl).href;
    } catch {
      return null;
    }
  }
}

export async function addFeed(input: string, folderId: number | null, titleOverride?: string) {
  const db = getDb();
  const found = await discoverFeed(input);
  const existing = db.prepare("SELECT * FROM feeds WHERE feed_url = ?").get(found.feedUrl) as FeedRow | undefined;
  if (existing) return { feed: existing, added: 0, existed: true };

  const pos = (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM feeds").get() as { p: number }).p;
  const id = Number(
    db
      .prepare("INSERT INTO feeds (folder_id, title, feed_url, position, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(folderId, titleOverride || found.feedUrl, found.feedUrl, pos, Date.now()).lastInsertRowid,
  );
  let feed = db.prepare("SELECT * FROM feeds WHERE id = ?").get(id) as FeedRow;
  try {
    const { added, title, siteUrl } = await storeItems(feed, found.xml);
    const icon = await resolveIcon(siteUrl, found.pageHtml);
    db.prepare(
      "UPDATE feeds SET title = ?, site_url = ?, icon_url = ?, icon_checked = 1, etag = ?, last_modified = ?, last_fetched_at = ?, last_error = NULL WHERE id = ?",
    ).run(titleOverride || title || new URL(found.feedUrl).hostname, siteUrl ?? null, icon, found.etag, found.lastModified, Date.now(), id);
    feed = db.prepare("SELECT * FROM feeds WHERE id = ?").get(id) as FeedRow;
    return { feed, added, existed: false };
  } catch (e) {
    db.prepare("DELETE FROM feeds WHERE id = ?").run(id);
    throw e;
  }
}

/** Fetch one feed (conditional GET) and store new items. Errors are recorded on the feed, not thrown. */
export async function refreshFeed(feed: FeedRow): Promise<number> {
  const db = getDb();
  try {
    const res = await fetchText(feed.feed_url, { etag: feed.etag, lastModified: feed.last_modified });
    if (res.status === 304) {
      db.prepare("UPDATE feeds SET last_fetched_at = ?, last_error = NULL WHERE id = ?").run(Date.now(), feed.id);
      return 0;
    }
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    // Rules only fire for feeds that already had articles, so a new feed's backlog never triggers them.
    const hadArticles = !!getDb().prepare("SELECT 1 FROM articles WHERE feed_id = ? LIMIT 1").get(feed.id);
    const { added, ids, title, siteUrl } = await storeItems(feed, res.text);
    let icon = feed.icon_url;
    if (!feed.icon_checked) icon = await resolveIcon(siteUrl);
    db.prepare(
      `UPDATE feeds SET etag = ?, last_modified = ?, last_fetched_at = ?, last_error = NULL, site_url = COALESCE(?, site_url),
       icon_url = ?, icon_checked = 1, title = CASE WHEN title = feed_url AND ? IS NOT NULL THEN ? ELSE title END WHERE id = ?`,
    ).run(res.etag, res.lastModified, Date.now(), siteUrl ?? null, icon, title ?? null, title ?? null, feed.id);
    if (hadArticles && ids.length) {
      // Delivery problems are logged on the rule, never recorded as a feed error.
      await runRulesForNewArticles(feed, ids).catch((e) => console.error("[rivulet] rules failed", e));
    }
    return added;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.prepare("UPDATE feeds SET last_fetched_at = ?, last_error = ? WHERE id = ?").run(Date.now(), msg.slice(0, 300), feed.id);
    return 0;
  }
}

const g = globalThis as unknown as { __refreshing?: Promise<number> };

/** Refresh every feed with limited concurrency. Concurrent callers share one run. */
export function refreshAll(): Promise<number> {
  if (g.__refreshing) return g.__refreshing;
  g.__refreshing = (async () => {
    const feeds = getDb().prepare("SELECT * FROM feeds").all() as FeedRow[];
    let total = 0;
    let i = 0;
    const worker = async () => {
      while (i < feeds.length) {
        const f = feeds[i++];
        total += await refreshFeed(f);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, feeds.length) }, worker));
    purgeOld();
    purgeRuleMatches();
    return total;
  })().finally(() => {
    g.__refreshing = undefined;
  });
  return g.__refreshing;
}

export function isRefreshing() {
  return !!g.__refreshing;
}

/** Publish-date cutoff for retention, or null when articles are kept forever. */
function retentionCutoff(): number | null {
  const days = getSettings().retentionDays;
  return days && days > 0 ? Date.now() - days * 86400000 : null;
}

/** Delete read, unsaved articles older than the retention window. */
export function purgeOld() {
  const cutoff = retentionCutoff();
  if (!cutoff) return;
  getDb().prepare("DELETE FROM articles WHERE is_read = 1 AND is_saved = 0 AND published_at < ?").run(cutoff);
}

// Register the newest refreshAll for the background scheduler. In `next dev` the scheduler keeps
// the module graph it started with, while route handlers load fresh copies of this file after
// every edit; each copy overwrites this, so scheduled refreshes always run current code.
(globalThis as unknown as { __rivuletRefreshAll?: () => Promise<number> }).__rivuletRefreshAll = refreshAll;
