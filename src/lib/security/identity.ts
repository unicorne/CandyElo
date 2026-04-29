// Anonymous voter identity helpers.
// - voter_session: opaque cookie set on first request (UUID). Persists across page loads.
// - voter_ip_hash: SHA-256(pepper + ip), so we never store raw IPs.

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ce_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1y

function getPepper(): string {
  const p = process.env.IP_HASH_PEPPER;
  if (!p) throw new Error("IP_HASH_PEPPER not set");
  return p;
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "0.0.0.0";
}

export function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(getPepper() + ":" + ip)
    .digest("hex")
    .slice(0, 32);
}

export function newSessionId(): string {
  return crypto.randomUUID();
}
