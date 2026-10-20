import { error, intParam, json } from "@/lib/api";
import { suggestTags } from "@/lib/tags";

export async function GET(_req: Request, ctx: RouteContext<"/api/articles/[id]/tags/suggest">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  try {
    return json(await suggestTags(id));
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not suggest tags", 404);
  }
}
