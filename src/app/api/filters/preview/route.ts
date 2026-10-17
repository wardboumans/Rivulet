import { body, json } from "@/lib/api";
import { previewFilter, normalizeFilter } from "@/lib/filters";

/** Preview a filter as edited. Incomplete drafts (no conditions yet) preview as hiding nothing. */
export async function POST(req: Request) {
  const b = await body<{ definition: unknown }>(req);
  try {
    return json(previewFilter(normalizeFilter(b.definition)));
  } catch {
    return json({ checked: 0, hidden: 0, samples: [] });
  }
}
