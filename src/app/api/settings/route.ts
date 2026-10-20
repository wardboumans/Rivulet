import { body, error, json } from "@/lib/api";
import { CREDENTIALS, DEFAULT_SUMMARY_PROMPT, credentialStatus, getSettings, setCredentials, updateSettings, type CredentialName, type Settings } from "@/lib/settings";
import { hasOpenRouterKey } from "@/lib/summarize";
import type { AppSettings } from "@/lib/types";

function current(): AppSettings {
  return { ...getSettings(), defaultSummaryPrompt: DEFAULT_SUMMARY_PROMPT, hasOpenRouterKey: hasOpenRouterKey(), credentials: credentialStatus() };
}

export function GET() {
  return json(current());
}

/** Any subset of settings, plus `credentials`: a string saves a key, null/"" removes the saved one. */
export async function PUT(req: Request) {
  const b = await body<Omit<Settings, "summaryPrompt"> & { summaryPrompt: string | null; credentials: Partial<Record<CredentialName, string | null>> }>(req);
  const patch: { [K in keyof Settings]?: Settings[K] | null } = {};
  if (b.refreshIntervalMinutes !== undefined) patch.refreshIntervalMinutes = Math.max(5, Math.round(Number(b.refreshIntervalMinutes)) || 30);
  if (b.retentionDays !== undefined) patch.retentionDays = Math.max(0, Math.round(Number(b.retentionDays)) || 0);
  if (b.youtubeRetentionDays !== undefined) patch.youtubeRetentionDays = Math.max(0, Math.round(Number(b.youtubeRetentionDays)) || 0);
  if (typeof b.openrouterModel === "string" && b.openrouterModel.trim()) patch.openrouterModel = b.openrouterModel.trim();
  if (typeof b.autoFullText === "boolean") patch.autoFullText = b.autoFullText;
  // null, empty or identical to the default all mean "use the default" (so future default changes apply).
  if (b.summaryPrompt === null) patch.summaryPrompt = null;
  else if (typeof b.summaryPrompt === "string") {
    const p = b.summaryPrompt.trim();
    if (p.length > 4000) return error("The prompt is too long (4,000 characters max)");
    patch.summaryPrompt = !p || p === DEFAULT_SUMMARY_PROMPT ? null : p;
  }

  const creds: Partial<Record<CredentialName, string | null>> = {};
  for (const [name, value] of Object.entries(b.credentials ?? {})) {
    if (!(name in CREDENTIALS)) continue;
    if (value !== null && typeof value !== "string") continue;
    const v = value?.trim() ?? "";
    if (name === "sendgridFrom" && v && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v)) return error("The sender address must be a valid email address");
    if (v.length > 500) return error("That value is too long");
    creds[name as CredentialName] = v || null;
  }

  updateSettings(patch);
  setCredentials(creds);
  return json(current());
}
