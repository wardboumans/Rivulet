"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FilterX,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/client";
import type {
  FilterDefinition,
  FilterPreview,
  FilterSummary,
  RuleCondition,
  Sidebar,
} from "@/lib/types";
import {
  ConditionsBand,
  emptyCondition,
  FeedTargetSelect,
  FIELD_LABELS,
  OP_LABELS,
  targetToValue,
  Toggle,
  valueToTarget,
} from "./Automations";
import { confirmDialog } from "./ConfirmDialog";
import { EmptyState, Menu, primaryButton, secondaryButton } from "./ui";

function targetName(t: FilterDefinition["target"], sidebar: Sidebar | null) {
  if (t.feedId) {
    const feeds = [
      ...(sidebar?.unfiled ?? []),
      ...(sidebar?.folders.flatMap((f) => f.feeds) ?? []),
    ];
    return feeds.find((f) => f.id === t.feedId)?.title ?? "(removed feed)";
  }
  if (t.folderId)
    return `Folder: ${sidebar?.folders.find((f) => f.id === t.folderId)?.name ?? "(removed folder)"}`;
  return "All feeds";
}

function describeConditions(conds: RuleCondition[]) {
  return conds
    .filter((c) => c.value.trim())
    .map(
      (c, i) =>
        `${i ? ` ${c.join} ` : ""}${FIELD_LABELS[c.field].toLowerCase()} ${OP_LABELS[c.op]} “${c.value.trim()}”`,
    )
    .join("");
}

function FiltersEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icons={[
        <FilterX key="a" size={18} className="text-danger" />,
        <ListFilter key="b" size={18} />,
        <FilterX key="c" size={18} className="text-danger" />,
      ]}
      title="Filters"
      actionLabel="Create filter"
      onAction={onCreate}
    >
      Hide articles you never want to see, or keep only the ones that match your
      conditions. Edit or turn off a filter at any time and the hidden articles
      come back.
    </EmptyState>
  );
}

export function FiltersPage({
  sidebar,
  presetFeedId,
  onChanged,
}: {
  sidebar: Sidebar | null;
  presetFeedId?: number;
  onChanged: () => void;
}) {
  const [filters, setFilters] = useState<FilterSummary[] | null>(null);
  const [open, setOpen] = useState<number | "new" | null>(
    presetFeedId ? "new" : null,
  );

  const load = useCallback(
    () => api<FilterSummary[]>("/api/filters").then(setFilters),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged();
  };

  const toggle = async (f: FilterSummary, enabled: boolean) => {
    setFilters(
      (list) =>
        list && list.map((x) => (x.id === f.id ? { ...x, enabled } : x)),
    );
    await api(`/api/filters/${f.id}`, { method: "PATCH", json: { enabled } });
    changed();
  };

  const remove = async (f: FilterSummary) => {
    const ok = await confirmDialog({
      title: "Delete filter?",
      message: "Articles it hid will show up again.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await api(`/api/filters/${f.id}`, { method: "DELETE" });
    if (open === f.id) setOpen(null);
    changed();
  };

  const newDefinition: FilterDefinition = {
    target: { feedId: presetFeedId ?? null, folderId: null },
    mode: "remove",
    conditions: [emptyCondition()],
    wholeWords: true,
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[960px] px-4 pb-16 sm:px-8">
        <header className="flex h-[52px] items-center justify-between">
          <h1 className="text-[17px] font-bold">
            Filters{" "}
            <span className="font-normal text-muted">
              {filters?.length || ""}
            </span>
          </h1>
          {!!filters?.length && open !== "new" && (
            <button
              type="button"
              onClick={() => setOpen("new")}
              className={`${primaryButton} py-1.5`}
            >
              <Plus size={16} /> Create filter
            </button>
          )}
        </header>

        {open === "new" && (
          <div className="mt-4 rounded-lg border border-line bg-elevated p-4">
            <FilterEditor
              sidebar={sidebar}
              initial={newDefinition}
              onCancel={() => setOpen(null)}
              onSaved={() => {
                setOpen(null);
                changed();
              }}
            />
          </div>
        )}

        {filters && !filters.length && open !== "new" && (
          <FiltersEmpty onCreate={() => setOpen("new")} />
        )}

        <div className="mt-4 space-y-3">
          {filters?.map((f) => {
            const expanded = open === f.id;
            return (
              <div
                key={f.id}
                className="rounded-lg border border-line bg-elevated"
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <button
                    type="button"
                    aria-label={expanded ? "Collapse filter" : "Edit filter"}
                    onClick={() => setOpen(expanded ? null : f.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-hover text-muted hover:text-fg"
                  >
                    {expanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : f.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold">
                        {targetName(f.target, sidebar)}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          f.mode === "remove"
                            ? "bg-danger/10 text-danger"
                            : "bg-accent-soft text-accent"
                        }`}
                      >
                        {f.mode === "remove" ? "Remove" : "Keep only"}
                      </span>
                    </span>
                    <span className="block truncate text-[13px] text-muted">
                      {describeConditions(f.conditions)}
                    </span>
                  </button>
                  <span className="hidden shrink-0 text-[13px] text-muted sm:block">
                    {f.enabled ? `${f.hidden} hidden` : "Off"}
                  </span>
                  <Toggle
                    on={f.enabled}
                    onChange={(v) => toggle(f, v)}
                    label={f.enabled ? "Disable filter" : "Enable filter"}
                  />
                  <Menu
                    label="Filter options"
                    items={[
                      {
                        label: expanded ? "Close editor" : "Edit",
                        onSelect: () => setOpen(expanded ? null : f.id),
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onSelect: () => remove(f),
                      },
                    ]}
                    trigger={
                      <span className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg">
                        <MoreHorizontal size={18} />
                      </span>
                    }
                  />
                </div>
                {expanded && (
                  <div className="border-t border-line px-4 pb-4 pt-3">
                    <FilterEditor
                      key={f.id}
                      filterId={f.id}
                      sidebar={sidebar}
                      initial={{
                        target: f.target,
                        mode: f.mode,
                        conditions: f.conditions,
                        wholeWords: f.wholeWords,
                      }}
                      onCancel={() => setOpen(null)}
                      onSaved={() => {
                        setOpen(null);
                        changed();
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {!filters && (
            <div className="flex justify-center py-12 text-muted">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterEditor({
  filterId,
  sidebar,
  initial,
  onCancel,
  onSaved,
}: {
  filterId?: number;
  sidebar: Sidebar | null;
  initial: FilterDefinition;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [def, setDef] = useState<FilterDefinition>(initial);
  const [preview, setPreview] = useState<FilterPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Debounced preview of what this filter alone would hide.
  const previewKey = JSON.stringify(def);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      api<FilterPreview>("/api/filters/preview", {
        method: "POST",
        json: { definition: def },
      }).then((p) => !cancelled && setPreview(p));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // previewKey captures def
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  async function save() {
    setSaving(true);
    setErr("");
    try {
      if (filterId)
        await api(`/api/filters/${filterId}`, {
          method: "PATCH",
          json: { definition: def },
        });
      else
        await api("/api/filters", {
          method: "POST",
          json: { definition: def },
        });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  const hasConditions = def.conditions.some((c) => c.value.trim());
  const modeButton = (
    mode: FilterDefinition["mode"],
    label: string,
    Icon: typeof FilterX,
  ) => (
    <button
      type="button"
      onClick={() => setDef({ ...def, mode })}
      aria-pressed={def.mode === mode}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-[14px] font-bold ${
        def.mode === mode
          ? "bg-bg text-accent shadow-sm"
          : "text-muted hover:text-fg"
      }`}
    >
      <Icon size={17} /> {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-[320px]">
          <FeedTargetSelect
            sidebar={sidebar}
            value={targetToValue(def.target)}
            onChange={(v) => setDef({ ...def, target: valueToTarget(v) })}
            anyLabel="All feeds"
          />
        </div>
        <div className="flex rounded-lg bg-hover p-1 sm:w-[400px]">
          {modeButton("remove", "Remove articles", FilterX)}
          {modeButton("keep", "Keep articles", ListFilter)}
        </div>
      </div>

      <ConditionsBand
        conditions={def.conditions}
        wholeWords={def.wholeWords}
        onChange={(patch) => setDef({ ...def, ...patch })}
      />

      <div className="flex items-start gap-3 rounded-md bg-accent-soft px-4 py-3 text-[13px]">
        <CalendarDays size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="font-semibold">
            Filters apply to new articles and to the most recent 10,000 articles
            from the past 30 days.
          </p>
          <p className="mt-1 text-muted">
            {def.mode === "remove"
              ? "Matching articles are hidden."
              : "Only matching articles stay visible; everything else here is hidden."}{" "}
            Saved articles are never hidden.
          </p>
        </div>
      </div>

      {hasConditions && preview && (
        <div className="text-[13px] text-muted">
          <p>
            On its own, this filter would hide{" "}
            <strong className="text-fg">
              {preview.hidden.toLocaleString()}
            </strong>{" "}
            of {preview.checked.toLocaleString()} recent articles.
          </p>
          {!!preview.samples.length && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {preview.samples.map((t, i) => (
                <li key={i} className="truncate">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving || !hasConditions}
          className={`${primaryButton} px-6`}
        >
          {saving && <Loader2 size={15} className="animate-spin" />} Save filter
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}
