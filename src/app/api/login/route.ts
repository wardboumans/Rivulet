import { NextResponse } from "next/server";
import { body, error } from "@/lib/api";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true });
  const { password } = await body<{ password: string }>(req);
  if (password !== expected) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    return error("Wrong password", 401);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
