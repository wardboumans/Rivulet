import { error, intParam, json } from "@/lib/api";
import { fetchFullText } from "@/lib/fulltext";

export async function POST(_req: Request, ctx: RouteContext<"/api/articles/[id]/fulltext">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  try {
    return json({ html: await fetchFullText(id) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Full-text fetch failed", 502);
  }
}
