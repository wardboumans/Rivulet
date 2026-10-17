import { body, error, json } from "@/lib/api";
import { listFilters, normalizeFilter, reapplyFilters, saveFilter } from "@/lib/filters";

export function GET() {
  return json(listFilters());
}

export async function POST(req: Request) {
  const b = await body<{ enabled: boolean; definition: unknown }>(req);
  try {
    const id = saveFilter({ enabled: b.enabled ?? true, definition: normalizeFilter(b.definition) });
    return json({ id, changed: reapplyFilters() }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid filter");
  }
}
