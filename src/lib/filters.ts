import { ARTICLE_SQL, conditionsMatch, normalizeConditions, type RuleArticle } from "./automations";
import { getDb } from "./db";
import type { Filter, FilterDefinition, FilterPreview, FilterSummary } from "./types";

/** Filters are (re)applied to articles from this window, newest first, capped at RECOMPUTE_LIMIT. */
const RECOMPUTE_DAYS = 30;
const RECOMPUTE_LIMIT = 10000;

type FilterRow = { id: number; enabled: number; definition: string };
type ScopedArticle = RuleArticle & { feed_id: number; folder_id: number | null; is_saved: number; filtered: number };

const SCOPED_SQL = ARTICLE_SQL.replace("SELECT a.id,", "SELECT a.id, a.feed_id, f.folder_id, a.is_saved, a.filtered,");

export function normalizeFilter(input: unknown): FilterDefinition {
  const d = (input ?? {}) as Partial<FilterDefinition>;
  const id = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
  const feedId = id(d.target?.feedId);
  const conditions = normalizeConditions(d.conditions);
  if (!conditions.some((c) => c.value.trim())) throw new Error("Add at least one condition");
  return {
    target: { feedId, folderId: feedId ? null : id(d.target?.folderId) },
    mode: d.mode === "keep" ? "keep" : "remove",
    conditions,
    wholeWords: !!d.wholeWords,
  };
}

function toFilter(r: FilterRow): Filter {
  return { id: r.id, enabled: !!r.enabled, ...(JSON.parse(r.definition) as FilterDefinition) };
}

function enabledFilters(): Filter[] {
  return (getDb().prepare("SELECT id, enabled, definition FROM filters WHERE enabled = 1").all() as FilterRow[]).map(toFilter);
}

function applies(f: FilterDefinition, a: { feed_id: number; folder_id: number | null }) {
  if (f.target.feedId) return f.target.feedId === a.feed_id;
  if (f.target.folderId) return f.target.folderId === a.folder_id;
  return true;
}

/** Hidden if any applicable "remove" filter matches, or any applicable "keep" filter doesn't. Saved articles are never hidden. */
function isHidden(filters: FilterDefinition[], a: ScopedArticle): boolean {
  if (a.is_saved) return false;
  return filters.some((f) => applies(f, a) && conditionsMatch(f.conditions, f.wholeWords, a) === (f.mode === "remove"));
}

/** Set the hidden flag on freshly inserted articles. Called during refresh, before rules run. */
export function applyFiltersToArticles(ids: number[]) {
  if (!ids.length) return;
  const filters = enabledFilters();
  if (!filters.length) return;
  const db = getDb();
  const rows = db.prepare(`${SCOPED_SQL} WHERE a.id IN (${ids.map(() => "?").join(",")})`).all(...ids) as ScopedArticle[];
  const hide = db.prepare("UPDATE articles SET filtered = 1 WHERE id = ?");
  db.transaction(() => {
    for (const a of rows) if (isHidden(filters, a)) hide.run(a.id);
  })();
}

/**
 * Recompute the hidden flag after filters change: for recent articles, plus every article that's
 * currently hidden (so deleting or loosening a filter always brings its articles back).
 */
export function reapplyFilters(): number {
  const db = getDb();
  const filters = enabledFilters();
  const since = Date.now() - RECOMPUTE_DAYS * 86400000;
  const rows = db
    .prepare(
      `${SCOPED_SQL} WHERE a.id IN (
         SELECT id FROM (SELECT id FROM articles WHERE published_at >= ? ORDER BY published_at DESC LIMIT ?)
         UNION SELECT id FROM articles WHERE filtered = 1)`,
    )
    .all(since, RECOMPUTE_LIMIT) as ScopedArticle[];
  const set = db.prepare("UPDATE articles SET filtered = ? WHERE id = ?");
  let changed = 0;
  db.transaction(() => {
    for (const a of rows) {
      const hidden = filters.length > 0 && isHidden(filters, a) ? 1 : 0;
      if (hidden !== a.filtered) {
        set.run(hidden, a.id);
        changed++;
      }
    }
  })();
  return changed;
}

/** How a (possibly unsaved) filter would affect the recent articles in its target, on its own. */
export function previewFilter(def: FilterDefinition): FilterPreview {
  const since = Date.now() - RECOMPUTE_DAYS * 86400000;
  const where = def.target.feedId ? "AND a.feed_id = ?" : def.target.folderId ? "AND f.folder_id = ?" : "";
  const params = def.target.feedId ? [def.target.feedId] : def.target.folderId ? [def.target.folderId] : [];
  const rows = getDb()
    .prepare(`${SCOPED_SQL} WHERE a.published_at >= ? ${where} ORDER BY a.published_at DESC LIMIT ?`)
    .all(since, ...params, RECOMPUTE_LIMIT) as ScopedArticle[];
  const hidden = rows.filter((a) => isHidden([def], a));
  return { checked: rows.length, hidden: hidden.length, samples: hidden.slice(0, 5).map((a) => a.title) };
}

export function listFilters(): FilterSummary[] {
  const db = getDb();
  const rows = (db.prepare("SELECT id, enabled, definition FROM filters ORDER BY created_at").all() as FilterRow[]).map(toFilter);
  const count = (f: Filter) => {
    const where = f.target.feedId ? "AND a.feed_id = ?" : f.target.folderId ? "AND f.folder_id = ?" : "";
    const params = f.target.feedId ? [f.target.feedId] : f.target.folderId ? [f.target.folderId] : [];
    return (
      db.prepare(`SELECT COUNT(*) AS n FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE a.filtered = 1 ${where}`).get(...params) as { n: number }
    ).n;
  };
  return rows.map((f) => ({ ...f, hidden: f.enabled ? count(f) : 0 }));
}

export function getFilter(id: number): Filter | null {
  const r = getDb().prepare("SELECT id, enabled, definition FROM filters WHERE id = ?").get(id) as FilterRow | undefined;
  return r ? toFilter(r) : null;
}

export function saveFilter(f: { id?: number; enabled: boolean; definition: FilterDefinition }): number {
  const db = getDb();
  const json = JSON.stringify(f.definition);
  if (f.id) {
    db.prepare("UPDATE filters SET enabled = ?, definition = ? WHERE id = ?").run(f.enabled ? 1 : 0, json, f.id);
    return f.id;
  }
  return Number(db.prepare("INSERT INTO filters (enabled, definition, created_at) VALUES (?, ?, ?)").run(f.enabled ? 1 : 0, json, Date.now()).lastInsertRowid);
}

export function setFilterEnabled(id: number, enabled: boolean) {
  getDb().prepare("UPDATE filters SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}

export function deleteFilter(id: number) {
  getDb().prepare("DELETE FROM filters WHERE id = ?").run(id);
}
