import { body, error, intParam, json } from "@/lib/api";
import { getArticle, setArticleState } from "@/lib/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/articles/[id]">) {
  const id = intParam((await ctx.params).id);
  const article = id && getArticle(id);
  return article ? json(article) : error("Not found", 404);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/articles/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  const { isRead, isSaved, isArchived } = await body<{ isRead: boolean; isSaved: boolean; isArchived: boolean }>(req);
  setArticleState(id, { isRead, isSaved, isArchived });
  return json({ ok: true });
}
