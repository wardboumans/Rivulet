"use client";

import { useState } from "react";

import {
  AlertTriangle,
  Archive,
  Bookmark,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ListChecks,
  MoreHorizontal,
  Newspaper,
  RefreshCw,
  ScanSearch,
  Settings,
  Settings2,
  Tag as TagIcon,
  TagPlus,
} from "lucide-react";
import { formatCount } from "@/lib/client";
import type { Scope, Sidebar, SidebarFeed, SidebarFolder, SidebarMonitor, Tag } from "@/lib/types";
import { FeedIcon, Menu, type MenuItem } from "./ui";

export type SidebarActions = {
  select: (scope: Scope) => void;
  toggleFolder: (folder: SidebarFolder) => void;
  newFolder: () => void;
  refreshAll: () => void;
  openSettings: () => void;
  feedMenu: (feed: SidebarFeed) => MenuItem[];
  /** Opens the feed's refresh log (from the error icon). */
  feedLog: (feed: SidebarFeed) => void;
  folderMenu: (folder: SidebarFolder) => MenuItem[];
  monitorMenu: (monitor: SidebarMonitor) => MenuItem[];
};

function Row({
  active,
  onClick,
  icon,
  label,
  count,
  bold,
  indent,
  menu,
  error,
  onErrorClick,
  quiet,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  bold?: boolean;
  indent?: boolean;
  menu?: MenuItem[];
  error?: string | null;
  onErrorClick?: () => void;
  /** The count is a total, not unread: don't bold the row for it. */
  quiet?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className={`group relative mx-2 flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-md pr-2 text-[14px] leading-[30.8px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40 has-[[aria-expanded=true]]:bg-hover ${
        indent ? "pl-8" : "pl-2"
      } ${active ? "bg-active font-bold text-accent" : "text-fg hover:bg-hover"} ${count && !active && !quiet ? "font-bold" : ""} ${bold ? "font-bold" : ""}`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {error && (
        <button
          type="button"
          title={`Last refresh failed: ${error}`}
          aria-label="Last refresh failed, show refresh log"
          onClick={(e) => {
            e.stopPropagation();
            onErrorClick?.();
          }}
          className="rounded p-0.5 text-danger hover:bg-active"
        >
          <AlertTriangle size={14} />
        </button>
      )}
      {menu ? (
        <HoverMenu label={`${label} options`} items={menu} count={count} countClass={active ? "text-accent" : ""} />
      ) : (
        <span className={`text-xs font-normal text-muted ${active ? "text-accent" : ""}`}>{formatCount(count)}</span>
      )}
    </div>
  );
}

/**
 * Unread count that swaps for a ⋯ menu button on hover. While the menu is open the button stays
 * visible even if the pointer leaves the row, so the open menu doesn't vanish and reappear.
 */
function HoverMenu({ label, items, count, countClass = "" }: { label: string; items: MenuItem[]; count: number; countClass?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className={`text-xs font-normal text-muted ${open ? "hidden" : "group-hover:hidden"} ${countClass}`}>{formatCount(count)}</span>
      <span className={open ? "inline-flex" : "hidden group-hover:inline-flex"} onClick={(e) => e.stopPropagation()}>
        <Menu label={label} items={items} onOpenChange={setOpen} trigger={<MoreHorizontal size={16} className="text-muted hover:text-fg" />} />
      </span>
    </>
  );
}

function isActive(scope: Scope, kind: Scope["kind"], id?: number) {
  return scope.kind === kind && (id === undefined || ("id" in scope && scope.id === id));
}

export function SidebarPanel({ sidebar, scope, actions }: { sidebar: Sidebar | null; scope: Scope; actions: SidebarActions }) {
  const feedRow = (f: SidebarFeed, indent: boolean) => (
    <Row
      key={f.id}
      active={isActive(scope, "feed", f.id)}
      onClick={() => actions.select({ kind: "feed", id: f.id })}
      icon={<FeedIcon src={f.iconUrl} title={f.title} />}
      label={f.title}
      count={f.unread}
      indent={indent}
      error={f.lastError}
      onErrorClick={() => actions.feedLog(f)}
      menu={actions.feedMenu(f)}
    />
  );

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      <header className="flex h-12 shrink-0 items-center gap-1 px-4 pt-1">
        <h2 className="flex-1 text-[15px] font-bold">Feeds</h2>
        <button type="button" title="Settings" onClick={actions.openSettings} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
          <Settings2 size={18} />
        </button>
        <button type="button" title="New folder" onClick={actions.newFolder} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
          <FolderPlus size={18} />
        </button>
        <button type="button" title="Refresh all feeds" onClick={actions.refreshAll} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
          <RefreshCw size={17} className={sidebar?.refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6 pt-1">
        <Row
          active={isActive(scope, "all")}
          onClick={() => actions.select({ kind: "all" })}
          icon={<Newspaper size={18} className="shrink-0 text-muted" />}
          label="All articles"
          count={sidebar?.totalUnread ?? 0}
          bold
        />
        <div className="h-2" />

        {sidebar?.monitors.map((m) => (
          <Row
            key={`m${m.id}`}
            active={isActive(scope, "monitor", m.id)}
            onClick={() => actions.select({ kind: "monitor", id: m.id })}
            icon={<ScanSearch size={18} className="shrink-0 text-muted" />}
            label={m.name}
            count={m.unread}
            menu={actions.monitorMenu(m)}
          />
        ))}

        {sidebar?.unfiled.map((f) => feedRow(f, false))}

        {sidebar?.folders.map((folder) => (
          <div key={folder.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => actions.select({ kind: "folder", id: folder.id })}
              onKeyDown={(e) => e.key === "Enter" && actions.select({ kind: "folder", id: folder.id })}
              className={`group mx-2 flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md pl-1 pr-2 text-[14px] leading-[30.8px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-accent/40 has-[[aria-expanded=true]]:bg-hover ${
                isActive(scope, "folder", folder.id) ? "bg-active text-accent" : "hover:bg-hover"
              }`}
            >
              <button
                type="button"
                aria-label={folder.collapsed ? "Expand folder" : "Collapse folder"}
                onClick={(e) => {
                  e.stopPropagation();
                  actions.toggleFolder(folder);
                }}
                className="rounded p-0.5 text-muted hover:bg-active hover:text-fg"
              >
                {folder.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              <HoverMenu label={`${folder.name} options`} items={actions.folderMenu(folder)} count={folder.unread} />
            </div>
            {!folder.collapsed && folder.feeds.map((f) => feedRow(f, true))}
            {!folder.collapsed && !folder.feeds.length && <p className="py-1 pl-10 text-xs text-faint">Empty folder</p>}
          </div>
        ))}

        {sidebar && !sidebar.unfiled.length && !sidebar.folders.length && (
          <p className="px-5 py-6 text-sm leading-relaxed text-muted">No feeds yet. Use “Add feed” to follow a site, or import an OPML file in Settings.</p>
        )}
      </div>
    </aside>
  );
}

export type SavedActions = {
  select: (scope: Scope) => void;
  newTag: () => void;
  manageTags: () => void;
  tagMenu: (tag: Tag) => MenuItem[];
};

const headerButton = "rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg";

/** Replaces the feed sidebar while a Saved view (Read later, Archive, tags) is open. */
export function SavedPanel({
  sidebar,
  scope,
  actions,
}: {
  sidebar: Sidebar | null;
  scope: Scope;
  actions: SavedActions;
}) {
  const tags = sidebar?.tags ?? [];
  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      <header className="flex h-12 shrink-0 items-center gap-1 px-4 pt-1">
        <h2 className="flex-1 text-[15px] font-bold">Saved</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6 pt-1">
        <Row
          active={isActive(scope, "saved")}
          onClick={() => actions.select({ kind: "saved" })}
          icon={<Bookmark size={18} className="shrink-0 text-muted" />}
          label="Read later"
          count={sidebar?.savedCount ?? 0}
          quiet
        />
        <Row
          active={isActive(scope, "archive")}
          onClick={() => actions.select({ kind: "archive" })}
          icon={<Archive size={18} className="shrink-0 text-muted" />}
          label="Archive"
          count={sidebar?.archivedCount ?? 0}
          quiet
        />

        <div className="mx-4 my-3 border-t border-line" />

        <div className="flex h-10 items-center gap-1 px-4">
          <h2 className="flex-1 text-[15px] font-bold">Tags</h2>
          <button type="button" title="Manage tags" onClick={actions.manageTags} className={headerButton}>
            <Settings size={18} />
          </button>
          <button type="button" title="New tag" onClick={actions.newTag} className={headerButton}>
            <TagPlus size={18} />
          </button>
        </div>

        <Row
          active={isActive(scope, "tagged")}
          onClick={() => actions.select({ kind: "tagged" })}
          icon={<ListChecks size={18} className="shrink-0 text-muted" />}
          label="All tagged articles"
          count={0}
          quiet
        />
        {tags.map((t) => (
          <Row
            key={t.id}
            active={isActive(scope, "tag", t.id)}
            onClick={() => actions.select({ kind: "tag", id: t.id })}
            icon={<TagIcon size={18} className="shrink-0 text-muted" />}
            label={t.name}
            count={t.count}
            quiet
            menu={actions.tagMenu(t)}
          />
        ))}
        {sidebar && !tags.length && (
          <p className="px-5 py-3 text-sm leading-relaxed text-muted">
            No tags yet. Use the tag button above an article, or an automation rule, to tag articles.
          </p>
        )}
      </div>
    </aside>
  );
}
