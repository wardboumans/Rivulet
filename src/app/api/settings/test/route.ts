import { body, error, json } from "@/lib/api";
import { sendTestNotification } from "@/lib/automations";

/** Send a sample email or push notification with the saved credentials. */
export async function POST(req: Request) {
  const b = await body<{ channel: "email" | "pushover"; to: string }>(req);
  if (b.channel !== "email" && b.channel !== "pushover") return error("Unknown channel");
  try {
    await sendTestNotification(b.channel, b.to?.trim());
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Test failed", 502);
  }
}
