import { body, error, intParam, json } from "@/lib/api";
import { deleteFilter, getFilter, normalizeFilter, reapplyFilters, saveFilter, setFilterEnabled } from "@/lib/filters";

/** `{ enabled }` alone toggles the filter; with `definition` it replaces it. Either way flags are recomputed. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/filters/[id]">) {
  const id = intParam((await ctx.params).id);
  const existing = id && getFilter(id);
  if (!existing) return error("Not found", 404);
  const b = await body<{ enabled: boolean; definition: unknown }>(req);
  try {
    if (b.definition === undefined) {
      if (b.enabled !== undefined) setFilterEnabled(existing.id, b.enabled);
    } else {
      saveFilter({ id: existing.id, enabled: b.enabled ?? existing.enabled, definition: normalizeFilter(b.definition) });
    }
    return json({ ok: true, changed: reapplyFilters() });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid filter");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/filters/[id]">) {
  const id = intParam((await ctx.params).id);
  if (!id) return error("Invalid id");
  deleteFilter(id);
  return json({ ok: true, changed: reapplyFilters() });
}
