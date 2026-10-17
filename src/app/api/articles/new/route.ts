import { error, json } from "@/lib/api";
import { checkNewArticles, parseScope } from "@/lib/queries";
import type { NextRequest } from "next/server";

/** GET ?scope=…&after=<highWater>[&unread=1] → articles in the scope that arrived after `after`. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const scope = parseScope(p);
  const after = Number(p.get("after"));
  if (!scope || !Number.isInteger(after) || after < 0) return error("Invalid request");
  return json(checkNewArticles(scope, after, p.get("unread") === "1"));
}
