import { fetchText } from "./http";

/**
 * YouTube publishes an Atom feed (newest 15 videos) for every channel and playlist at
 * /feeds/videos.xml?channel_id=… or ?playlist_id=…. These helpers turn whatever the user pastes
 * (links, @handles, IDs) into that feed URL, and turn feed entries into readable articles.
 */

const FEED = "https://www.youtube.com/feeds/videos.xml";
const CHANNEL_ID = /^UC[\w-]{22}$/;
const PLAYLIST_ID = /^(PL|UU|FL|OL|LL|RD|UL|PU)[\w-]{10,}$/;

// Skips the EU cookie-consent interstitial, which would otherwise replace every page we fetch.
const PAGE_HEADERS = { Cookie: "SOCS=CAI; CONSENT=YES+", "Accept-Language": "en" };

export type YouTubeSource = { kind: "channel" | "playlist"; feedUrl: string; iconUrl: string | null };

async function page(url: string) {
  const res = await fetchText(url, { accept: "text/html", headers: PAGE_HEADERS, timeoutMs: 15000 });
  if (res.status === 404) throw new Error("YouTube says that channel or playlist doesn't exist");
  if (res.status >= 400) throw new Error(`YouTube returned HTTP ${res.status}`);
  return res.text;
}

const ogImage = (html: string) => /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? null;

/** The channel ID a channel or video page belongs to. */
function channelIdIn(html: string): string | null {
  return (
    /feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/.exec(html)?.[1] ??
    /<meta itemprop="(?:channelId|identifier)" content="(UC[\w-]{22})"/.exec(html)?.[1] ??
    /"externalId":"(UC[\w-]{22})"/.exec(html)?.[1] ??
    /"channelId":"(UC[\w-]{22})"/.exec(html)?.[1] ??
    null
  );
}

/** The channel's avatar, used as the feed icon. Failing to get it is not an error. */
async function channelAvatar(channelId: string): Promise<string | null> {
  try {
    return ogImage(await page(`https://www.youtube.com/channel/${channelId}`));
  } catch {
    return null;
  }
}

async function playlist(id: string): Promise<YouTubeSource> {
  const feedUrl = `${FEED}?playlist_id=${id}`;
  // The feed names the playlist's channel, whose avatar makes a better icon than a thumbnail.
  const xml = await fetchText(feedUrl, { timeoutMs: 15000 }).catch(() => null);
  if (!xml || xml.status >= 400) throw new Error("YouTube has no feed for that playlist (is it private?)");
  const channelId = /<yt:channelId>(UC[\w-]{22})<\/yt:channelId>/.exec(xml.text)?.[1];
  return { kind: "playlist", feedUrl, iconUrl: channelId ? await channelAvatar(channelId) : null };
}

async function channel(id: string, html?: string): Promise<YouTubeSource> {
  return { kind: "channel", feedUrl: `${FEED}?channel_id=${id}`, iconUrl: html ? ogImage(html) : await channelAvatar(id) };
}

/** A playlist ID, also in its "VL…" browse form (used by /show/ and /browse/ links). */
function playlistId(s: string | null | undefined): string | null {
  if (!s) return null;
  const id = s.startsWith("VL") ? s.slice(2) : s;
  return PLAYLIST_ID.test(id) ? id : null;
}

/**
 * Accepts a channel link (/@handle, /channel/UC…, /c/…, /user/…), an @handle, a channel ID, a
 * playlist link or ID, a show link (/show/VL…), a video link (its playlist if it has `list=`,
 * else its channel), or a YouTube feed URL. Throws a user-facing error otherwise.
 */
export async function resolveYouTube(input: string): Promise<YouTubeSource> {
  const raw = input.trim();
  if (!raw) throw new Error("Paste a YouTube channel or playlist link");
  if (CHANNEL_ID.test(raw)) return channel(raw);
  const rawList = playlistId(raw);
  if (rawList) return playlist(rawList);
  if (/^@[\w.-]+$/.test(raw)) {
    const html = await page(`https://www.youtube.com/${raw}`);
    const id = channelIdIn(html);
    if (!id) throw new Error(`Couldn't find the channel ${raw}`);
    return channel(id, html);
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("That doesn't look like a YouTube link, @handle or ID");
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host !== "youtube.com" && host !== "youtu.be" && host !== "youtube-nocookie.com")
    throw new Error("That isn't a YouTube link");

  if (url.pathname === "/feeds/videos.xml") {
    const c = url.searchParams.get("channel_id");
    const p = url.searchParams.get("playlist_id");
    if (playlistId(p)) return playlist(playlistId(p)!);
    if (c) return channel(c);
  }
  const list =
    playlistId(url.searchParams.get("list")) ?? playlistId(/^\/(?:show|browse)\/([\w-]+)/.exec(url.pathname)?.[1]);
  if (list) return playlist(list);
  const direct = /^\/channel\/(UC[\w-]{22})/.exec(url.pathname)?.[1];
  if (direct) return channel(direct);

  // Handles, /c/ and /user/ names, and video links: read the channel ID from the page.
  const html = await page(url.href);
  const id = channelIdIn(html);
  if (!id) throw new Error("Couldn't find a channel or playlist at that link");
  const isChannelPage = /^\/(@|c\/|user\/)/.test(url.pathname);
  return channel(id, isChannelPage ? html : undefined);
}

// ---------- articles ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The video ID of a YouTube feed entry, or null for anything else. */
export function youTubeVideoId(entryId: string | null, link: string | null): string | null {
  const fromId = entryId && /^yt:video:([\w-]{11})$/.exec(entryId)?.[1];
  if (fromId) return fromId;
  if (!link) return null;
  try {
    const u = new URL(link);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    const v = u.searchParams.get("v") ?? /^\/shorts\/([\w-]{11})/.exec(u.pathname)?.[1];
    return v && /^[\w-]{11}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Article HTML for a video: a privacy-friendly embedded player, then the description as
 * paragraphs with its links made clickable. (The HTML still goes through sanitizeHtml.)
 */
export function youTubeArticleHtml(videoId: string, description: string | null): string {
  const player = `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" width="640" height="360" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  const text = (description ?? "").trim();
  if (!text) return player;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) =>
      esc(p)
        .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (u) => `<a href="${u}">${u}</a>`)
        .replace(/\n/g, "<br>"),
    )
    .map((p) => `<p>${p}</p>`)
    .join("");
  return player + paragraphs;
}
