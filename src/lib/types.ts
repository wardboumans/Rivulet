// Shared between server and client — keep free of Node imports.

export type Scope =
  | { kind: "all" }
  | { kind: "saved" }
  | { kind: "feed"; id: number }
  | { kind: "folder"; id: number }
  | { kind: "monitor"; id: number }
  | { kind: "search"; q: string };

/** One keyword or phrase in a monitoring feed. */
export type MonitorTerm = { text: string; titleOnly?: boolean };

/**
 * A monitoring feed query: every group must match (AND), any term within a group may match (OR),
 * and articles matching any excluded term are dropped (NOT).
 */
export type MonitorQuery = { groups: MonitorTerm[][]; exclude: MonitorTerm[] };

export type Monitor = { id: number; name: string; query: MonitorQuery; folderId: number | null };

export type SidebarMonitor = { id: number; name: string; unread: number };

export type MonitorPreview = { count: number; items: ArticleListItem[]; fts: string | null };

export type SidebarFeed = {
  id: number;
  folderId: number | null;
  title: string;
  feedUrl: string;
  siteUrl: string | null;
  iconUrl: string | null;
  unread: number;
  lastError: string | null;
  lastFetchedAt: number | null;
};

export type SidebarFolder = { id: number; name: string; collapsed: boolean; unread: number; feeds: SidebarFeed[] };

export type Sidebar = {
  monitors: SidebarMonitor[];
  folders: SidebarFolder[];
  unfiled: SidebarFeed[];
  totalUnread: number;
  savedCount: number;
  refreshing: boolean;
};

export type ArticleListItem = {
  id: number;
  feedId: number;
  feedTitle: string;
  feedIcon: string | null;
  title: string;
  url: string | null;
  author: string | null;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: number;
  isRead: boolean;
  isSaved: boolean;
};

export type ArticleDetail = ArticleListItem & {
  siteUrl: string | null;
  content: string;
  fullContent: string | null;
  summary: string | null;
  contentLength: number;
};

/** `highWater` is the newest article id when the list was loaded; anything above it arrived later. */
export type ArticlePage = { items: ArticleListItem[]; nextCursor: string | null; unread: number; highWater: number };

export type NewArticlesCheck = { newCount: number; unread: number };

export type AppSettings = {
  refreshIntervalMinutes: number;
  retentionDays: number;
  openrouterModel: string;
  autoFullText: boolean;
  summaryPrompt: string;
  defaultSummaryPrompt: string;
  hasOpenRouterKey: boolean;
  credentials: Record<CredentialName, CredentialStatus>;
};

export type CredentialName = "openrouterApiKey" | "sendgridApiKey" | "sendgridFrom" | "pushoverAppToken" | "pushoverUserKey";

/** What the UI may know about a credential: never the secret itself. */
export type CredentialStatus = { set: boolean; source: "settings" | "env" | null; preview: string | null };

export function scopeToParams(scope: Scope): URLSearchParams {
  const p = new URLSearchParams({ scope: scope.kind });
  if (scope.kind === "feed" || scope.kind === "folder" || scope.kind === "monitor") p.set("id", String(scope.id));
  if (scope.kind === "search") p.set("q", scope.q);
  return p;
}

// ---------- Automations ----------

export type RuleField = "title" | "content" | "title_or_content" | "author" | "url";
export type RuleOp = "contains" | "not_contains" | "is" | "regex";
/** `join` is ignored on the first condition; AND binds tighter than OR. */
export type RuleCondition = { join: "and" | "or"; field: RuleField; op: RuleOp; value: string };

/** "New article in feed": a single feed, a folder, or (both null) every feed. */
export type RuleTrigger = { type: "new_article"; feedId: number | null; folderId: number | null };

export type PushoverPriority = -1 | 0 | 1;
export type RuleAction = { type: "email"; to: string } | { type: "pushover"; priority: PushoverPriority; device: string };

export type RuleDefinition = { trigger: RuleTrigger; conditions: RuleCondition[]; wholeWords: boolean; actions: RuleAction[] };

export type Rule = { id: number; name: string; enabled: boolean } & RuleDefinition;

export type RuleSummary = Rule & { matchesToday: number; lastError: string | null };

export type RuleMatch = { id: number; articleId: number | null; title: string; matchedAt: number; status: "sent" | "partial" | "failed"; error: string | null };

export type RulesResponse = { rules: RuleSummary[]; providers: { email: boolean; pushover: boolean } };

export type ActionResult = { action: string; ok: boolean; error?: string };

export type RuleTestResult = { article: { id: number; title: string } | null; matched: boolean; results: ActionResult[] };

// ---------- Filters ----------

/** "remove" hides articles matching the conditions; "keep" hides every article that doesn't match. */
export type FilterMode = "remove" | "keep";

export type FilterDefinition = {
  target: { feedId: number | null; folderId: number | null };
  mode: FilterMode;
  conditions: RuleCondition[];
  wholeWords: boolean;
};

export type Filter = { id: number; enabled: boolean } & FilterDefinition;

/** `hidden` counts articles currently hidden in the filter's target (by any filter). */
export type FilterSummary = Filter & { hidden: number };

export type FilterPreview = { checked: number; hidden: number; samples: string[] };
