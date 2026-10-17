"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  CheckCheck,
  ChevronDown,
  Loader2,
  Menu as MenuIcon,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { timeAgo } from "@/lib/client";
import type { ArticleListItem } from "@/lib/types";
import {
  FeedIcon,
  Menu,
  type MenuItem,
  primaryButton,
  secondaryButton,
} from "./ui";

export type ListLayout = "titles" | "magazine";

/** Article thumbnail; falls back to a tile with the feed's icon when there's no image or it fails to load. */
function Thumb({
  src,
  size,
  feedIcon,
  feedTitle,
}: {
  src: string | null;
  size: "sm" | "lg";
  feedIcon: string | null;
  feedTitle: string;
}) {
  const [failed, setFailed] = useState(false);
  const cls = size === "sm" ? "h-[68px] w-[68px]" : "h-[96px] w-[136px]";
  if (!src || failed) {
    return (
      <div
        className={`${cls} flex shrink-0 items-center justify-center rounded-[4px] bg-hover`}
        aria-hidden
      >
        <span className="opacity-60 grayscale-[30%]">
          <FeedIcon
            src={feedIcon}
            title={feedTitle}
            size={size === "sm" ? 26 : 32}
          />
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${cls} shrink-0 rounded-[4px] bg-hover object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

function Row({
  a,
  selected,
  layout,
  showFeed,
  onSelect,
  onToggleSave,
  onToggleRead,
}: {
  a: ArticleListItem;
  selected: boolean;
  layout: ListLayout;
  showFeed: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
  onToggleRead: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-current={selected}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group flex cursor-pointer gap-3 border-b border-l-2 border-b-line px-2.5 py-2 outline-none focus-visible:bg-hover ${
        selected
          ? "border-l-accent bg-selected"
          : "border-l-transparent hover:bg-hover"
      }`}
    >
      <Thumb
        src={a.imageUrl}
        size={layout === "titles" ? "sm" : "lg"}
        feedIcon={a.feedIcon}
        feedTitle={a.feedTitle}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3
          className={`line-clamp-2 text-[14px] leading-[1.3] ${a.isRead ? "font-medium text-muted" : "font-bold text-fg"}`}
        >
          {a.title}
        </h3>
        {layout === "magazine" && a.excerpt && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">
            {a.excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-[12px] text-muted">
          {showFeed && (
            <FeedIcon src={a.feedIcon} title={a.feedTitle} size={13} />
          )}
          <span className="truncate">
            {showFeed ? a.feedTitle : a.author || a.feedTitle}
          </span>
          <span aria-hidden>·</span>
          <span
            className="shrink-0"
            title={new Date(a.publishedAt).toLocaleString()}
          >
            {timeAgo(a.publishedAt)}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            title={a.isRead ? "Mark as unread" : "Mark as read"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead();
            }}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-active"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${a.isRead ? "bg-[var(--line)] ring-1 ring-faint/40" : "bg-accent"}`}
            />
          </button>
          <button
            type="button"
            title={a.isSaved ? "Remove from Saved" : "Save for later"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-active ${a.isSaved ? "text-accent" : "text-muted"}`}
          >
            <Bookmark size={15} fill={a.isSaved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ArticleList(props: {
  title: string;
  titleMenu?: MenuItem[];
  unread: number;
  items: ArticleListItem[];
  selectedId: number | null;
  loading: boolean;
  hasMore: boolean;
  unreadOnly: boolean;
  layout: ListLayout;
  showFeed: boolean;
  viewMenu: MenuItem[];
  markMenu: MenuItem[];
  searchQuery: string | null;
  /** Articles in this view that arrived after the list loaded. */
  newCount: number;
  onSearch: (q: string) => void;
  onCloseSearch: () => void;
  onLoadMore: () => void;
  onSelect: (a: ArticleListItem) => void;
  onToggleSave: (a: ArticleListItem) => void;
  onToggleRead: (a: ArticleListItem) => void;
  onMarkAllRead: () => void;
  onShowAll: () => void;
  onReload: () => void;
  onOpenNav?: () => void;
  emptyHint?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const { hasMore, loading, onLoadMore } = props;

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // Root must be the scroll container: with the viewport as root, the container's clipping
    // swallows rootMargin and the sentinel never counts as intersecting near the bottom edge.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) onLoadMore();
      },
      { root: scroller.current, rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    if (props.searchQuery === "") searchInput.current?.focus();
  }, [props.searchQuery]);

  const isSearch = props.searchQuery !== null;

  return (
    <section className="flex h-full min-w-0 flex-col bg-bg">
      <header className="flex h-[52px] shrink-0 items-center gap-1 border-b border-line px-2">
        {props.onOpenNav && (
          <button
            type="button"
            onClick={props.onOpenNav}
            aria-label="Open feeds"
            className="rounded-md p-2 text-muted hover:bg-hover md:hidden"
          >
            <MenuIcon size={20} />
          </button>
        )}
        {isSearch ? (
          <form
            className="flex flex-1 items-center gap-2 rounded-md border border-line bg-sidebar px-2.5 focus-within:border-accent"
            onSubmit={(e) => {
              e.preventDefault();
              props.onSearch(
                String(new FormData(e.currentTarget).get("q") ?? ""),
              );
            }}
          >
            <Search size={16} className="shrink-0 text-muted" />
            <input
              ref={searchInput}
              name="q"
              defaultValue={props.searchQuery ?? ""}
              key={props.searchQuery}
              placeholder="Search all articles…"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={props.onCloseSearch}
              className="text-muted hover:text-fg"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <div className="min-w-0 flex-1 pl-1">
            <div className="flex items-center gap-1">
              <h1 className="truncate text-[17px] font-bold leading-tight">
                {props.title}
              </h1>
              {props.titleMenu && (
                <Menu
                  label="Feed options"
                  align="left"
                  items={props.titleMenu}
                  trigger={
                    <ChevronDown
                      size={16}
                      className="text-muted hover:text-fg"
                    />
                  }
                />
              )}
            </div>
            <p className="text-[12px] leading-tight text-muted">
              {props.unread ? `${props.unread} unread` : "All read"}
            </p>
          </div>
        )}
        {!isSearch && (
          <div className="flex items-center rounded-md bg-hover/60">
            <button
              type="button"
              title="Mark all as read"
              onClick={props.onMarkAllRead}
              className="flex h-9 w-9 items-center justify-center rounded-l-md text-muted hover:bg-active hover:text-fg"
            >
              <CheckCheck size={18} />
            </button>
            <Menu
              label="Mark as read options"
              items={props.markMenu}
              trigger={
                <span className="flex h-9 w-7 items-center justify-center rounded-r-md text-muted hover:bg-active hover:text-fg">
                  <ChevronDown size={15} />
                </span>
              }
            />
          </div>
        )}
        <Menu
          label="View options"
          items={props.viewMenu}
          trigger={
            <span className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg">
              <MoreHorizontal size={18} />
            </span>
          }
        />
      </header>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {props.newCount > 0 && (
          <button
            type="button"
            onClick={() => {
              scroller.current?.scrollTo({ top: 0 });
              props.onReload();
            }}
            className="sticky top-2 z-10 mx-auto mt-2 block rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg shadow-pop hover:bg-accent-hover"
          >
            {props.newCount === 1
              ? "1 new article"
              : `${props.newCount} new articles`}{" "}
            · Show
          </button>
        )}

        {props.items.map((a) => (
          <Row
            key={a.id}
            a={a}
            selected={a.id === props.selectedId}
            layout={props.layout}
            showFeed={props.showFeed}
            onSelect={() => props.onSelect(a)}
            onToggleSave={() => props.onToggleSave(a)}
            onToggleRead={() => props.onToggleRead(a)}
          />
        ))}

        <div ref={sentinel} />

        {props.loading && (
          <div className="flex justify-center py-8 text-muted">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}

        {!props.loading && !props.hasMore && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            {isSearch && !props.searchQuery ? (
              <p className="text-muted">
                Search titles and text across all your feeds.
              </p>
            ) : props.items.length === 0 && isSearch ? (
              <p className="text-muted">
                No articles match “{props.searchQuery}”.
              </p>
            ) : props.items.length === 0 && props.emptyHint ? (
              props.emptyHint
            ) : (
              <>
                <p className="mb-6 text-[15px] text-muted">
                  {props.unreadOnly
                    ? "No more unread articles here."
                    : "You’ve reached the end."}
                </p>
                {props.unread > 0 && (
                  <button
                    type="button"
                    onClick={props.onMarkAllRead}
                    className={`${primaryButton} w-56 py-2.5`}
                  >
                    Mark section as read
                  </button>
                )}
                {props.unreadOnly && (
                  <button
                    type="button"
                    onClick={props.onShowAll}
                    className={`${secondaryButton} w-56 py-2.5`}
                  >
                    See all articles
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
