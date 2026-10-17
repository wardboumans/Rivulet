import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server.js + traced node_modules in .next/standalone, used by the Docker image.
  output: "standalone",
  // better-sqlite3 loads its native binary from prebuilds/<platform>.node through an indirect
  // require that file tracing can't follow, so include it explicitly.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/better-sqlite3/prebuilds/*.node"],
  },
  // Note: tracing follows the default DB path in lib/db.ts, so a local build copies ./data into
  // .next/standalone. It never reaches the Docker image: data/ is in .gitignore and .dockerignore.
  // better-sqlite3 and jsdom are on Next's built-in external list; listed here to be explicit.
  serverExternalPackages: ["better-sqlite3", "jsdom", "@mozilla/readability"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
