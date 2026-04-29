// Pulls a canonical product photo for each candy.
//
// Strategy (in order, first hit wins):
//   1. seed.imageOverride (hand-curated Commons URL)
//   2. Wikidata P18 (the entity's main image — curated, usually a real product photo)
//   3. Wikipedia DE article: scan all on-page files, pick the first non-logo
//      raster image that survives BAD_FILE_PATTERNS
//   4. Wikipedia DE pageimage (logo-ish but at least correct brand)
//   5. Same on EN Wikipedia
//   6. Commons file search with the seed name
//
// Run: pnpm seed:wiki

import fs from "node:fs/promises";
import path from "node:path";
import { CANDY_LIST, type SeedCandy } from "./candy-list";

const UA = "CandyElo/0.1 (+https://github.com/unicorne/CandyElo)";
const CACHE_PATH = path.join("scripts", "candies.cache.json");

// Filename patterns that are almost never a product photo.
const BAD_FILE_PATTERNS = [
  // Buildings / facilities
  /factory|fabrik|logistik|headquarter|hauptsitz|zentrale|store|laden|shop/i,
  // Animals (snakes named "Mamba", lions named "Lion", etc.)
  /mamba.*serpent|black.mamba|\.snake\.|cobra|dendroaspis|polylepis|polilepis|jamesons|elapidae|viper/i,
  /lions?_park|safari|serengeti|king.*snyggve|löwe_|ishtar|babylon|relief|caribou|wagon|wildlife|zoo_/i,
  // Cars / aircraft / vehicles
  /\bvoiture|\brace_?car|\bf1\b|fahrzeug|truck|lkw|panzer|formel|formula|locomotive/i,
  /aircraft|airplane|airliner|cargo[_-]?jet|\bd-atud\b|jet_engine|turboprop/i,
  // Music releases
  /album|cover|song|musik|single\b|hab_ich_dir|madeline|track\b/i,
  // Aerodynamics / astrophysics
  /mira[-_]uv|bow[-_]shock|shock[_-]wave|hubble|telescope|nebula|astronomy|astronomical|comet|mach[_-]?\d|aerodynamic|inlet_shock/i,
  // Sunflower (Goldbären gummy-bear sunflower variety)
  /helianthus|sunflower|annuus/i,
  // Political cartoons / movie stills (Hobbits → Leech / Hobbit feet)
  /cartoon|leech|political|justice_to_ireland|caricature/i,
  /hobbit_(feet|foot|costume|movie|film|character|cosplay)/i,
  // Founders / company portraits (Hans Riegel etc.)
  /(hans|paul|johann)_riegel|riegel_(senior|junior|sen\.|jun\.)/i,
  // Geography / landmarks
  /lake|see|f.hre|zsg|kilchberg|w.denswil|b.rkliplatz|aachen|berlin|firenze|borsa|hannover_in_wort|wort_und_bild|1910_/i,
  /lego|brick/i,
  /panoramio/i,
  /flag|flagge|wahrzeichen/i,
  /coat[_-]?of[_-]?arms|wappen|siegel/i,
  /map\b|karte\b/i,
  /portrait|gr.nder|ceo|founder|tolkien|harfoots?|rings.of.power|\bhobbit_(film|movie|character|story)/i,
];

export const BAD_PATTERNS = BAD_FILE_PATTERNS;
const isBadFilename = (name: string) => BAD_FILE_PATTERNS.some((r) => r.test(name));

const isLogoFilename = (name: string) =>
  /logo|wordmark|brandmark|symbol/i.test(name);

const RASTER = /\.(jpg|jpeg|png|webp)$/i;

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

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function commonsThumbUrl(filename: string, width = 600): string {
  // Special:FilePath redirects to the canonical upload.wikimedia.org URL.
  // Strip the "File:" / "Datei:" namespace prefix — the API returns it on
  // some entries and Special:FilePath 404s when it's present.
  const clean = filename
    .replace(/^(File|Datei|Image|Bild):/i, "")
    .replace(/\s+/g, "_");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean)}?width=${width}`;
}

// 1) Wikidata P18 lookup via wikibase site link.
async function wikidataImage(host: string, title: string): Promise<string | null> {
  const site = host.startsWith("de.") ? "dewiki" : "enwiki";
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&sites=${site}&titles=${encodeURIComponent(title)}&props=claims&languages=de`;
  const json = await fetchJson<{
    entities?: Record<string, {
      claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> };
    }>;
  }>(url);
  if (!json?.entities) return null;
  const entity = Object.values(json.entities)[0];
  const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!filename) return null;
  if (isBadFilename(filename)) return null;
  return commonsThumbUrl(filename);
}

// 2) All file images on the article; pick first non-logo raster.
async function articleImages(host: string, title: string): Promise<string | null> {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "images");
  url.searchParams.set("imlimit", "20");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  const json = await fetchJson<{
    query?: { pages?: Array<{ images?: Array<{ title: string }>; missing?: string }> };
  }>(url.toString());
  const page = json?.query?.pages?.[0];
  if (!page || page.missing != null) return null;
  for (const img of page.images ?? []) {
    const name = img.title.replace(/^File:/i, "");
    if (!RASTER.test(name)) continue;
    if (isBadFilename(name)) continue;
    if (isLogoFilename(name)) continue;
    return commonsThumbUrl(name);
  }
  return null;
}

// 3) MediaWiki pageimages (fallback — can be a logo).
async function pageImage(host: string, title: string): Promise<string | null> {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "pageimages|pageprops");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "600");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  const json = await fetchJson<{
    query?: {
      pages?: Array<{
        thumbnail?: { source: string };
        pageprops?: { disambiguation?: string };
        missing?: string;
      }>;
    };
  }>(url.toString());
  const page = json?.query?.pages?.[0];
  if (!page || page.missing != null) return null;
  if (page.pageprops?.disambiguation != null) return null;
  const src = page.thumbnail?.source;
  if (!src) return null;
  if (isBadFilename(src)) return null;
  // Allow the logo here as a last resort — it's at least the correct brand.
  return src.replace(/\/\d+px-/, "/600px-");
}

// 4) Commons file search.
async function commonsSearch(query: string): Promise<string | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  url.searchParams.set("gsrlimit", "10");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url");
  url.searchParams.set("iiurlwidth", "600");
  const json = await fetchJson<{
    query?: {
      pages?: Array<{
        title?: string;
        imageinfo?: Array<{ thumburl?: string; url?: string }>;
      }>;
    };
  }>(url.toString());
  for (const p of json?.query?.pages ?? []) {
    const t = (p.title ?? "").replace(/^File:/i, "");
    if (!RASTER.test(t)) continue;
    if (isBadFilename(t)) continue;
    if (isLogoFilename(t)) continue;
    const u = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
    if (u) return u;
  }
  return null;
}

async function imageFor(seed: SeedCandy): Promise<string | null> {
  if (seed.imageOverride) return seed.imageOverride;

  const titles: string[] = [];
  if (seed.wikiTitle) titles.push(seed.wikiTitle);
  titles.push(seed.name.replace(/\s+/g, "_"));
  const stripped = seed.name.replace(new RegExp(`^${seed.brand}\\s+`, "i"), "").trim();
  if (stripped !== seed.name) titles.push(stripped.replace(/\s+/g, "_"));

  // Wikidata P18 (best signal)
  for (const title of titles) {
    const img = await wikidataImage("de.wikipedia.org", title);
    if (img) return img;
  }
  for (const title of titles) {
    const img = await wikidataImage("en.wikipedia.org", title);
    if (img) return img;
  }

  // Article files (skip logos)
  for (const title of titles) {
    const img = await articleImages("de.wikipedia.org", title);
    if (img) return img;
  }
  for (const title of titles) {
    const img = await articleImages("en.wikipedia.org", title);
    if (img) return img;
  }

  // Pageimage (may be a logo)
  for (const title of titles) {
    const img = await pageImage("de.wikipedia.org", title);
    if (img) return img;
  }
  for (const title of titles) {
    const img = await pageImage("en.wikipedia.org", title);
    if (img) return img;
  }

  // Commons fallback
  return await commonsSearch(`${seed.name} ${seed.brand}`);
}

function isWikimedia(url: string | null): boolean {
  return Boolean(url && /wikimedia\.org|commons\.wikimedia\.org/.test(url));
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

  let changed = 0;
  let kept = 0;
  let missed = 0;

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
      isWikimedia(cached.image_url) &&
      !seed.imageOverride // override always wins
    ) {
      kept++;
      byName.set(seed.name, cached);
      continue;
    }
    process.stdout.write(`wiki: ${seed.name.padEnd(34)} `);
    const img = await imageFor(seed);
    if (img) {
      cached.image_url = img;
      changed++;
      console.log("✓");
    } else {
      console.log("✗");
      missed++;
    }
    byName.set(seed.name, cached);
    await new Promise((r) => setTimeout(r, 120));
  }

  // Final safety pass: nullify any image URL whose filename still hits a bad
  // pattern (e.g. Wikidata gave us Lindor logo + a snake/cartoon/etc).
  let nuked = 0;
  for (const c of byName.values()) {
    if (!c.image_url) continue;
    const filename = decodeURIComponent(
      c.image_url.split("/").pop()?.split("?")[0] ?? "",
    );
    if (isBadFilename(filename)) {
      c.image_url = null;
      nuked++;
    }
  }

  const out = CANDY_LIST.map((s) => byName.get(s.name)!).filter(Boolean);
  await fs.writeFile(CACHE_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `\n${changed} updated, ${kept} kept, ${missed} no image, ${nuked} nullified by safety pass → ${CACHE_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
