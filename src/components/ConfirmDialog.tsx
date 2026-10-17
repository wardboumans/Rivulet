"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialog, dangerButton, primaryButton, secondaryButton } from "./ui";

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

// A tiny module-level store so any handler can `await confirmDialog(...)` without prop drilling.
let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** In-app replacement for window.confirm(). Resolves true when confirmed, false when cancelled or dismissed. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...options, resolve };
    emit();
  });
}

/** Renders the open confirm dialog, if any. Mount once near the app root. */
export function ConfirmHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
  if (!current) return null;

  const close = (ok: boolean) => {
    pending = null;
    emit();
    current.resolve(ok);
  };

  return (
    <Dialog title={current.title} onClose={() => close(false)} width={420}>
      {current.message && (
        <div className="text-sm leading-relaxed text-muted">
          {current.message}
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => close(false)}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => close(true)}
          className={current.danger ? dangerButton : primaryButton}
        >
          {current.confirmLabel ?? "OK"}
        </button>
      </div>
    </Dialog>
  );
}
