"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { api } from "@/lib/client";
import { Dialog, inputClass, primaryButton, secondaryButton } from "./ui";

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
