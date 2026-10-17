import { getDb } from "./db";
import { htmlToText } from "./html";
import { DEFAULT_SUMMARY_PROMPT, getCredential, getSettings } from "./settings";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_INPUT_CHARS = 24000;

export function hasOpenRouterKey() {
  return !!getCredential("openrouterApiKey");
}

/**
 * Stream a summary from OpenRouter as plain text chunks. The full summary is cached on the
 * article once the stream completes.
 */
export async function streamSummary(articleId: number): Promise<ReadableStream<Uint8Array>> {
  const key = getCredential("openrouterApiKey");
  if (!key) throw new Error("No OpenRouter API key: add one in Settings → AI summaries");

  const db = getDb();
  const a = db.prepare("SELECT id, title, content, full_content FROM articles WHERE id = ?").get(articleId) as
    | { id: number; title: string; content: string | null; full_content: string | null }
    | undefined;
  if (!a) throw new Error("Article not found");

  const text = htmlToText(a.full_content || a.content || "").slice(0, MAX_INPUT_CHARS);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Rivulet",
    },
    body: JSON.stringify({
      model: getSettings().openrouterModel,
      stream: true,
      messages: [
        {
          role: "system",
          content: getSettings().summaryPrompt.trim() || DEFAULT_SUMMARY_PROMPT,
        },
        { role: "user", content: `Title: ${a.title}\n\n${text}` },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 200)}`);
  }

  const upstream = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();
  let buffer = "";
  let full = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await upstream.read();
        if (done) {
          if (full.trim()) db.prepare("UPDATE articles SET summary = ? WHERE id = ?").run(full.trim(), a.id);
          controller.close();
          return;
        }
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        let emitted = false;
        for (const line of lines) {
          // OpenRouter sends ": OPENROUTER PROCESSING" keepalive comments; only `data:` lines carry payloads.
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            if (json.error) throw new Error(json.error.message ?? "OpenRouter stream error");
            const delta: string | undefined = json.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              controller.enqueue(encoder.encode(delta));
              emitted = true;
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            controller.error(e);
            return;
          }
        }
        if (emitted) return;
      }
    },
    cancel() {
      upstream.cancel().catch(() => {});
    },
  });
}
