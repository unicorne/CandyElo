// Fetch image + nutrition + ingredients from Open Food Facts.
// Only writes when the match is high-confidence: all `nameMust` tokens must
// appear in the OFF product_name AND the brand must match AND kcal must fall
// in the 150-700 candy band. When a confident match has an image_front_url,
// that image overwrites whatever Wikipedia/Commons set earlier (OFF is closer
// to the actual packaging). On a low-confidence search we keep the existing
// image and leave nutrition null.
//
// Run: pnpm seed:fetch  (typically after pnpm seed:wiki)

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
  image_front_url?: string;
  image_front_de_url?: string;
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
  // Brand and name match are non-negotiable.
  const brands = normalize(p.brands);
  const brandKey = normalize(seed.brand);
  if (!brands.includes(brandKey) && !brandKey.includes(brands)) return false;
  const name = productName(p);
  const must = seed.nameMust.map(normalize);
  if (!must.every((token) => name.includes(token))) return false;

  // kcal sanity: when present, must be in candy band. When missing entirely,
  // accept the match (lots of OFF entries have an image but no nutrition).
  const kcal = num(p.nutriments?.["energy-kcal_100g"]);
  if (kcal != null && (kcal < 150 || kcal > 700)) return false;
  return true;
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

const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "generic_name",
  "generic_name_de",
  "brands",
  "image_front_url",
  "image_front_de_url",
  "image_url",
  "ingredients_text_de",
  "ingredients_text",
  "nutriments",
].join(",");

async function searchOff(seed: SeedCandy): Promise<OffProduct[]> {
  if (seed.barcode) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${seed.barcode}.json?fields=${OFF_FIELDS}`;
    const res = await fetchWithRetry(url);
    if (res?.ok) {
      const json = (await res.json()) as { product?: OffProduct; status?: number };
      if (json.product && json.status !== 0) return [json.product];
    }
  }
  // Legacy CGI search — ranks by text relevance. The v2 /api/v2/search endpoint
  // sorts by popularity, which buries actual matches under unrelated products.
  const cgi = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  cgi.searchParams.set("search_terms", seed.query);
  cgi.searchParams.set("search_simple", "1");
  cgi.searchParams.set("action", "process");
  cgi.searchParams.set("json", "1");
  cgi.searchParams.set("page_size", "16");
  cgi.searchParams.set("fields", OFF_FIELDS);
  const res = await fetchWithRetry(cgi.toString());
  if (!res?.ok) return [];
  let json: { products?: OffProduct[] };
  try {
    json = (await res.json()) as { products?: OffProduct[] };
  } catch {
    return [];
  }
  return json.products ?? [];
}

function offImageUrl(p: OffProduct): string | null {
  return p.image_front_de_url || p.image_front_url || p.image_url || null;
}

function applyMatch(
  seed: SeedCandy,
  cached: CachedCandy,
  p: OffProduct,
): CachedCandy {
  const offImg = offImageUrl(p);
  // OFF wins on a high-confidence match — that's exactly what the strict
  // matcher already enforced. Fall back to the hand-curated override, then to
  // whatever Wikipedia/Commons left behind, only if OFF had no image.
  return {
    ...cached,
    image_url: offImg ?? seed.imageOverride ?? cached.image_url,
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
    // Skip only if we already have an OFF-sourced image AND nutrition.
    const hasOffImg = !!cached.image_url?.includes("openfoodfacts.org");
    const hasNutrition =
      cached.kcal_100g != null &&
      cached.kcal_100g >= 150 &&
      cached.kcal_100g <= 700;
    if (hasOffImg && hasNutrition) {
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
      const updated = applyMatch(seed, cached, picked);
      byName.set(seed.name, updated);
      const kcal = Math.round(num(picked.nutriments?.["energy-kcal_100g"]) ?? 0);
      const tag = offImageUrl(picked) ? "img+" : "    ";
      console.log(`✓ ${tag} ${kcal}kcal`);
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
