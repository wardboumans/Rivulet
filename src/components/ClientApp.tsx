"use client";

import dynamic from "next/dynamic";

// The reader is entirely client-driven and reads preferences from localStorage on first render,
// so skip SSR rather than rendering a placeholder that would mismatch on hydration.
export const ClientApp = dynamic(() => import("./AppShell").then((m) => m.AppShell), { ssr: false });
