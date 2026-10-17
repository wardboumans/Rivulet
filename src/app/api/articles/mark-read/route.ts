import { body, error, json } from "@/lib/api";
import { markScopeRead, parseScope } from "@/lib/queries";

export async function POST(req: Request) {
  const b = await body<{ scope: string; id: number; q: string; maxId: number; olderThanMs: number }>(req);
  const scope = parseScope(b as Record<string, unknown>);
  if (!scope) return error("Invalid scope");
  const changed = markScopeRead(scope, { maxId: b.maxId, olderThanMs: b.olderThanMs });
  return json({ changed });
}
