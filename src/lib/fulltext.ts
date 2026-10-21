import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { getDb } from "./db";
import { isGoogleNewsLink } from "./googleNews";
import { fetchText } from "./http";
import { sanitizeHtml } from "./html";
import { indexArticle } from "./search";

/** Fetch the original page, extract the main content with Readability, and cache it on the article. */
export async function fetchFullText(articleId: number): Promise<string> {
  const db = getDb();
  const a = db.prepare("SELECT id, url, title, full_content FROM articles WHERE id = ?").get(articleId) as
    | { id: number; url: string | null; title: string; full_content: string | null }
    | undefined;
  if (!a) throw new Error("Article not found");
  if (a.full_content) return a.full_content;
  if (!a.url) throw new Error("Article has no link");
  if (isGoogleNewsLink(a.url)) throw new Error("Google News links only lead to the article in a browser; open the original instead");

  const res = await fetchText(a.url, { accept: "text/html,application/xhtml+xml", timeoutMs: 20000, maxBytes: 8 * 1024 * 1024 });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

  const virtualConsole = new VirtualConsole(); // swallow CSS parse noise from real-world pages
  const dom = new JSDOM(res.text, { url: res.url, virtualConsole });
  const parsed = new Readability(dom.window.document).parse();
  dom.window.close();
  if (!parsed?.content) throw new Error("Could not extract article content");

  const html = sanitizeHtml(parsed.content, res.url);
  db.prepare("UPDATE articles SET full_content = ? WHERE id = ?").run(html, a.id);
  indexArticle(a.id, a.title, html);
  return html;
}
