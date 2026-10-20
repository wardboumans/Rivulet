"use client";

import { useState } from "react";
import { FileInput, Loader2, Rss, ScanSearch, TvMinimalPlay } from "lucide-react";
import { api } from "@/lib/client";
import type { Sidebar } from "@/lib/types";
import { OpmlTools } from "./Dialogs";
import { inputClass, primaryButton } from "./ui";

export type AddTab = "feed" | "youtube" | "monitor" | "import";

const TABS: { id: AddTab; label: string; icon: React.ReactNode }[] = [
  { id: "feed", label: "Web feed", icon: <Rss size={17} /> },
  { id: "youtube", label: "YouTube", icon: <TvMinimalPlay size={17} /> },
  { id: "monitor", label: "Monitoring feed", icon: <ScanSearch size={17} /> },
  { id: "import", label: "Import feeds", icon: <FileInput size={17} /> },
];

/** Takes the sidebar's place while adding something. */
export function AddPanel({ tab, onTab }: { tab: AddTab; onTab: (t: AddTab) => void }) {
  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      <header className="flex h-12 shrink-0 items-center px-4 pt-1">
        <h2 className="text-[15px] font-bold">Add new</h2>
      </header>
      <nav className="pt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`mx-2 flex h-9 w-[calc(100%-1rem)] items-center gap-3 rounded-md px-3 text-[14px] ${
              tab === t.id ? "bg-active font-bold text-accent" : "text-fg hover:bg-hover"
            }`}
          >
            <span className="text-muted">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

/** Tab strip shown instead of the panel on small screens. */
export function AddTabsMobile({ tab, onTab }: { tab: AddTab; onTab: (t: AddTab) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2 md:hidden">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(t.id)}
          className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm ${tab === t.id ? "bg-active font-bold text-accent" : "text-muted"}`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Folder picker shared by the add pages; "new" shows a name field. */
function useFolderField(sidebar: Sidebar | null, defaultFolderId: number | null) {
  const [folder, setFolder] = useState<string>(defaultFolderId ? String(defaultFolderId) : "");
  const [newFolder, setNewFolder] = useState("");
  const field = (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Folder</span>
        <select value={folder} onChange={(e) => setFolder(e.target.value)} className={inputClass}>
          <option value="">No folder</option>
          {sidebar?.folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
          <option value="new">+ New folder…</option>
        </select>
      </label>
      {folder === "new" && <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" className={inputClass} required />}
    </>
  );
  /** The chosen folder's id, creating the new folder first if needed. */
  const resolve = async (): Promise<number | null> => {
    if (folder === "new" && newFolder.trim()) return (await api<{ id: number }>("/api/folders", { method: "POST", json: { name: newFolder } })).id;
    return folder && folder !== "new" ? Number(folder) : null;
  };
  return { field, resolve };
}

type AddPageProps = {
  sidebar: Sidebar | null;
  defaultFolderId: number | null;
  onAdded: (feedId: number) => void;
};

function useAddFeed(onAdded: (feedId: number) => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const add = async (folderId: () => Promise<number | null>, json: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ feed: { id: number } }>("/api/feeds", { method: "POST", json: { ...json, folderId: await folderId() } });
      onAdded(r.feed.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : fallback);
      setBusy(false);
    }
  };
  return { busy, err, add };
}

export function AddFeedPage({ sidebar, defaultFolderId, onAdded }: AddPageProps) {
  const [url, setUrl] = useState("");
  const folder = useFolderField(sidebar, defaultFolderId);
  const { busy, err, add } = useAddFeed(onAdded);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[560px] px-6 py-6 sm:px-8">
        <h1 className="mb-6 text-[17px] font-bold">Follow a website or feed</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(folder.resolve, { url }, "Could not add feed");
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Website or feed URL</span>
            <input autoFocus required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="e.g. hackaday.com or https://example.com/feed.xml" className={inputClass} />
            <span className="mt-1.5 block text-xs text-muted">Paste a site address and Rivulet will find its RSS or Atom feed.</span>
          </label>
          {folder.field}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="submit" disabled={busy} className={`${primaryButton} w-full py-2.5`}>
            {busy && <Loader2 size={15} className="animate-spin" />} {busy ? "Finding feed…" : "Follow"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function YouTubePage({ sidebar, defaultFolderId, onAdded }: AddPageProps) {
  const [input, setInput] = useState("");
  const folder = useFolderField(sidebar, defaultFolderId);
  const { busy, err, add } = useAddFeed(onAdded);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[560px] px-6 py-6 sm:px-8">
        <h1 className="mb-6 text-[17px] font-bold">Follow a YouTube channel or playlist</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(folder.resolve, { url: input, source: "youtube" }, "Could not add the channel or playlist");
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Channel or playlist</span>
            <input
              autoFocus
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. @veritasium or a youtube.com link"
              className={inputClass}
            />
            <span className="mt-1.5 block text-xs leading-relaxed text-muted">
              A channel link or <code>@handle</code>, a playlist or show link (or a video link with <code>list=</code>), or a channel or playlist ID. New
              videos arrive as articles with the player and description. YouTube’s feeds list the newest 15 videos, so older ones in a long
              playlist don’t appear.
            </span>
          </label>
          {folder.field}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="submit" disabled={busy} className={`${primaryButton} w-full py-2.5`}>
            {busy && <Loader2 size={15} className="animate-spin" />} {busy ? "Finding the channel…" : "Follow"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ImportPage({ onImported }: { onImported: () => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[560px] px-6 py-6 sm:px-8">
        <h1 className="mb-6 text-[17px] font-bold">Import feeds</h1>
        <OpmlTools onImported={onImported} />
      </div>
    </div>
  );
}
