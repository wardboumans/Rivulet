"use client";

import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Newspaper,
  Plus,
  Search,
  Settings,
  Sun,
  SunMoon,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { compactCount } from "@/lib/client";

export type Theme = "system" | "light" | "dark";

function RailButton({
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`group flex w-full flex-col items-center gap-1 py-2 text-[11px] ${active ? "text-white" : "text-rail-fg hover:text-white"}`}
    >
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-white/15" : "group-hover:bg-white/10"}`}
      >
        {icon}
        {!!badge && (
          <span className="absolute -right-2 -top-1 rounded-full bg-[#5c5a57] px-1.5 text-[10px] font-semibold leading-4 text-white">
            {compactCount(badge)}
          </span>
        )}
      </span>
      {label}
    </button>
  );
}

export function Rail({
  view,
  totalUnread,
  savedCount,
  theme,
  sidebarCollapsed,
  onFeeds,
  onSaved,
  onSearch,
  onAutomate,
  onAdd,
  onSettings,
  onTheme,
  onToggleSidebar,
}: {
  view: "feeds" | "saved" | "search" | "add" | "automate" | "settings";
  totalUnread: number;
  savedCount: number;
  theme: Theme;
  sidebarCollapsed: boolean;
  onFeeds: () => void;
  onSaved: () => void;
  onSearch: () => void;
  onAutomate: () => void;
  onAdd: () => void;
  onSettings: () => void;
  onTheme: () => void;
  onToggleSidebar?: () => void;
}) {
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;
  return (
    <nav className="flex h-full w-[73px] shrink-0 flex-col items-center bg-rail pb-3 pt-3">
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center"
        aria-label="Rivulet"
      >
        <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
          <circle cx="16" cy="16" r="15" fill="#fff" />
          <path
            d="M9 21c4-1 6-4 8-7s4-5 7-6"
            fill="none"
            stroke="#3d3b39"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="10" cy="22" r="2.2" fill="#229e8c" />
        </svg>
      </div>
      <RailButton
        label="Feeds"
        icon={<Newspaper size={20} />}
        active={view === "feeds"}
        badge={totalUnread}
        onClick={onFeeds}
      />
      <RailButton
        label="Saved"
        icon={<Bookmark size={20} />}
        active={view === "saved"}
        badge={savedCount}
        onClick={onSaved}
      />
      <RailButton
        label="Automate"
        icon={<Zap size={20} />}
        active={view === "automate"}
        onClick={onAutomate}
      />
      <RailButton
        label="Search"
        icon={<Search size={20} />}
        active={view === "search"}
        onClick={onSearch}
      />
      <RailButton
        label="Add feed"
        icon={<Plus size={22} />}
        active={view === "add"}
        onClick={onAdd}
      />
      <div className="flex-1" />
      <RailButton
        label={
          theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"
        }
        icon={<ThemeIcon size={20} />}
        onClick={onTheme}
      />
      <RailButton
        label="Settings"
        icon={<Settings size={20} />}
        active={view === "settings"}
        onClick={onSettings}
      />
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          className="mt-2 flex h-8 w-10 items-center justify-center rounded-md bg-white/10 text-rail-fg hover:text-white"
        >
          {sidebarCollapsed ? (
            <ChevronsRight size={18} />
          ) : (
            <ChevronsLeft size={18} />
          )}
        </button>
      )}
    </nav>
  );
}
