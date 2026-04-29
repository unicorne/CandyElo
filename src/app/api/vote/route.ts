// Cast a vote. Validates a server-signed pair token, applies rate limits,
// then calls the SECURITY DEFINER `cast_vote` Postgres function which updates
// ELO and inserts the row in one transaction.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPairToken } from "@/lib/security/pair-token";
import { checkVoteLimits } from "@/lib/security/rate-limit";
import {
  HUMAN_COOKIE,
  TURNSTILE_REQUIRED,
  isHumanCookieValid,
} from "@/lib/security/turnstile";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getClientIp,
  hashIp,
  newSessionId,
} from "@/lib/security/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  winnerId?: string;
  loserId?: string;
  token?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { winnerId, loserId, token } = body;
  if (!winnerId || !loserId || !token) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (winnerId === loserId) {
    return NextResponse.json({ error: "winner==loser" }, { status: 400 });
  }

  // 1. Verify pair token (signature, expiry, matches the candies)
  try {
    await verifyPairToken(token, winnerId, loserId);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid pair token", detail: (e as Error).message },
      { status: 401 },
    );
  }

  // 1b. Turnstile (only enforced when keys are configured)
  if (TURNSTILE_REQUIRED) {
    const human = req.cookies.get(HUMAN_COOKIE)?.value;
    if (!(await isHumanCookieValid(human))) {
      return NextResponse.json({ error: "turnstile-required" }, { status: 403 });
    }
  }

  // 2. Rate limit by IP
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const limit = await checkVoteLimits(ipHash);
  if (!limit.ok) {
    return NextResponse.json(
      { error: limit.reason },
      { status: 429 },
    );
  }

  // 3. Identify session
  let session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) session = newSessionId();

  // 4. Cast the vote (DB function does ELO update + insert atomically)
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cast_vote", {
    p_winner_id: winnerId,
    p_loser_id: loserId,
    p_voter_session: session,
    p_voter_ip_hash: ipHash,
    p_pair_token: token.slice(0, 64), // truncate stored token for size
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  const res = NextResponse.json({
    ok: true,
    result: row,
    remaining: limit.remaining,
  });

  if (!req.cookies.get(SESSION_COOKIE)) {
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }

  return res;
}
