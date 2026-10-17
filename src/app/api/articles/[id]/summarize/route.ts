import { error, intParam } from "@/lib/api";
import { hasOpenRouterKey, streamSummary } from "@/lib/summarize";

export async function POST(_req: Request, ctx: RouteContext<"/api/articles/[id]/summarize">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  if (!hasOpenRouterKey()) return error("Add an OpenRouter API key in Settings → AI summaries to enable summaries", 503);
  try {
    const stream = await streamSummary(id);
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Summary failed", 502);
  }
}
