// Fetch nutrition + ingredients from Open Food Facts.
// IMPORTANT: This script no longer overwrites `image_url` — that comes from
// `seed:wiki`. We only fill kcal/sugar/fat/ingredients here, and only if the
// match is high-confidence (all `nameMust` tokens present in the OFF product
// name). Better to leave nutrition null than show wrong values.
//
// Run: pnpm seed:fetch  (after pnpm seed:wiki)

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
  generic_name_de?: string;
  brands?: string;
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

function normalize(s: string | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function productName(p: OffProduct): string {
  return normalize(
    p.product_name_de || p.product_name || p.generic_name_de || p.generic_name,
  );
}

function isHighConfidenceMatch(seed: SeedCandy, p: OffProduct): boolean {
  const kcal = num(p.nutriments?.["energy-kcal_100g"]);
  if (kcal == null || kcal < 150 || kcal > 700) return false;
  const brands = normalize(p.brands);
  const brandKey = normalize(seed.brand);
  if (!brands.includes(brandKey) && !brandKey.includes(brands)) return false;
  const name = productName(p);
  const must = seed.nameMust.map(normalize);
  // ALL nameMust tokens must appear (allow OR-groups within a single token via
  // alternative spellings — the seed already lists those as separate strings).
  return must.every((token) => name.includes(token));
}

function pick(seed: SeedCandy, products: OffProduct[]): OffProduct | null {
  for (const p of products) {
    if (isHighConfidenceMatch(seed, p)) return p;
  }
  return null;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response | null> {
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
      if (json.product && json.status !== 0) return [json.product];
    }
  }
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
      "generic_name_de",
      "brands",
      "ingredients_text_de",
      "ingredients_text",
      "nutriments",
    ].join(","),
  );
  const res = await fetchWithRetry(v2.toString());
  if (!res?.ok) return [];
  const json = (await res.json()) as { products?: OffProduct[] };
  return json.products ?? [];
}

function applyNutrition(
  seed: SeedCandy,
  cached: CachedCandy,
  p: OffProduct,
): CachedCandy {
  return {
    ...cached,
    kcal_100g: num(p.nutriments?.["energy-kcal_100g"]),
    sugar_100g: num(p.nutriments?.["sugars_100g"]),
    fat_100g: num(p.nutriments?.["fat_100g"]),
    ingredients_short: shortIngredients(p),
    source_code: p.code ?? cached.source_code,
  };
}

async function main() {
  let arr: CachedCandy[] = [];
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    arr = JSON.parse(raw) as CachedCandy[];
  } catch {
    arr = [];
  }
  const byName = new Map(arr.map((c) => [c.name, c]));

  let hits = 0;
  let kept = 0;
  let misses = 0;

  for (const seed of CANDY_LIST) {
    const cached = byName.get(seed.name) ?? {
      name: seed.name,
      brand: seed.brand,
      image_url: null,
      kcal_100g: null,
      sugar_100g: null,
      fat_100g: null,
      ingredients_short: null,
      source_code: null,
    };
    if (
      cached.kcal_100g != null &&
      cached.kcal_100g >= 150 &&
      cached.kcal_100g <= 700
    ) {
      kept++;
      byName.set(seed.name, cached);
      continue;
    }
    process.stdout.write(`off: ${seed.name.padEnd(34)} `);
    let products: OffProduct[] = [];
    try {
      products = await searchOff(seed);
    } catch {
      products = [];
    }
    const picked = pick(seed, products);
    if (picked) {
      const updated = applyNutrition(seed, cached, picked);
      byName.set(seed.name, updated);
      console.log(`✓ ${Math.round(num(picked.nutriments?.["energy-kcal_100g"]) ?? 0)}kcal`);
      hits++;
    } else {
      byName.set(seed.name, cached);
      console.log("✗");
      misses++;
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  const out = CANDY_LIST.map((s) => byName.get(s.name)!).filter(Boolean);
  await fs.writeFile(CACHE_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n${hits} new, ${kept} kept, ${misses} no nutrition → ${CACHE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
