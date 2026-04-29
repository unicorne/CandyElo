// Aggregate stats for the landing hero: total votes, total candies, current
// #1, and a recent random pair to preview the experience.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 30; // cache for 30s — landing hero doesn't need real-time

export async function GET() {
  const sb = supabaseAdmin();

  const [votesCount, candiesCount, top1, randomTwo] = await Promise.all([
    sb.from("votes").select("id", { count: "exact", head: true }),
    sb.from("candies").select("id", { count: "exact", head: true }),
    sb
      .from("candies")
      .select("id, name, brand, image_url, elo, matches")
      .order("elo", { ascending: false })
      .limit(1)
      .single(),
    sb
      .from("candies")
      .select("id, name, brand, image_url")
      .not("image_url", "is", null)
      .limit(50),
  ]);

  // Random pair from the pool we read.
  const pool = randomTwo.data ?? [];
  const i = Math.floor(Math.random() * pool.length);
  let j = Math.floor(Math.random() * Math.max(1, pool.length - 1));
  if (j >= i) j++;
  const previewA = pool[i] ?? null;
  const previewB = pool[j] ?? null;

  return NextResponse.json({
    votes: votesCount.count ?? 0,
    candies: candiesCount.count ?? 0,
    leader: top1.data ?? null,
    previewPair: previewA && previewB ? { a: previewA, b: previewB } : null,
  });
}
