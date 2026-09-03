// Builds the static site into dist/. No dependencies, no network.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { loadRestaurants, PLACES } from "./parse.mjs";

const root = new URL("../", import.meta.url);
const out = new URL("dist/", root);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const readJSON = (rel) => (existsSync(new URL(rel, root)) ? JSON.parse(read(rel)) : {});

// OSM feature types we trust as a venue pin. Streets, neighbourhoods etc. are rejected.
const VENUE_TYPES = new Set([
  "restaurant", "bar", "pub", "cafe", "fast_food", "food", "brewery", "winery", "biergarten",
  "nightclub", "hotel", "confectionery", "bakery", "ice_cream", "food_court", "yes",
]);

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967295;
}

export function buildData() {
  const data = loadRestaurants();
  const cache = readJSON("data/geocode-cache.json");
  const pins = readJSON("data/pins.json");

  for (const p of data.places) {
    const override = pins[p.query];
    const hit = cache[p.query];
    if (override && override.lat) {
      Object.assign(p, { lat: override.lat, lng: override.lng, precision: "curated" });
    } else if (hit && VENUE_TYPES.has(hit.type)) {
      Object.assign(p, { lat: hit.lat, lng: hit.lng, precision: "exact", address: hit.display });
    } else {
      // Fall back to the city's center with a small deterministic jitter so pins don't stack.
      const key = p.city ? p.city.toLowerCase() : "san diego";
      const base = PLACES[key] || PLACES[Object.keys(PLACES).find((k) => (PLACES[k].label || "").toLowerCase() === key)] || PLACES["san diego"];
      const j = (n) => (hash(p.id + n) - 0.5) * 0.012;
      Object.assign(p, { lat: +(base.lat + j("a")).toFixed(5), lng: +(base.lng + j("b")).toFixed(5), precision: "approximate" });
    }
  }
  data.generatedAt = new Date().toISOString();
  data.areas = [...new Set(data.places.map((p) => p.area))];
  return data;
}

export function build() {
  const data = buildData();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(new URL("site/", root), out, { recursive: true });

  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const html = read("site/index.html")
    .replace("__DATA__", json)
    .replace(/__TOTAL__/g, String(data.stats.total))
    .replace(/__VISITED__/g, String(data.stats.visited))
    .replace(/__PERCENT__/g, String(data.stats.percent));
  writeFileSync(new URL("index.html", out), html);
  writeFileSync(new URL("places.json", out), JSON.stringify(data, null, 2));
  writeFileSync(new URL(".nojekyll", out), "");
  // shields.io "endpoint" badge, so the README badge stays in sync without any commits.
  writeFileSync(
    new URL("badge.json", out),
    JSON.stringify({
      schemaVersion: 1,
      label: "visited",
      message: `${data.stats.visited} of ${data.stats.total}`,
      color: "e4573d",
    }),
  );
  return data;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const d = build();
  const exact = d.places.filter((p) => p.precision === "exact").length;
  const curated = d.places.filter((p) => p.precision === "curated").length;
  console.log(`Built dist/ — ${d.stats.total} places (${d.stats.visited} visited), pins: ${exact} exact, ${curated} curated, ${d.stats.total - exact - curated} approximate.`);
}
