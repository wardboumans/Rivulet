import { error, intParam, json } from "@/lib/api";
import { feedProperties } from "@/lib/queries";

/** Details, stats, linked automations and refresh log for the feed properties dialog. */
export async function GET(_req: Request, ctx: RouteContext<"/api/feeds/[id]/properties">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  const props = feedProperties(id);
  return props ? json(props) : error("Feed not found", 404);
}
