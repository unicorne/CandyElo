// Cloudflare Turnstile helpers.
// In environments where TURNSTILE_SECRET_KEY isn't set (local dev),
// turnstile is treated as optional — vote API will skip the check.
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "ce_human";
const TTL_SECONDS = 60 * 60 * 24; // 1 day

let secret: Uint8Array | null = null;
function jwtSecret(): Uint8Array {
  if (secret) return secret;
  const raw = process.env.PAIR_TOKEN_SECRET;
  if (!raw) throw new Error("PAIR_TOKEN_SECRET not set");
  secret = new TextEncoder().encode(raw);
  return secret;
}

export const TURNSTILE_REQUIRED = Boolean(
  process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
);

export const HUMAN_COOKIE = COOKIE;
export const HUMAN_COOKIE_MAX_AGE = TTL_SECONDS;

export async function verifyTurnstileToken(token: string, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true as const };
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!res.ok) return { ok: false as const, error: `cf-${res.status}` };
  const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
  if (!data.success) {
    return {
      ok: false as const,
      error: data["error-codes"]?.join(",") ?? "verify-failed",
    };
  }
  return { ok: true as const };
}

export async function issueHumanCookie() {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("candyelo")
    .setAudience("human")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(jwtSecret());
}

export async function isHumanCookieValid(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, jwtSecret(), {
      issuer: "candyelo",
      audience: "human",
    });
    return true;
  } catch {
    return false;
  }
}
