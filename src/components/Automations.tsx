"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Filter as FilterIcon,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { api, timeAgo } from "@/lib/client";
import type {
  ActionResult,
  PushoverPriority,
  Rule,
  RuleAction,
  RuleCondition,
  RuleDefinition,
  RuleField,
  RuleMatch,
  RuleOp,
  RulesResponse,
  RuleSummary,
  RuleTestResult,
  Sidebar,
} from "@/lib/types";
import { confirmDialog } from "./ConfirmDialog";
import {
  AppLink,
  EmptyState,
  Menu,
  inputClass,
  primaryButton,
  secondaryButton,
} from "./ui";

type Providers = RulesResponse["providers"];
type Draft = { name: string; enabled: boolean; definition: RuleDefinition };

export const FIELD_LABELS: Record<RuleField, string> = {
  title_or_content: "Title or content",
  title: "Title",
  content: "Content",
  author: "Author",
  url: "URL",
};
export const OP_LABELS: Record<RuleOp, string> = {
  contains: "contains",
  not_contains: "does not contain",
  is: "is exactly",
  regex: "matches regex",
};

const selectClass = `${inputClass} h-10 cursor-pointer pr-8`;

export type AutomateSection = "rules" | "filters";

const SECTIONS: {
  id: AutomateSection;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "rules",
    label: "Rules",
    icon: <Zap size={17} />,
    description:
      "Get an email or a push notification when a new article matches your conditions.",
  },
  {
    id: "filters",
    label: "Filters",
    icon: <FilterIcon size={17} />,
    description:
      "Remove articles, or keep only the ones that match your conditions.",
  },
];

export function AutomatePanel({
  section,
  onSection,
}: {
  section: AutomateSection;
  onSection: (s: AutomateSection) => void;
}) {
  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      <header className="flex h-12 shrink-0 items-center px-4 pt-1">
        <h2 className="text-[15px] font-bold">Automate</h2>
      </header>
      <nav className="space-y-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSection(s.id)}
            className={`mx-2 block w-[calc(100%-1rem)] rounded-md px-3 py-3 text-left ${section === s.id ? "bg-active" : "hover:bg-hover"}`}
          >
            <span
              className={`flex items-center gap-2 text-[14px] font-bold ${section === s.id ? "text-accent" : "text-fg"}`}
            >
              {s.icon} {s.label}
            </span>
            <span className="mt-1 block pl-[25px] text-[13px] leading-snug text-muted">
              {s.description}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

/** Tab strip shown instead of the panel on small screens. */
export function AutomateTabsMobile({
  section,
  onSection,
}: {
  section: AutomateSection;
  onSection: (s: AutomateSection) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-line px-2 py-2 md:hidden">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSection(s.id)}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${section === s.id ? "bg-active font-bold text-accent" : "text-muted"}`}
        >
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  );
}

/** Feed / folder / everything picker, encoded as "all", "folder:<id>" or "feed:<id>". */
export function FeedTargetSelect({
  sidebar,
  value,
  onChange,
  anyLabel,
}: {
  sidebar: Sidebar | null;
  value: string;
  onChange: (v: string) => void;
  anyLabel: string;
}) {
  return (
    <select
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Feed"
    >
      <option value="all">{anyLabel}</option>
      {!!sidebar?.folders.length && (
        <optgroup label="Folders">
          {sidebar.folders.map((f) => (
            <option key={f.id} value={`folder:${f.id}`}>
              {f.name}
            </option>
          ))}
        </optgroup>
      )}
      {sidebar?.unfiled.length ? (
        <optgroup label="Feeds">
          {sidebar.unfiled.map((f) => (
            <option key={f.id} value={`feed:${f.id}`}>
              {f.title}
            </option>
          ))}
        </optgroup>
      ) : null}
      {sidebar?.folders.map((folder) =>
        folder.feeds.length ? (
          <optgroup key={folder.id} label={`Feeds in ${folder.name}`}>
            {folder.feeds.map((f) => (
              <option key={f.id} value={`feed:${f.id}`}>
                {f.title}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  );
}

export const targetToValue = (t: {
  feedId: number | null;
  folderId: number | null;
}) =>
  t.feedId ? `feed:${t.feedId}` : t.folderId ? `folder:${t.folderId}` : "all";
export const valueToTarget = (v: string) => {
  const [kind, id] = v.split(":");
  return {
    feedId: kind === "feed" ? Number(id) : null,
    folderId: kind === "folder" ? Number(id) : null,
  };
};

export const emptyCondition = (): RuleCondition => ({
  join: "and",
  field: "title_or_content",
  op: "contains",
  value: "",
});

/**
 * The "If" block shared by rules and filters. Each row is a fixed label column ("If", or the
 * And/Or picker) followed by a grid of field / operator / value, so nothing can push the row wider.
 */
export function ConditionsBand({
  conditions,
  wholeWords,
  onChange,
  emptyHint,
}: {
  conditions: RuleCondition[];
  wholeWords: boolean;
  onChange: (patch: {
    conditions?: RuleCondition[];
    wholeWords?: boolean;
  }) => void;
  emptyHint?: string;
}) {
  const rows = conditions.length ? conditions : [emptyCondition()];
  const setRow = (i: number, patch: Partial<RuleCondition>) =>
    onChange({
      conditions: rows.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });

  return (
    <div className="space-y-3 rounded-md bg-hover/70 px-4 py-4">
      {rows.map((c, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="w-[100px] shrink-0">
            {i === 0 ? (
              <span className="block pt-2.5 text-[14px] font-bold">If</span>
            ) : (
              <select
                className={selectClass}
                value={c.join}
                onChange={(e) =>
                  setRow(i, { join: e.target.value as "and" | "or" })
                }
                aria-label="Join"
              >
                <option value="and">And</option>
                <option value="or">Or</option>
              </select>
            )}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              className={selectClass}
              value={c.field}
              onChange={(e) =>
                setRow(i, { field: e.target.value as RuleField })
              }
              aria-label="Field"
            >
              {Object.entries(FIELD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={c.op}
              onChange={(e) => setRow(i, { op: e.target.value as RuleOp })}
              aria-label="Operator"
            >
              {Object.entries(OP_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} h-10`}
              value={c.value}
              onChange={(e) => setRow(i, { value: e.target.value })}
              placeholder={
                c.op === "regex" ? "e.g. free|giveaway" : "keyword or phrase"
              }
              aria-label="Value"
            />
          </div>
          <RemoveButton
            label="Remove condition"
            onClick={() =>
              onChange({ conditions: rows.filter((_, j) => j !== i) })
            }
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 pl-[108px] pr-10">
        <button
          type="button"
          onClick={() => onChange({ conditions: [...rows, emptyCondition()] })}
          className="text-sm text-muted hover:text-fg"
        >
          + Add condition
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={wholeWords}
            onChange={(e) => onChange({ wholeWords: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Whole words only
        </label>
      </div>
      {emptyHint && !rows.some((c) => c.value.trim()) && (
        <p className="pl-[108px] text-xs text-muted">{emptyHint}</p>
      )}
    </div>
  );
}

export function describeTrigger(
  def: RuleDefinition,
  sidebar: Sidebar | null,
): string {
  const t = def.trigger;
  if (t.feedId) {
    const feed = [
      ...(sidebar?.unfiled ?? []),
      ...(sidebar?.folders.flatMap((f) => f.feeds) ?? []),
    ].find((f) => f.id === t.feedId);
    return `New article in feed ${feed?.title ?? "(removed feed)"}`;
  }
  if (t.folderId)
    return `New article in folder ${sidebar?.folders.find((f) => f.id === t.folderId)?.name ?? "(removed folder)"}`;
  return "New article in any feed";
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-active"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

type RuleTargetPreset = { feedId?: number; folderId?: number };

function newDraft(
  providers: Providers | null,
  preset?: RuleTargetPreset,
): Draft {
  const action: RuleAction =
    !providers?.email && providers?.pushover
      ? { type: "pushover", priority: 0, device: "" }
      : { type: "email", to: "" };
  return {
    name: "",
    enabled: true,
    definition: {
      trigger: {
        type: "new_article",
        feedId: preset?.feedId ?? null,
        folderId: preset?.feedId ? null : (preset?.folderId ?? null),
      },
      conditions: [
        { join: "and", field: "title_or_content", op: "contains", value: "" },
      ],
      wholeWords: false,
      actions: [action],
    },
  };
}

/** `preset` (from a feed or folder's "Create rule…" menu item) opens a new rule aimed at it. */
export function RulesPage({
  sidebar,
  preset,
}: {
  sidebar: Sidebar | null;
  preset?: RuleTargetPreset;
}) {
  const [data, setData] = useState<RulesResponse | null>(null);
  const [open, setOpen] = useState<number | "new" | null>(
    preset ? "new" : null,
  );

  const load = useCallback(
    () => api<RulesResponse>("/api/rules").then(setData),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (r: RuleSummary, enabled: boolean) => {
    setData(
      (d) =>
        d && {
          ...d,
          rules: d.rules.map((x) => (x.id === r.id ? { ...x, enabled } : x)),
        },
    );
    await api(`/api/rules/${r.id}`, { method: "PATCH", json: { enabled } });
  };

  const remove = async (r: RuleSummary) => {
    const ok = await confirmDialog({
      title: "Delete rule?",
      message: (
        <>
          “{r.name}” will stop sending notifications. Its match history is
          deleted too.
        </>
      ),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await api(`/api/rules/${r.id}`, { method: "DELETE" });
    if (open === r.id) setOpen(null);
    load();
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[960px] px-4 pb-16 sm:px-8">
        <header className="flex h-[52px] items-center justify-between">
          <h1 className="text-[17px] font-bold">
            Rules{" "}
            <span className="font-normal text-muted">
              {data?.rules.length ?? ""}
            </span>
          </h1>
          <button
            type="button"
            onClick={() => setOpen("new")}
            className={`${primaryButton} py-1.5`}
          >
            <Plus size={16} /> Create rule
          </button>
        </header>

        {data && (!data.providers.email || !data.providers.pushover) && (
          <p className="mt-2 rounded-md border border-line bg-sidebar px-4 py-3 text-[13px] leading-relaxed text-muted">
            {!data.providers.email && !data.providers.pushover
              ? "Email and push notifications aren’t set up yet."
              : !data.providers.email
                ? "Email isn’t set up yet."
                : "Push notifications aren’t set up yet."}{" "}
            Add your SendGrid and Pushover keys in{" "}
            <AppLink
              href="/settings/notifications"
              className="text-accent underline"
            >
              Settings → Notifications
            </AppLink>
            .
          </p>
        )}

        <div
          className={`mt-6 hidden grid-cols-[40px_minmax(0,1fr)_minmax(0,1.4fr)_120px_70px_36px] items-center gap-3 px-3 pb-3 text-[11px] font-bold uppercase tracking-wide text-muted ${
            data?.rules.length || open === "new" ? "md:grid" : ""
          }`}
        >
          <span />
          <span>Name</span>
          <span>Type</span>
          <span className="text-right">Matches today</span>
          <span className="text-center">Status</span>
          <span />
        </div>

        <div className="space-y-3">
          {open === "new" && data && (
            <div className="rounded-lg border border-line bg-elevated p-4">
              <RuleEditor
                sidebar={sidebar}
                providers={data.providers}
                initial={newDraft(data.providers, preset)}
                onCancel={() => setOpen(null)}
                onSaved={(id) => {
                  setOpen(id);
                  load();
                }}
              />
            </div>
          )}

          {data?.rules.map((r) => {
            const expanded = open === r.id;
            return (
              <div
                key={r.id}
                className="rounded-lg border border-line bg-elevated"
              >
                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto_36px] items-center gap-3 px-3 py-3 md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1.4fr)_120px_70px_36px]">
                  <button
                    type="button"
                    aria-label={expanded ? "Collapse rule" : "Edit rule"}
                    onClick={() => setOpen(expanded ? null : r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-hover text-muted hover:text-fg"
                  >
                    {expanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : r.id)}
                    className="min-w-0 text-left"
                  >
                    <span className="block truncate text-[15px] font-bold">
                      {r.name}
                    </span>
                    <span className="block truncate text-[13px] text-muted md:hidden">
                      {describeTrigger(r, sidebar)}
                    </span>
                  </button>
                  <span className="hidden truncate text-[14px] text-muted md:block">
                    {describeTrigger(r, sidebar)}
                  </span>
                  <span className="hidden items-center justify-end gap-2 text-[14px] md:flex">
                    {r.lastError && (
                      <span
                        title={`Last delivery failed: ${r.lastError}`}
                        className="text-danger"
                      >
                        <AlertTriangle size={15} />
                      </span>
                    )}
                    {r.matchesToday}
                  </span>
                  <span className="flex justify-center">
                    <Toggle
                      on={r.enabled}
                      onChange={(v) => toggle(r, v)}
                      label={r.enabled ? "Disable rule" : "Enable rule"}
                    />
                  </span>
                  <Menu
                    label="Rule options"
                    items={[
                      {
                        label: expanded ? "Close editor" : "Edit",
                        onSelect: () => setOpen(expanded ? null : r.id),
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onSelect: () => remove(r),
                      },
                    ]}
                    trigger={
                      <span className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg">
                        <MoreHorizontal size={18} />
                      </span>
                    }
                  />
                </div>
                {expanded && data && (
                  <div className="border-t border-line px-4 pb-4 pt-2">
                    <RuleEditor
                      key={r.id}
                      ruleId={r.id}
                      sidebar={sidebar}
                      providers={data.providers}
                      initial={{
                        name: r.name,
                        enabled: r.enabled,
                        definition: {
                          trigger: r.trigger,
                          conditions: r.conditions,
                          wholeWords: r.wholeWords,
                          actions: r.actions,
                        },
                      }}
                      onCancel={() => setOpen(null)}
                      onSaved={() => {
                        setOpen(null);
                        load();
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {data && !data.rules.length && open !== "new" && (
            <EmptyState
              icons={[
                <Mail key="a" size={18} />,
                <Zap key="b" size={18} />,
                <Bell key="c" size={18} />,
              ]}
              title="Rules"
              actionLabel="Create rule"
              onAction={() => setOpen("new")}
            >
              Get an email or a push notification the moment a feed publishes
              something you care about. Pick a feed, add conditions, and choose
              how you want to hear about it.
            </EmptyState>
          )}
          {!data && (
            <div className="flex justify-center py-12 text-muted">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Band({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-hover/70 px-4 py-4 sm:flex-row sm:items-start">
      <span className="w-[100px] shrink-0 pt-2.5 text-[14px] font-bold">
        {label}
      </span>
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}

function RemoveButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-8 shrink-0 items-center justify-center text-muted hover:text-fg"
    >
      <X size={18} />
    </button>
  );
}

function RuleEditor({
  ruleId,
  sidebar,
  providers,
  initial,
  onCancel,
  onSaved,
}: {
  ruleId?: number;
  sidebar: Sidebar | null;
  providers: Providers;
  initial: Draft;
  onCancel: () => void;
  onSaved: (id: number) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState("");
  const [test, setTest] = useState<RuleTestResult | null>(null);
  const [matches, setMatches] = useState<RuleMatch[] | null>(null);

  useEffect(() => {
    if (!ruleId) return;
    api<{ rule: Rule; matches: RuleMatch[] }>(`/api/rules/${ruleId}`).then(
      (r) => setMatches(r.matches),
    );
  }, [ruleId]);

  const def = draft.definition;
  const setDef = (patch: Partial<RuleDefinition>) =>
    setDraft((d) => ({ ...d, definition: { ...d.definition, ...patch } }));
  const setAction = (i: number, a: RuleAction) =>
    setDef({ actions: def.actions.map((x, j) => (j === i ? a : x)) });

  const triggerValue = def.trigger.feedId
    ? `feed:${def.trigger.feedId}`
    : def.trigger.folderId
      ? `folder:${def.trigger.folderId}`
      : "all";
  const setTrigger = (v: string) => {
    const [kind, id] = v.split(":");
    setDef({
      trigger: {
        type: "new_article",
        feedId: kind === "feed" ? Number(id) : null,
        folderId: kind === "folder" ? Number(id) : null,
      },
    });
  };

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: draft.name.trim() || "Untitled rule",
        enabled: draft.enabled,
        definition: def,
      };
      if (ruleId) {
        await api(`/api/rules/${ruleId}`, { method: "PATCH", json: payload });
        onSaved(ruleId);
      } else {
        onSaved(
          (
            await api<{ id: number }>("/api/rules", {
              method: "POST",
              json: payload,
            })
          ).id,
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setErr("");
    setTest(null);
    try {
      setTest(
        await api<RuleTestResult>("/api/rules/test", {
          method: "POST",
          json: { name: draft.name, definition: def },
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const providerHint = (a: RuleAction) =>
    a.type === "email" && !providers.email ? (
      <p className="text-xs text-danger">
        SendGrid isn’t set up yet:{" "}
        <AppLink href="/settings/notifications" className="underline">
          add an API key and sender address in Settings
        </AppLink>
        .
      </p>
    ) : a.type === "pushover" && !providers.pushover ? (
      <p className="text-xs text-danger">
        Pushover isn’t set up yet:{" "}
        <AppLink href="/settings/notifications" className="underline">
          add an app token and user key in Settings
        </AppLink>
        .
      </p>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-1">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Rule name, e.g. New free game"
          aria-label="Rule name"
          className={`${inputClass} h-10 max-w-xs text-[15px]`}
        />
        {!ruleId && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <Toggle
              on={draft.enabled}
              onChange={(v) => setDraft({ ...draft, enabled: v })}
              label="Enabled"
            />{" "}
            Enabled
          </label>
        )}
      </div>

      <h3 className="py-2 text-center text-[18px] font-bold">
        {ruleId ? "Edit rule" : "New rule"}
      </h3>

      <Band label="When">
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className={selectClass}
            value="new_article"
            disabled
            aria-label="Trigger"
          >
            <option value="new_article">New article in feed</option>
          </select>
          <FeedTargetSelect
            sidebar={sidebar}
            value={triggerValue}
            onChange={setTrigger}
            anyLabel="Any feed"
          />
        </div>
      </Band>

      <ConditionsBand
        conditions={def.conditions}
        wholeWords={def.wholeWords}
        onChange={(patch) => setDef(patch)}
        emptyHint="No conditions: the rule fires for every new article."
      />

      <Band label="Then">
        {def.actions.map((a, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <select
                className={`${selectClass} w-full shrink-0 sm:w-[230px]`}
                value={a.type}
                onChange={(e) =>
                  setAction(
                    i,
                    e.target.value === "email"
                      ? { type: "email", to: "" }
                      : { type: "pushover", priority: 0, device: "" },
                  )
                }
                aria-label="Action"
              >
                <option value="email">Send to email</option>
                <option value="pushover">Push notification (Pushover)</option>
              </select>
              {a.type === "email" ? (
                <input
                  type="email"
                  className={`${inputClass} h-10 min-w-0 flex-1`}
                  value={a.to}
                  onChange={(e) => setAction(i, { ...a, to: e.target.value })}
                  placeholder="you@example.com"
                  aria-label="Email address"
                />
              ) : (
                <>
                  <select
                    className={`${selectClass} min-w-0 flex-1`}
                    value={a.priority}
                    onChange={(e) =>
                      setAction(i, {
                        ...a,
                        priority: Number(e.target.value) as PushoverPriority,
                      })
                    }
                    aria-label="Priority"
                  >
                    <option value={-1}>Quiet (no sound)</option>
                    <option value={0}>Normal</option>
                    <option value={1}>High (bypasses quiet hours)</option>
                  </select>
                  <input
                    className={`${inputClass} h-10 min-w-0 flex-1`}
                    value={a.device}
                    onChange={(e) =>
                      setAction(i, { ...a, device: e.target.value })
                    }
                    placeholder="All devices"
                    aria-label="Pushover device"
                  />
                </>
              )}
              <RemoveButton
                label="Remove action"
                onClick={() =>
                  setDef({ actions: def.actions.filter((_, j) => j !== i) })
                }
              />
            </div>
            {providerHint(a)}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDef({
              actions: [
                ...def.actions,
                providers.pushover &&
                !def.actions.some((x) => x.type === "pushover")
                  ? { type: "pushover", priority: 0, device: "" }
                  : { type: "email", to: "" },
              ],
            })
          }
          className="text-sm text-muted hover:text-fg"
        >
          + Add action
        </button>
      </Band>

      {test && <TestResult test={test} />}
      {err && <p className="text-sm text-danger">{err}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={sendTest}
          disabled={testing || !def.actions.length}
          className={`${secondaryButton} mr-auto`}
        >
          {testing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}{" "}
          Send test
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`${primaryButton} px-6`}
        >
          {saving && <Loader2 size={15} className="animate-spin" />} Save rule
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancel
        </button>
      </div>

      {matches && (
        <div className="border-t border-line pt-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Recent matches
          </h4>
          {matches.length ? (
            <ul className="space-y-1.5 text-sm">
              {matches.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 ${m.status === "sent" ? "text-accent" : "text-danger"}`}
                  >
                    {m.status === "sent" ? (
                      <Check size={15} />
                    ) : (
                      <AlertTriangle size={15} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.title}</span>
                    {m.error && (
                      <span className="block text-xs text-danger">
                        {m.error}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {timeAgo(m.matchedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Nothing yet. The rule runs when new articles arrive on the next
              feed refresh.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TestResult({ test }: { test: RuleTestResult }) {
  if (!test.article)
    return (
      <p className="rounded-md bg-sidebar px-4 py-3 text-sm text-muted">
        There are no articles in this feed yet to test with.
      </p>
    );
  return (
    <div className="rounded-md border border-line bg-sidebar px-4 py-3 text-sm">
      <p className="mb-2">
        Test sent using <strong>“{test.article.title}”</strong>
        {!test.matched && (
          <span className="text-muted">
            {" "}
            (no recent article matched the conditions, so the newest one was
            used)
          </span>
        )}
        .
      </p>
      <ul className="space-y-1">
        {test.results.map((r: ActionResult, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 ${r.ok ? "text-accent" : "text-danger"}`}
          >
            {r.ok ? (
              <Check size={15} className="mt-0.5 shrink-0" />
            ) : (
              <X size={15} className="mt-0.5 shrink-0" />
            )}
            <span>
              {r.action.startsWith("Email") ? (
                <Mail size={13} className="mr-1 inline" />
              ) : (
                <Bell size={13} className="mr-1 inline" />
              )}
              {r.action}
              {r.ok ? " — delivered" : `: ${r.error}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
