import { getDb } from "./db";
import { htmlToText } from "./html";

/** (Re)index one article's plain text. The FTS table is contentless, so we write rows ourselves. */
export function indexArticle(id: number, title: string, html: string | null) {
  const db = getDb();
  db.prepare("DELETE FROM articles_fts WHERE rowid = ?").run(id);
  db.prepare("INSERT INTO articles_fts (rowid, title, body) VALUES (?, ?, ?)").run(id, title, html ? htmlToText(html) : "");
}

/** Turn free text into a safe FTS5 query: every term quoted, last term prefix-matched. */
export function toFtsQuery(input: string): string | null {
  const terms = input
    .split(/\s+/)
    .map((t) => t.replace(/"/g, "").trim())
    .filter(Boolean);
  if (!terms.length) return null;
  return terms.map((t, i) => `"${t}"${i === terms.length - 1 ? "*" : ""}`).join(" ");
}
