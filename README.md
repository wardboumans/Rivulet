# Rivulet

A self-hosted, single-user RSS reader with a three-pane layout. Built with Next.js 16 and SQLite (better-sqlite3).

## Features

- Feeds and folders, with unread counts and a three-pane layout (sidebar → article list → reader)
- Read state: an article is marked read when you open it. Mark everything in a section read, or only items older than a day or a week
- Saved for later
- Full-text search across all articles (SQLite FTS5)
- Full article fetch (Mozilla Readability) when a feed only provides a teaser, either automatically or with the toolbar button
- AI summaries through OpenRouter, streamed and cached per article
- OPML import and export
- Monitoring feeds: saved keyword queries (OR within a row, AND across rows, NOT to exclude, optional title-only) that act like feeds
- Automations: "new article in feed" rules with conditions (title, content, author or URL; contains, does not contain, is exactly, or regex; And/Or; whole words) that send an email (SendGrid) or a push notification (Pushover). Rules skip a feed's first fetch, so adding or importing feeds never sends its backlog, and matches from one refresh are batched
- Filters: per feed, folder or everything, either remove matching articles or keep only matching ones, using the same conditions as rules. Filtered articles are hidden (not deleted) from lists, counts, search, monitoring feeds and rules; saved articles are never hidden, and editing or disabling a filter brings articles back. Filters apply to new articles and to the most recent 10,000 from the past 30 days
- Background refresh: polls every N minutes, uses conditional GET (ETag / Last-Modified), and removes old read articles
- Light, dark, or follow the system theme. Works on desktop and mobile
- Keyboard shortcuts: `j`/`k` next/previous, `s` save, `m` toggle read, `v` open original, `f` full article, `r` refresh, `/` search, `Shift+A` mark all read
- Optional password gate via `APP_PASSWORD`

## Running

```bash
npm install
cp .env.example .env   # optional: OpenRouter key, password
npm run dev            # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The database is created at `data/reader.db` (override with `DATABASE_PATH`). Back up that file to keep your feeds, read state and saved articles.

## Configuration

Most configuration lives in the app under **Settings** (`/settings`): refresh interval, retention, automatic full text, the OpenRouter key and model, and the SendGrid and Pushover credentials for rules (each with a "Send test" button). Keys saved there are stored in the database and are never sent back to the browser; the UI only shows whether a key is set and its last four characters.

Environment variables still work as a fallback for those keys, and are the only way to set the password and paths:

| Variable             | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `OPENROUTER_API_KEY` | Enables the Summarize button                                         |
| `OPENROUTER_MODEL`   | Default model slug (default `openrouter/auto`), editable in Settings |
| `SENDGRID_API_KEY`   | Enables the email action in automations                              |
| `SENDGRID_FROM`      | Verified sender address for those emails                             |
| `PUSHOVER_APP_TOKEN` | Enables the push notification action                                 |
| `PUSHOVER_USER_KEY`  | Your Pushover user (or group) key                                    |
| `APP_PASSWORD`       | Requires a password to use the app                                   |
| `DATABASE_PATH`      | SQLite file location                                                 |
| `DISABLE_SCHEDULER`  | `1` turns off background refresh                                     |

The refresh interval, how long read articles are kept, the automatic full-text toggle and the model are all set in the in-app Settings dialog.

## Layout

```
src/
  app/api/…        route handlers (articles, feeds, folders, opml, refresh, settings, login)
  components/      client UI (AppShell holds state; Rail, SidebarPanel, ArticleList, ArticleView, Dialogs)
  lib/db.ts        schema + connection singleton
  lib/feeds.ts     discovery, parsing, refresh, retention
  lib/queries.ts   sidebar counts, article listing, mark-read
  lib/fulltext.ts  Readability extraction
  lib/summarize.ts OpenRouter streaming
  lib/opml.ts      OPML import/export
  lib/monitors.ts  monitoring-feed queries (FTS5)
  lib/automations.ts  rules: matching, SendGrid/Pushover delivery
  lib/filters.ts   remove/keep filters (hidden flag on articles)
  instrumentation.ts  starts the background scheduler
  proxy.ts         optional password gate
```
