import { getDb } from "./db";

export type Settings = {
  refreshIntervalMinutes: number;
  retentionDays: number;
  /** Retention for YouTube feeds, separate from other feeds; 0 keeps every video. */
  youtubeRetentionDays: number;
  openrouterModel: string;
  autoFullText: boolean;
  /** System prompt sent to the model for summaries. */
  summaryPrompt: string;
};

export const DEFAULT_SUMMARY_PROMPT =
  "You summarize news articles for a feed reader. Reply with 3-5 concise markdown bullet points (start each with '- ') covering the key facts, then nothing else. Use the article's language.";

export const DEFAULT_SETTINGS: Settings = {
  refreshIntervalMinutes: 30,
  retentionDays: 60,
  youtubeRetentionDays: 180,
  openrouterModel: process.env.OPENROUTER_MODEL || "openrouter/auto",
  autoFullText: true,
  summaryPrompt: DEFAULT_SUMMARY_PROMPT,
};

export function getSettings(): Settings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const stored: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.key.startsWith(CRED_PREFIX)) continue;
    try {
      stored[r.key] = JSON.parse(r.value);
    } catch {
      // ignore malformed values
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

/** A value of null resets that setting to its default. */
export function updateSettings(patch: { [K in keyof Settings]?: Settings[K] | null }): Settings {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const reset = db.prepare("DELETE FROM settings WHERE key = ?");
  const allowed = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
  db.transaction(() => {
    for (const key of allowed) {
      if (patch[key] === null) reset.run(key);
      else if (patch[key] !== undefined) stmt.run(key, JSON.stringify(patch[key]));
    }
  })();
  return getSettings();
}

// ---------- credentials ----------
//
// API keys can be saved in Settings (stored in the settings table under a "cred:" prefix) or
// provided through the environment. A saved value wins; the env var is the fallback. Secret
// values never leave the server: the UI only sees whether a key is set, where it comes from,
// and its last four characters.

const CRED_PREFIX = "cred:";

export const CREDENTIALS = {
  openrouterApiKey: { env: "OPENROUTER_API_KEY", secret: true },
  sendgridApiKey: { env: "SENDGRID_API_KEY", secret: true },
  sendgridFrom: { env: "SENDGRID_FROM", secret: false },
  pushoverAppToken: { env: "PUSHOVER_APP_TOKEN", secret: true },
  pushoverUserKey: { env: "PUSHOVER_USER_KEY", secret: true },
} as const;

export type CredentialName = keyof typeof CREDENTIALS;

export type CredentialStatus = { set: boolean; source: "settings" | "env" | null; preview: string | null };

function storedCredential(name: CredentialName): string | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(CRED_PREFIX + name) as { value: string } | undefined;
  return row?.value || undefined;
}

/** The effective value: saved in Settings, else from the environment. */
export function getCredential(name: CredentialName): string | undefined {
  return storedCredential(name) || process.env[CREDENTIALS[name].env] || undefined;
}

export function credentialStatus(): Record<CredentialName, CredentialStatus> {
  const out = {} as Record<CredentialName, CredentialStatus>;
  for (const name of Object.keys(CREDENTIALS) as CredentialName[]) {
    const stored = storedCredential(name);
    const value = stored || process.env[CREDENTIALS[name].env] || "";
    out[name] = {
      set: !!value,
      source: stored ? "settings" : value ? "env" : null,
      preview: !value ? null : CREDENTIALS[name].secret ? `…${value.slice(-4)}` : value,
    };
  }
  return out;
}

/** A string saves the value; null or "" removes the saved value (falling back to the env var, if any). */
export function setCredentials(patch: Partial<Record<CredentialName, string | null>>) {
  const db = getDb();
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const remove = db.prepare("DELETE FROM settings WHERE key = ?");
  db.transaction(() => {
    for (const name of Object.keys(CREDENTIALS) as CredentialName[]) {
      if (!(name in patch)) continue;
      const v = patch[name]?.trim();
      if (v) upsert.run(CRED_PREFIX + name, v);
      else remove.run(CRED_PREFIX + name);
    }
  })();
}
