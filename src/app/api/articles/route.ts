import { error, json } from "@/lib/api";
import { listArticles, parseScope } from "@/lib/queries";
import type { NextRequest } from "next/server";

export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const scope = parseScope(p);
  if (!scope) return error("Invalid scope");
  return json(
    listArticles(scope, {
      unreadOnly: p.get("unread") === "1",
      oldestFirst: p.get("sort") === "oldest",
      cursor: p.get("cursor"),
    }),
  );
}
