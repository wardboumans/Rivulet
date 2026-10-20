"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Rss,
  Tag as TagIcon,
  TagPlus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Tag, TagRef, TagSuggestions } from "@/lib/types";
import { OutputFeedSection } from "./OutputFeed";
import {
  AppLink,
  Dialog,
  IconButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from "./ui";

/**
 * The article toolbar's tag button: a popover to search, toggle and create tags, with a
 * "Suggested tags" flyout (existing tags found in the text, plus AI suggestions with a key).
 */
export function TagPicker({
  articleId,
  allTags,
  applied,
  hasAiKey,
  onApplied,
  onTagsChanged,
}: {
  articleId: number;
  allTags: Tag[];
  /** The article's tags, or null while the article is loading. */
  applied: TagRef[] | null;
  hasAiKey: boolean;
  onApplied: (tags: TagRef[]) => void;
  /** Tags were created or counts changed: refresh the sidebar. */
  onTagsChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  /** The flyout opens beside the popover when it fits, else inside it. */
  const [flyoutBeside, setFlyoutBeside] = useState(true);
  const [suggest, setSuggest] = useState<TagSuggestions | "loading" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const appliedIds = new Set((applied ?? []).map((t) => t.id));
  const appliedNames = new Set(
    (applied ?? []).map((t) => t.name.toLowerCase()),
  );

  async function change(body: {
    add?: { tagId?: number; name?: string };
    remove?: number;
  }) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ tags: TagRef[] }>(
        `/api/articles/${articleId}/tags`,
        { method: "PATCH", json: body },
      );
      onApplied(r.tags);
      onTagsChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update tags");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (t: TagRef) =>
    change(appliedIds.has(t.id) ? { remove: t.id } : { add: { tagId: t.id } });

  const q = query.replace(/\s+/g, " ").trim();
  const ql = q.toLowerCase();
  const exact = allTags.find((t) => t.name.toLowerCase() === ql);
  const list = allTags
    .filter((t) => !ql || t.name.toLowerCase().includes(ql))
    .sort(
      (a, b) => Number(appliedIds.has(b.id)) - Number(appliedIds.has(a.id)),
    );

  function submit() {
    if (!q) return;
    if (exact) {
      if (!appliedIds.has(exact.id)) change({ add: { tagId: exact.id } });
    } else change({ add: { name: q } });
    setQuery("");
  }

  function toggleSuggestions() {
    const left = ref.current?.getBoundingClientRect().left ?? 0;
    setFlyoutBeside(left + 288 + 8 + 240 + 8 <= window.innerWidth);
    setShowSuggest((s) => !s);
    if (suggest && suggest !== "loading") return;
    setSuggest("loading");
    api<TagSuggestions>(`/api/articles/${articleId}/tags/suggest`)
      .then(setSuggest)
      .catch((e) =>
        setSuggest({
          suggestions: [],
          ai: false,
          error: e instanceof Error ? e.message : "Failed",
        }),
      );
  }

  const suggestions =
    suggest && suggest !== "loading"
      ? suggest.suggestions.filter((s) => !appliedNames.has(s.toLowerCase()))
      : [];

  return (
    <div ref={ref} className="relative">
      <IconButton
        label="Tags"
        onClick={() => setOpen((o) => !o)}
        active={!!applied?.length}
      >
        <TagIcon size={19} />
      </IconButton>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-line bg-elevated p-3 shadow-pop">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            Article tags
            {busy && <Loader2 size={13} className="animate-spin text-muted" />}
          </h3>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Search or create tags"
            aria-label="Search or create tags"
            className={inputClass}
          />
          <button
            type="button"
            onClick={toggleSuggestions}
            aria-expanded={showSuggest}
            className="mt-2 flex w-full items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent hover:brightness-95"
          >
            <TagPlus size={16} />
            <span className="flex-1 text-left">Suggested tags</span>
            <ChevronRight
              size={16}
              className={`transition-transform ${showSuggest && !flyoutBeside ? "rotate-90" : ""}`}
            />
          </button>

          {showSuggest && (
            <div
              className={`rounded-lg border border-line bg-elevated p-3 ${
                flyoutBeside
                  ? "absolute left-full top-[88px] ml-2 w-60 shadow-pop"
                  : "mt-2"
              }`}
            >
              <h4 className="mb-1.5 text-sm font-bold">Suggested tags</h4>
              {suggest === "loading" ? (
                <p className="flex items-center gap-2 py-1 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" /> Thinking…
                </p>
              ) : (
                <>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => change({ add: { name: s } })}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-accent hover:bg-hover"
                    >
                      <TagPlus size={15} className="shrink-0" />
                      <span className="truncate">{s}</span>
                    </button>
                  ))}
                  {!suggestions.length && !suggest?.error && (
                    <p className="py-1 text-sm text-muted">No suggestions.</p>
                  )}
                  {suggest?.error && (
                    <p className="flex items-start gap-1.5 py-1 text-xs text-danger">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {suggest.error}
                    </p>
                  )}
                  {!hasAiKey && (
                    <p className="mt-1 text-xs text-muted">
                      Add an OpenRouter key in{" "}
                      <AppLink href="/settings/ai" className="underline">
                        Settings
                      </AppLink>{" "}
                      for AI suggestions.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-2 max-h-64 overflow-y-auto">
            {q && !exact && (
              <button
                type="button"
                onClick={submit}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-hover"
              >
                <Plus size={15} className="shrink-0 text-muted" />
                <span className="truncate">
                  Create “<strong>{q}</strong>”
                </span>
              </button>
            )}
            {list.map((t) => {
              const on = appliedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(t)}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-hover ${on ? "font-semibold text-accent" : "text-fg"}`}
                >
                  <TagIcon
                    size={15}
                    className={`shrink-0 ${on ? "" : "text-muted"}`}
                    fill={on ? "currentColor" : "none"}
                    fillOpacity={0.2}
                  />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {on && <Check size={15} className="shrink-0" />}
                </button>
              );
            })}
            {!allTags.length && !q && (
              <p className="px-1.5 py-1.5 text-sm text-muted">
                No tags yet. Type a name and press Enter to create one.
              </p>
            )}
          </div>
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}

/** Create a tag, or edit one (name, output feed). */
export function TagDialog({
  tag: initial,
  onClose,
  onSaved,
  onDelete,
}: {
  tag?: Tag;
  onClose: () => void;
  /** `keepOpen` is set when the save generated a feed link and the dialog stays open to show it. */
  onSaved: (tag: Tag, keepOpen: boolean) => void;
  onDelete?: () => void;
}) {
  const [tag, setTag] = useState(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [outputFeed, setOutputFeed] = useState(!!initial?.feedToken);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const json = { name, outputFeed };
      const saved = tag
        ? await api<Tag>(`/api/tags/${tag.id}`, { method: "PATCH", json })
        : await api<Tag>("/api/tags", { method: "POST", json });
      // This save created the feed link: stay open so it can be copied.
      const keepOpen = !!saved.feedToken && !tag?.feedToken;
      if (keepOpen) {
        setTag(saved);
        setBusy(false);
      }
      onSaved(saved, keepOpen);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!tag) return;
    setTag(
      await api<Tag>(`/api/tags/${tag.id}`, {
        method: "PATCH",
        json: { regenerateToken: true },
      }),
    );
  }

  return (
    <Dialog title={tag ? "Edit tag" : "New tag"} onClose={onClose} width={520}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-5"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            maxLength={60}
          />
        </label>
        <OutputFeedSection
          kind="tag"
          description="A public feed of this tag’s articles, for your blog or another reader."
          enabled={outputFeed}
          onEnabled={setOutputFeed}
          token={tag?.feedToken ?? null}
          onRegenerate={regenerate}
        />
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="mr-auto inline-flex items-center gap-1.5 text-sm text-danger hover:underline"
            >
              <Trash2 size={14} /> Delete tag
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className={primaryButton}
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Save tag
          </button>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Every tag with its count, pin state and output feed, plus edit and delete. */
export function ManageTagsDialog({
  tags,
  onClose,
  onNew,
  onEdit,
  onDelete,
}: {
  tags: Tag[];
  onClose: () => void;
  onNew: () => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}) {
  return (
    <Dialog title="Manage tags" onClose={onClose} width={520}>
      <div className="-mx-2 max-h-[50vh] overflow-y-auto">
        {tags.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-hover"
          >
            <TagIcon size={16} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
            {t.feedToken && (
              <span title="Has an output feed" className="text-accent">
                <Rss size={14} />
              </span>
            )}
            <span className="w-10 text-right text-xs text-muted">
              {t.count}
            </span>
            <IconButton label="Edit tag" onClick={() => onEdit(t)}>
              <Pencil size={16} />
            </IconButton>
            <IconButton label="Delete tag" onClick={() => onDelete(t)}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))}
        {!tags.length && (
          <p className="px-2 py-4 text-sm text-muted">
            No tags yet. Tag articles from the tag button above an article, or
            with an automation rule.
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-between gap-2 border-t border-line pt-4">
        <button type="button" onClick={onNew} className={secondaryButton}>
          <Plus size={15} /> New tag
        </button>
        <button type="button" onClick={onClose} className={primaryButton}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
