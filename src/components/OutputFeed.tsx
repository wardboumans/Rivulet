"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { Toggle } from "./Automations";
import { inputClass, secondaryButton } from "./ui";

/** Same token, different extension (see lib/outputFeeds.ts). */
const FORMATS = [
  { id: "rss", label: "RSS", ext: "" },
  { id: "json", label: "JSON Feed", ext: ".json" },
  { id: "opml", label: "OPML", ext: ".opml" },
] as const;

/**
 * The "Output feed" part of the tag and folder dialogs: a switch for the public feed, its link in
 * the chosen format (RSS, JSON Feed or OPML) with a copy button, and a way to replace the link.
 * `token` is the saved one; the link only exists once the switch has been saved.
 */
export function OutputFeedSection({
  kind,
  description,
  enabled,
  onEnabled,
  token,
  onRegenerate,
}: {
  kind: "tag" | "folder";
  description: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  token: string | null;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<(typeof FORMATS)[number]>(FORMATS[0]);
  const url =
    enabled && token
      ? `${window.location.origin}/feeds/${kind}/${token}${format.ext}`
      : null;
  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">Output feed</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <Toggle on={enabled} onChange={onEnabled} label="Output feed" />
      </div>
      {enabled &&
        (url ? (
          <div className="mt-3 space-y-2">
            <div
              role="radiogroup"
              aria-label="Feed format"
              className="inline-flex rounded-md border border-line p-0.5"
            >
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={format.id === f.id}
                  onClick={() => setFormat(f)}
                  className={`rounded px-3 py-1 text-xs font-semibold ${
                    format.id === f.id
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {format.id === "opml" && (
              <p className="text-xs text-muted">
                {kind === "folder"
                  ? "Lists this folder’s feeds, to subscribe to them in another reader."
                  : "Lists the tagged articles as links."}
              </p>
            )}
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className={`${inputClass} font-mono text-xs`}
                aria-label="Feed URL"
              />
              <button
                type="button"
                title="Copy link"
                onClick={async () => {
                  await navigator.clipboard.writeText(url).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={secondaryButton}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <p className="flex items-center gap-1 text-xs text-muted">
              Anyone with this link can read the feed.
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <RefreshCw size={12} /> New link
              </button>
              (the old one stops working)
            </p>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 rounded-md border border-line bg-sidebar px-3 py-2.5 text-sm font-semibold">
            <AlertTriangle size={16} className="shrink-0 text-[#d9a400]" />A
            link will be generated after saving.
          </p>
        ))}
    </div>
  );
}
