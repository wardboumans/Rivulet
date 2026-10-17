"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Settings2, Trash2, X } from "lucide-react";
import { api, timeAgo } from "@/lib/client";
import type {
  Monitor,
  MonitorPreview,
  MonitorQuery,
  MonitorTerm,
  Sidebar,
} from "@/lib/types";
import { confirmDialog } from "./ConfirmDialog";
import { FeedIcon, Menu, primaryButton, secondaryButton } from "./ui";

/** Which group a new term goes into: an AND-group index, or the NOT list. */
type Target = number | "exclude";

const EMPTY: MonitorQuery = { groups: [[]], exclude: [] };

function TermChip({
  term,
  negative,
  onChange,
  onRemove,
}: {
  term: MonitorTerm;
  negative?: boolean;
  onChange: (t: MonitorTerm) => void;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex h-9 items-center gap-2 rounded-md border bg-bg pl-3 pr-1.5 text-[15px] ${
        negative ? "border-danger/50 text-danger" : "border-line text-fg"
      }`}
    >
      <span>“{term.text}”</span>
      {term.titleOnly && (
        <span className="rounded bg-accent-soft px-1.5 text-[11px] font-semibold text-accent">
          title
        </span>
      )}
      <Menu
        label="Keyword options"
        align="left"
        items={[
          {
            label: "Match title and content",
            checked: !term.titleOnly,
            onSelect: () => onChange({ text: term.text }),
          },
          {
            label: "Match title only",
            checked: !!term.titleOnly,
            onSelect: () => onChange({ text: term.text, titleOnly: true }),
          },
        ]}
        trigger={
          <span
            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-hover ${term.titleOnly ? "text-accent" : "text-faint"}`}
          >
            <Settings2 size={14} />
          </span>
        }
      />
      <button
        type="button"
        aria-label={`Remove ${term.text}`}
        onClick={onRemove}
        className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-hover hover:text-fg"
      >
        <X size={14} />
      </button>
    </span>
  );
}

/** Inline input for a new keyword. Enter or comma adds (and keeps the input open); Escape or blurring empty closes. */
function TermInput({
  onAdd,
  onClose,
  placeholder,
}: {
  onAdd: (text: string) => void;
  onClose: () => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const commit = () => {
    const parts = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    parts.forEach(onAdd);
    setValue("");
    return parts.length > 0;
  };
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") onClose();
        else if (e.key === "Backspace" && !value) onClose();
      }}
      onBlur={() => {
        commit();
        onClose();
      }}
      className="h-9 w-48 rounded-md border border-accent bg-bg px-3 text-[15px] outline-none ring-2 ring-accent/20 placeholder:text-faint"
    />
  );
}

function GroupLabel({
  children,
  negative,
}: {
  children: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-9 items-center px-1 text-xs font-bold uppercase tracking-wide ${negative ? "text-danger" : "text-muted"}`}
    >
      {children}
    </span>
  );
}

const pillButton =
  "inline-flex h-9 items-center rounded-md border border-accent/60 px-4 text-sm font-semibold text-accent hover:bg-accent-soft";

export function MonitorEditor({
  sidebar,
  monitorId,
  onSaved,
  onDeleted,
}: {
  sidebar: Sidebar | null;
  monitorId?: number;
  onSaved: (id: number) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState<MonitorQuery>(EMPTY);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [adding, setAdding] = useState<Target | null>(monitorId ? null : 0);
  const [loaded, setLoaded] = useState(!monitorId);
  const [preview, setPreview] = useState<MonitorPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const previewSeq = useRef(0);

  useEffect(() => {
    if (!monitorId) return;
    api<Monitor>(`/api/monitors/${monitorId}`).then((m) => {
      setName(m.name);
      setQuery(m.query.groups.length ? m.query : EMPTY);
      setFolderId(m.folderId);
      setLoaded(true);
    });
  }, [monitorId]);

  // Debounced live preview.
  const previewKey = JSON.stringify([query, folderId]);
  useEffect(() => {
    if (!loaded) return;
    const seq = ++previewSeq.current;
    const t = setTimeout(() => {
      setPreviewLoading(true);
      api<MonitorPreview>("/api/monitors/preview", {
        method: "POST",
        json: { query, folderId },
      })
        .then((p) => seq === previewSeq.current && setPreview(p))
        .finally(() => seq === previewSeq.current && setPreviewLoading(false));
    }, 300);
    return () => clearTimeout(t);
    // previewKey captures query + folderId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, loaded]);

  const hasTerms = query.groups.some((g) => g.length);

  // ---------- query editing ----------
  const addTerm = (target: Target, text: string) =>
    setQuery((q) => {
      const t = { text };
      if (target === "exclude")
        return q.exclude.some((x) => x.text === text)
          ? q
          : { ...q, exclude: [...q.exclude, t] };
      return {
        ...q,
        groups: q.groups.map((g, i) =>
          i === target && !g.some((x) => x.text === text) ? [...g, t] : g,
        ),
      };
    });

  const updateTerm = (target: Target, idx: number, term: MonitorTerm | null) =>
    setQuery((q) => {
      const edit = (list: MonitorTerm[]) =>
        term
          ? list.map((t, i) => (i === idx ? term : t))
          : list.filter((_, i) => i !== idx);
      if (target === "exclude") return { ...q, exclude: edit(q.exclude) };
      const groups = q.groups.map((g, i) => (i === target ? edit(g) : g));
      // Drop emptied AND-groups, but always keep the first group so there's somewhere to type.
      const kept = groups.filter((g, i) => i === 0 || g.length);
      return { ...q, groups: kept.length ? kept : [[]] };
    });

  const closeInput = () => {
    // A freshly added AND-group that never got a term disappears again.
    setQuery((q) => {
      const kept = q.groups.filter((g, i) => i === 0 || g.length);
      return kept.length === q.groups.length ? q : { ...q, groups: kept };
    });
    setAdding(null);
  };

  const addAndGroup = () => {
    setQuery((q) => ({ ...q, groups: [...q.groups, []] }));
    setAdding(query.groups.length);
  };

  // ---------- save / delete ----------
  async function save() {
    setSaving(true);
    setErr("");
    try {
      const payload = { name: name.trim(), query, folderId };
      if (monitorId) {
        await api(`/api/monitors/${monitorId}`, {
          method: "PATCH",
          json: payload,
        });
        onSaved(monitorId);
      } else {
        const { id } = await api<{ id: number }>("/api/monitors", {
          method: "POST",
          json: payload,
        });
        onSaved(id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  async function remove() {
    if (!monitorId) return;
    const ok = await confirmDialog({
      title: "Delete monitoring feed?",
      message: (
        <>
          “{name}” will be removed from the sidebar. Articles are not affected.
        </>
      ),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await api(`/api/monitors/${monitorId}`, { method: "DELETE" });
    onDeleted();
  }

  const scopeName = folderId
    ? (sidebar?.folders.find((f) => f.id === folderId)?.name ?? "folder")
    : "All feeds";
  const firstTerm = query.groups[0]?.[0]?.text;

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const groupRow = (terms: MonitorTerm[], target: Target, label?: string) => (
    <div className="flex flex-wrap items-center gap-2.5">
      {label && (
        <GroupLabel negative={target === "exclude"}>{label}</GroupLabel>
      )}
      {terms.map((t, i) => (
        <TermChip
          key={t.text}
          term={t}
          negative={target === "exclude"}
          onChange={(nt) => updateTerm(target, i, nt)}
          onRemove={() => updateTerm(target, i, null)}
        />
      ))}
      {adding === target ? (
        <TermInput
          onAdd={(text) => addTerm(target, text)}
          onClose={closeInput}
          placeholder={
            target === "exclude"
              ? "Exclude keyword"
              : terms.length
                ? "or…"
                : "Keyword or phrase"
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(target)}
          className="h-9 px-1 text-sm font-semibold text-accent hover:underline"
        >
          + OR
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Configuration */}
      <div className="min-h-0 overflow-y-auto border-line lg:w-[560px] lg:shrink-0 lg:border-r">
        <div className="px-6 py-5 sm:px-8">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              firstTerm ? `${firstTerm} (name)` : "Name this monitoring feed"
            }
            aria-label="Monitoring feed name"
            className="-ml-2 mb-6 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-[17px] font-bold outline-none placeholder:font-semibold placeholder:text-faint hover:border-line focus:border-accent"
          />

          <h2 className="mb-5 text-[16px] font-bold">Configuration</h2>
          <p className="mb-3 text-sm font-semibold">
            What do you want to monitor?
          </p>

          <div className="space-y-3">
            {query.groups.map((g, i) => (
              <div key={i}>{groupRow(g, i, i > 0 ? "and" : undefined)}</div>
            ))}
            {(query.exclude.length > 0 || adding === "exclude") &&
              groupRow(query.exclude, "exclude", "not")}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={addAndGroup}
              disabled={!hasTerms}
              className={`${pillButton} disabled:opacity-40`}
            >
              + AND
            </button>
            <button
              type="button"
              onClick={() => setAdding("exclude")}
              disabled={!hasTerms}
              className={`${pillButton} disabled:opacity-40`}
            >
              − NOT
            </button>
            <span className="h-px flex-1 bg-line" />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            Keywords in one row match if <em>any</em> of them appears. Each{" "}
            <strong>AND</strong> row must also match, and articles with a{" "}
            <strong>NOT</strong> keyword are left out. Use the{" "}
            <Settings2 size={11} className="inline" /> button to match a keyword
            in titles only.
          </p>

          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="mt-6 text-sm text-accent underline underline-offset-2"
          >
            {showRaw ? "Hide raw query" : "View raw query"}
          </button>
          {showRaw && (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-line bg-sidebar px-3 py-2 font-mono text-xs text-muted">
              {preview?.fts ?? "(no keywords yet)"}
            </pre>
          )}

          <p className="mt-6 flex items-start gap-2 text-sm text-muted">
            <Info size={15} className="mt-0.5 shrink-0" />
            Matches articles in any language. Words are matched on their stem,
            so “tracker” also finds “trackers”.
          </p>

          <h3 className="mb-2 mt-8 text-sm font-bold">Monitor in</h3>
          <label className="block rounded-lg bg-hover p-1">
            <span className="block rounded-md bg-bg px-4 py-2 shadow-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-accent">
                My feeds
              </span>
              <select
                value={folderId ?? ""}
                onChange={(e) =>
                  setFolderId(e.target.value ? Number(e.target.value) : null)
                }
                className="-ml-1 w-full bg-transparent text-[15px] font-semibold outline-none"
              >
                <option value="">All feeds</option>
                {sidebar?.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {err && <p className="mt-4 text-sm text-danger">{err}</p>}

          <button
            type="button"
            onClick={save}
            disabled={!hasTerms || saving}
            className={`${primaryButton} mt-8 w-full py-2.5 text-[15px]`}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save monitoring feed
          </button>
          {monitorId && (
            <button
              type="button"
              onClick={remove}
              className={`${secondaryButton} mt-3 w-full text-danger`}
            >
              <Trash2 size={15} /> Delete monitoring feed
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line lg:border-t-0">
        <div className="px-6 py-5 sm:px-8">
          <h2 className="mb-1 text-[16px] font-bold">Preview</h2>
          <p className="mb-5 flex items-center gap-2 text-[15px]">
            {hasTerms ? (
              <>
                {(preview?.count ?? 0).toLocaleString()} matches in{" "}
                <strong>{scopeName}</strong>
              </>
            ) : (
              <span className="text-muted">
                Add a keyword to see matching articles.
              </span>
            )}
            {previewLoading && (
              <Loader2 size={14} className="animate-spin text-muted" />
            )}
          </p>

          {hasTerms &&
            preview?.items.map((a) => (
              <a
                key={a.id}
                href={a.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="group mb-4 flex gap-4 rounded-md"
              >
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-[100px] w-[120px] shrink-0 rounded-md bg-hover object-cover"
                    onError={(e) =>
                      (e.currentTarget.style.visibility = "hidden")
                    }
                  />
                ) : (
                  <span className="h-[100px] w-[120px] shrink-0 rounded-md bg-hover" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`line-clamp-2 text-[15px] font-bold leading-snug group-hover:text-accent ${a.isRead ? "text-muted" : ""}`}
                  >
                    {a.title}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
                    <FeedIcon src={a.feedIcon} title={a.feedTitle} size={13} />
                    <span className="truncate">{a.feedTitle}</span>
                  </span>
                  <span className="mt-2 block text-[13px] text-muted">
                    {timeAgo(a.publishedAt)}
                  </span>
                </span>
              </a>
            ))}
          {hasTerms && preview && preview.count > preview.items.length && (
            <p className="text-sm text-muted">
              …and {(preview.count - preview.items.length).toLocaleString()}{" "}
              more. Save to see them all.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
