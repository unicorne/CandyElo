// Fetch Open Food Facts data for the seed list and cache it to JSON.
// Run: pnpm seed:fetch
//
// We do a simple text search per candy, filter results that mention the brand,
// and pick the first hit with a kcal_100g value. Misses are reported and
// stored as `null` so we can re-run the script later with hand-tuned queries.

import fs from "node:fs/promises";
import path from "node:path";
import { CANDY_LIST, type SeedCandy } from "./candy-list";

const UA = "CandyElo/0.1 (+https://github.com/unicorne/CandyElo)";
const CACHE_PATH = path.join("scripts", "candies.cache.json");

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  generic_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  ingredients_text_de?: string;
  ingredients_text?: string;
  nutriments?: Record<string, number | string | undefined>;
};

type CachedCandy = {
  name: string;
  brand: string;
  image_url: string | null;
  kcal_100g: number | null;
  sugar_100g: number | null;
  fat_100g: number | null;
  ingredients_short: string | null;
  source_code: string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function shortIngredients(p: OffProduct): string | null {
  const raw = p.ingredients_text_de || p.ingredients_text || "";
  if (!raw) return null;
  const parts = raw
    .replace(/\s+/g, " ")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

function normalize(s: string | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pick(seed: SeedCandy, products: OffProduct[]): OffProduct | null {
  const brandKey = normalize(seed.brand);
  const nameKey = normalize(seed.name);
  const nameTokens = nameKey.split(" ").filter((t) => t.length > 2);

  const score = (p: OffProduct): number => {
    const brands = normalize(p.brands);
    const productName = normalize(
      p.product_name_de || p.product_name || p.generic_name,
    );
    const kcal = num(p.nutriments?.["energy-kcal_100g"]);
    if (kcal == null || kcal < 150 || kcal > 700) return -1; // candy band
    let s = 0;
    if (brands && (brands.includes(brandKey) || brandKey.includes(brands))) s += 4;
    const matchedTokens = nameTokens.filter((t) => productName.includes(t));
    s += matchedTokens.length * 2;
    if (matchedTokens.length === 0) return -1; // require at least one name token
    return s;
  };

  let best: { p: OffProduct; s: number } | null = null;
  for (const p of products) {
    const s = score(p);
    if (s < 0) continue;
    if (!best || s > best.s) best = { p, s };
  }
  return best?.p ?? null;
}

// For barcode lookups we trust the barcode but still sanity-check the kcal range.
function pickByBarcode(p: OffProduct): OffProduct | null {
  const kcal = num(p.nutriments?.["energy-kcal_100g"]);
  if (kcal == null || kcal < 150 || kcal > 700) return null;
  return p;
}

async function fetchWithRetry(url: string, attempts = 5): Promise<Response | null> {
  let delay = 1500;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      return res;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  return null;
}

async function searchOff(seed: SeedCandy): Promise<OffProduct[]> {
  if (seed.barcode) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${seed.barcode}.json`;
    const res = await fetchWithRetry(url);
    if (res?.ok) {
      const json = (await res.json()) as { product?: OffProduct; status?: number };
      // status === 0 means "product not found"
      if (json.product && json.status !== 0) return [json.product];
    }
  }
  // Try the v2 search API first (cleaner and less rate-limited).
  const v2 = new URL("https://world.openfoodfacts.org/api/v2/search");
  v2.searchParams.set("search_terms", seed.query);
  v2.searchParams.set("page_size", "12");
  v2.searchParams.set(
    "fields",
    [
      "code",
      "product_name",
      "product_name_de",
      "generic_name",
      "brands",
      "image_front_url",
      "image_url",
      "ingredients_text_de",
      "ingredients_text",
      "nutriments",
    ].join(","),
  );
  const v2res = await fetchWithRetry(v2.toString());
  if (v2res?.ok) {
    const json = (await v2res.json()) as { products?: OffProduct[] };
    if (json.products && json.products.length > 0) return json.products;
  }

  // Fallback: legacy CGI search
  const cgi = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  cgi.searchParams.set("search_terms", seed.query);
  cgi.searchParams.set("search_simple", "1");
  cgi.searchParams.set("action", "process");
  cgi.searchParams.set("json", "1");
  cgi.searchParams.set("page_size", "12");
  cgi.searchParams.set(
    "fields",
    [
      "code",
      "product_name",
      "product_name_de",
      "generic_name",
      "brands",
      "image_front_url",
      "image_url",
      "ingredients_text_de",
      "ingredients_text",
      "nutriments",
    ].join(","),
  );
  const cgiRes = await fetchWithRetry(cgi.toString());
  if (!cgiRes?.ok) {
    console.warn(`  ! OFF ${cgiRes?.status ?? "fail"} for ${seed.name}`);
    return [];
  }
  const json = (await cgiRes.json()) as { products?: OffProduct[] };
  return json.products ?? [];
}

function toCached(seed: SeedCandy, p: OffProduct | null): CachedCandy {
  return {
    name: seed.name,
    brand: seed.brand,
    image_url: p ? p.image_front_url || p.image_url || null : null,
    kcal_100g: p ? num(p.nutriments?.["energy-kcal_100g"]) : null,
    sugar_100g: p ? num(p.nutriments?.["sugars_100g"]) : null,
    fat_100g: p ? num(p.nutriments?.["fat_100g"]) : null,
    ingredients_short: p ? shortIngredients(p) : null,
    source_code: p?.code ?? null,
  };
}

async function main() {
  let existing: Record<string, CachedCandy> = {};
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const arr = JSON.parse(raw) as CachedCandy[];
    // Drop entries that look bogus (sub-150 kcal — candy isn't fruit) so we retry them.
    const cleaned = arr.filter(
      (c) => !c.kcal_100g || (c.kcal_100g >= 150 && c.kcal_100g <= 700),
    );
    existing = Object.fromEntries(cleaned.map((c) => [c.name, c]));
  } catch {
    // first run
  }

  const out: CachedCandy[] = [];
  let hits = 0;
  let misses = 0;

  for (const seed of CANDY_LIST) {
    const cached = existing[seed.name];
    if (cached && cached.image_url && cached.kcal_100g != null) {
      out.push(cached);
      hits++;
      continue;
    }
    process.stdout.write(`fetching: ${seed.name.padEnd(34)} `);
    let products: OffProduct[] = [];
    try {
      products = await searchOff(seed);
    } catch (err) {
      console.warn(`error: ${(err as Error).message}`);
    }
    let picked: OffProduct | null = null;
    if (seed.barcode && products.length === 1) {
      picked = pickByBarcode(products[0]);
    } else {
      picked = pick(seed, products);
    }
    const row = toCached(seed, picked);
    out.push(row);
    if (picked && row.kcal_100g != null) {
      console.log(`✓ ${row.kcal_100g}kcal`);
      hits++;
    } else {
      console.log("✗ no match");
      misses++;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  await fs.writeFile(CACHE_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nDone. ${hits} hits, ${misses} misses → ${CACHE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
