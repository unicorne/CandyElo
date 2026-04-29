// Verify a Cloudflare Turnstile token, then mint a 24h "human" cookie that the
// vote API checks. Used only on the first visit; the cookie suppresses future
// challenges within the same browser.
import { NextResponse, type NextRequest } from "next/server";
import {
  HUMAN_COOKIE,
  HUMAN_COOKIE_MAX_AGE,
  TURNSTILE_REQUIRED,
  issueHumanCookie,
  verifyTurnstileToken,
} from "@/lib/security/turnstile";
import { getClientIp } from "@/lib/security/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!TURNSTILE_REQUIRED) {
    // Dev mode: just hand out a cookie.
    const cookie = await issueHumanCookie();
    const res = NextResponse.json({ ok: true, dev: true });
    res.cookies.set(HUMAN_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: HUMAN_COOKIE_MAX_AGE,
    });
    return res;
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }
  const result = await verifyTurnstileToken(body.token, getClientIp(req));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  const cookie = await issueHumanCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HUMAN_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HUMAN_COOKIE_MAX_AGE,
  });
  return res;
}
