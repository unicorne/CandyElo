// Push the cached OFF data into Supabase.
// Run: pnpm seed:push

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type CachedCandy = {
  name: string;
  brand: string;
  image_url: string | null;
  kcal_100g: number | null;
  sugar_100g: number | null;
  fat_100g: number | null;
  ingredients_short: string | null;
};

const CACHE_PATH = path.join("scripts", "candies.cache.json");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const raw = await fs.readFile(CACHE_PATH, "utf8");
  const candies = JSON.parse(raw) as CachedCandy[];
  console.log(`Loaded ${candies.length} candies from cache.`);

  const sb = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Upsert by name (treat name as natural key for the seed).
  // First, fetch existing rows to decide insert vs update.
  const { data: existing, error: selErr } = await sb
    .from("candies")
    .select("id, name");
  if (selErr) {
    console.error("select failed:", selErr);
    process.exit(1);
  }
  const byName = new Map(existing?.map((r) => [r.name, r.id]) ?? []);

  // Only Open Food Facts images go into the DB. Anything else (Wikipedia,
  // Commons, hand-curated overrides pointing at non-OFF hosts) is treated as
  // "no image" — those entries are skipped on insert and have their image
  // cleared on update. The vote API filters image_url IS NULL, so they won't
  // appear in pairings until OFF data is available for them.
  const isOffImage = (url: string | null) =>
    !!url && /(images|static|world)\.openfoodfacts\.org/i.test(url);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const c of candies) {
    const useImage = isOffImage(c.image_url);
    const id = byName.get(c.name);
    if (id) {
      const update: Record<string, unknown> = { brand: c.brand };
      // Always reflect the image source: OFF wins, anything else clears it.
      update.image_url = useImage ? c.image_url : null;
      if (c.kcal_100g != null) update.kcal_100g = c.kcal_100g;
      if (c.sugar_100g != null) update.sugar_100g = c.sugar_100g;
      if (c.fat_100g != null) update.fat_100g = c.fat_100g;
      if (c.ingredients_short != null)
        update.ingredients_short = c.ingredients_short;
      const { error } = await sb.from("candies").update(update).eq("id", id);
      if (error) {
        console.error(`update ${c.name} failed:`, error.message);
        continue;
      }
      updated++;
    } else {
      if (!useImage) {
        skipped++;
        continue;
      }
      const payload = {
        name: c.name,
        brand: c.brand,
        image_url: c.image_url,
        kcal_100g: c.kcal_100g,
        sugar_100g: c.sugar_100g,
        fat_100g: c.fat_100g,
        ingredients_short: c.ingredients_short,
      };
      const { error } = await sb.from("candies").insert(payload);
      if (error) {
        console.error(`insert ${c.name} failed:`, error.message);
        continue;
      }
      inserted++;
    }
  }
  console.log(`Done. ${inserted} inserted, ${updated} updated, ${skipped} skipped (no OFF image).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
