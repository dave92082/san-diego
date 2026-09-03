// Geocodes every place's Google Maps query with OpenStreetMap's Nominatim and
// caches the result in data/geocode-cache.json. Run it manually when you add
// places (`npm run geocode`); the build never touches the network.
import { readFileSync, writeFileSync } from "node:fs";
import { loadRestaurants } from "./parse.mjs";

const CACHE = new URL("../data/geocode-cache.json", import.meta.url);
// San Diego County bounding box (lng/lat): anything outside is discarded.
const BOX = { left: -117.65, top: 33.55, right: -116.05, bottom: 32.5 };
const UA = "san-diego-list (github.com/dave92082/san-diego)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  try {
    return JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
}

async function lookup(q) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", `${BOX.left},${BOX.top},${BOX.right},${BOX.bottom}`);
  url.searchParams.set("bounded", "1");
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const [hit] = await res.json();
  if (!hit) return null;
  const lat = Number(hit.lat), lng = Number(hit.lon);
  if (lat < BOX.bottom || lat > BOX.top || lng < BOX.left || lng > BOX.right) return null;
  return { lat, lng, display: hit.display_name, type: hit.type, name: hit.name || null };
}

const force = process.argv.includes("--force");
const cache = load();
const { places } = loadRestaurants();
const queries = [...new Set(places.map((p) => p.query).filter(Boolean))];
let done = 0, found = 0, missed = 0;
for (const q of queries) {
  if (!force && q in cache) continue;
  try {
    const hit = await lookup(q);
    cache[q] = hit;
    hit ? found++ : missed++;
    console.log(`${hit ? "✓" : "✗"} ${q}${hit ? ` → ${hit.display}` : ""}`);
  } catch (err) {
    console.error(`! ${q}: ${err.message}`);
  }
  done++;
  await sleep(1100); // Nominatim usage policy: max 1 request/second
}
const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(CACHE, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\n${done} looked up (${found} found, ${missed} missed), ${Object.keys(cache).length} cached.`);
