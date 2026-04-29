// Returns a fresh random pair of candies plus a signed pair-token.
// The token must be sent back to /api/vote together with the winner+loser.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { signPairToken } from "@/lib/security/pair-token";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  newSessionId,
} from "@/lib/security/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandyDTO = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  kcal_100g: number | null;
  sugar_100g: number | null;
  fat_100g: number | null;
  ingredients_short: string | null;
};

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();

  // Pull a candy pool sized for variety, pick two distinct random rows in JS.
  // (Postgres `random()` per query would force a full scan; with ~55 rows it
  // doesn't matter, but keeping the API stable for larger sets.)
  const { data: candies, error } = await sb
    .from("candies")
    .select("id, name, brand, image_url, kcal_100g, sugar_100g, fat_100g, ingredients_short")
    .not("image_url", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candies || candies.length < 2) {
    return NextResponse.json({ error: "not enough candies seeded" }, { status: 503 });
  }

  // Optional bias: avoid showing the same candy twice in a row by reading
  // the `excludeA` query param (the loser of the previous round, sent by UI).
  const excludeA = req.nextUrl.searchParams.get("excludeA");
  const excludeB = req.nextUrl.searchParams.get("excludeB");

  const pool = candies.filter(
    (c) => c.id !== excludeA && c.id !== excludeB,
  );
  const source = pool.length >= 2 ? pool : candies;

  const i = Math.floor(Math.random() * source.length);
  let j = Math.floor(Math.random() * (source.length - 1));
  if (j >= i) j++;
  const a = source[i] as CandyDTO;
  const b = source[j] as CandyDTO;

  const token = await signPairToken(a.id, b.id);

  const res = NextResponse.json({ a, b, token });

  if (!req.cookies.get(SESSION_COOKIE)) {
    res.cookies.set(SESSION_COOKIE, newSessionId(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }

  return res;
}
