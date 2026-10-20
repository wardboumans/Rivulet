import { body, error, json } from "@/lib/api";
import { createTag, listTags } from "@/lib/tags";

export function GET() {
  return json(listTags());
}

export async function POST(req: Request) {
  const b = await body<{ name: string; outputFeed: boolean }>(req);
  try {
    return json(createTag({ name: b.name, outputFeed: b.outputFeed }), 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Could not create tag");
  }
}
