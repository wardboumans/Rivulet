import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  collapsed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feeds (
  id INTEGER PRIMARY KEY,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  icon_url TEXT,
  icon_checked INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  etag TEXT,
  last_modified TEXT,
  last_fetched_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  url TEXT,
  title TEXT NOT NULL,
  author TEXT,
  content TEXT,
  excerpt TEXT,
  image_url TEXT,
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,
  is_saved INTEGER NOT NULL DEFAULT 0,
  -- Hidden by a filter (see lib/filters.ts). Recomputed whenever filters change.
  filtered INTEGER NOT NULL DEFAULT 0,
  saved_at INTEGER,
  full_content TEXT,
  summary TEXT,
  UNIQUE (feed_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_articles_feed_read ON articles(feed_id, is_read);
CREATE INDEX IF NOT EXISTS idx_articles_feed_unread ON articles(feed_id, is_read, filtered);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at, id);
CREATE INDEX IF NOT EXISTS idx_articles_saved ON articles(is_saved, saved_at);

-- Contentless FTS index holding plain text; rows are written from app code (see lib/search.ts).
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, body,
  content = '', contentless_delete = 1,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS articles_fts_delete AFTER DELETE ON articles BEGIN
  DELETE FROM articles_fts WHERE rowid = old.id;
END;

-- Monitoring feeds: saved keyword queries over all articles (or one folder). query is MonitorQuery JSON.
CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Automation rules. definition is RuleDefinition JSON (trigger, conditions, actions).
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  definition TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- One row per article a rule fired on. The title is copied so the log survives article retention.
CREATE TABLE IF NOT EXISTS rule_matches (
  id INTEGER PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  matched_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_rule_matches_rule ON rule_matches(rule_id, matched_at);

-- Filters hide articles (mode "remove") or hide everything else (mode "keep"). definition is FilterDefinition JSON.
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  definition TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function open(): Database.Database {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "reader.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

const g = globalThis as unknown as { __readerDb?: Database.Database; __readerSchema?: string };

export function getDb(): Database.Database {
  if (!g.__readerDb) g.__readerDb = open();
  // The connection outlives dev hot reloads, so (re)apply the idempotent schema whenever it changes.
  if (g.__readerSchema !== SCHEMA) {
    g.__readerDb.exec(SCHEMA);
    g.__readerSchema = SCHEMA;
  }
  return g.__readerDb;
}
