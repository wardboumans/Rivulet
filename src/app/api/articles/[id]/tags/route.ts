import { body, error, intParam, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { articleTags, ensureTag, getTag, tagArticles, untagArticle } from "@/lib/tags";

/**
 * Add or remove one tag: `{ add: { tagId } | { name } }` or `{ remove: tagId }`. Adding by name
 * creates the tag if it doesn't exist. Returns the article's tags.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/articles/[id]/tags">) {
  const id = intParam((await ctx.params).id);
  if (!id || !getDb().prepare("SELECT 1 FROM articles WHERE id = ?").get(id)) return error("Not found", 404);
  const b = await body<{ add: { tagId?: number; name?: string }; remove: number }>(req);
  try {
    if (b.add) {
      const tagId = b.add.tagId && getTag(b.add.tagId) ? b.add.tagId : ensureTag(b.add.name);
      tagArticles(tagId, [id]);
    }
    if (b.remove) untagArticle(b.remove, id);
    return json({ tags: articleTags(id) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not update tags");
  }
}
