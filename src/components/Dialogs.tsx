"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { api } from "@/lib/client";
import type {
  FolderAutomations,
  LinkedAutomations,
  SidebarFolder,
} from "@/lib/types";
import {
  Dialog,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from "./ui";

/** "The rule “X” and 2 filters", or null when there's nothing. */
export function describeAutomations({
  rules,
  filters,
}: LinkedAutomations): string | null {
  const parts = [
    rules.length > 0 &&
      `${rules.length === 1 ? "The rule" : `${rules.length} rules`} ${rules.map((r) => `“${r.name}”`).join(", ")}`,
    filters > 0 && (filters === 1 ? "1 filter" : `${filters} filters`),
  ].filter(Boolean);
  return parts.length ? parts.join(" and ") : null;
}

/** Delete a folder, choosing whether its feeds move to the top level or are deleted with it. */
export function DeleteFolderDialog({
  folder,
  onClose,
  onDeleted,
}: {
  folder: SidebarFolder;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const feedCount = folder.feeds.length;
  const [deleteFeeds, setDeleteFeeds] = useState(false);
  const [autos, setAutos] = useState<FolderAutomations | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<FolderAutomations>(`/api/folders/${folder.id}`)
      .then(setAutos)
      .catch(() => {});
  }, [folder.id]);

  const lost = autos && {
    rules: [...autos.folder.rules, ...(deleteFeeds ? autos.feeds.rules : [])],
    filters: autos.folder.filters + (deleteFeeds ? autos.feeds.filters : 0),
  };
  const lostText = lost && describeAutomations(lost);
  const fromFolder = !!autos && !!describeAutomations(autos.folder);
  const fromFeeds =
    deleteFeeds && !!autos && !!describeAutomations(autos.feeds);
  const lostTarget =
    fromFolder && fromFeeds
      ? "this folder and its feeds"
      : fromFeeds
        ? "its feeds"
        : "this folder";
  const feedsLabel = feedCount === 1 ? "1 feed" : `${feedCount} feeds`;

  const choice = (
    value: boolean,
    title: string,
    detail: string,
    danger?: boolean,
  ) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-2.5 hover:bg-hover">
      <input
        type="radio"
        name="folder-feeds"
        checked={deleteFeeds === value}
        onChange={() => setDeleteFeeds(value)}
        className="mt-1 h-4 w-4 accent-[var(--accent)]"
      />
      <span className="text-sm">
        <span className={`font-semibold ${danger ? "text-danger" : ""}`}>
          {title}
        </span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </label>
  );

  return (
    <Dialog title="Delete folder?" onClose={onClose} width={440}>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        {feedCount === 0 ? (
          <p>“{folder.name}” is empty and will be removed.</p>
        ) : (
          <>
            <p>
              “{folder.name}” contains {feedsLabel}. What should happen to{" "}
              {feedCount === 1 ? "it" : "them"}?
            </p>
            <div className="space-y-2">
              {choice(
                false,
                "Move feeds to the top level",
                "The feeds and their articles are kept.",
              )}
              {choice(
                true,
                `Delete ${feedsLabel} too`,
                "Unfollows them and deletes all of their articles, including saved ones.",
                true,
              )}
            </div>
          </>
        )}
        {lostText && (
          <p className="text-danger">
            {lostText} for {lostTarget} will also be deleted.
          </p>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(
                `/api/folders/${folder.id}${deleteFeeds ? "?feeds=delete" : ""}`,
                { method: "DELETE" },
              );
              onDeleted();
            } catch {
              setBusy(false);
            }
          }}
          className={dangerButton}
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {deleteFeeds ? `Delete folder and ${feedsLabel}` : "Delete folder"}
        </button>
      </div>
    </Dialog>
  );
}

export function PromptDialog({
  title,
  label,
  initial,
  confirmLabel = "Save",
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initial: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Dialog title={title} onClose={onClose} width={400}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (value.trim()) await onSubmit(value.trim());
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{label}</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** OPML import (file picker) and export (download link). Used in Settings and on the "Import feeds" page. */
export function OpmlTools({ onImported }: { onImported: () => void }) {
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(file: File) {
    setMsg("Importing…");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api<{ folders: number; feeds: number; skipped: number }>(
        "/api/opml",
        { method: "POST", body: fd },
      );
      setMsg(
        `Imported ${r.feeds} feed${r.feeds === 1 ? "" : "s"} and ${r.folders} folder${r.folders === 1 ? "" : "s"}${
          r.skipped ? ` (${r.skipped} already followed)` : ""
        }. Fetching articles in the background…`,
      );
      onImported();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Move your subscriptions between readers using OPML.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={secondaryButton}
        >
          <Upload size={15} /> Import OPML
        </button>
        <a href="/api/opml" className={secondaryButton}>
          <Download size={15} /> Export OPML
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".opml,.xml,text/xml,text/x-opml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
    </div>
  );
}
