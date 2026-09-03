// Parses Restaurants.md (the single source of truth) into structured JSON.
// The markdown file is never modified; everything on the site derives from it.
import { readFileSync } from "node:fs";

const CATEGORY_LABELS = {
  "restaurants/bars/breweries/winerys": "Restaurants, Bars & Breweries",
  "speakeasies / craft cocktail bars": "Speakeasies & Craft Cocktails",
  "patio restaurants": "Patios",
  "sit-down mexican req's:": "Sit-Down Mexican",
  "rooftop bars": "Rooftops",
  "beach restaurants": "Beachside",
};

// Known San Diego County places, with approximate centers and an area bucket.
export const PLACES = {
  "san marcos":            { lat: 33.1434, lng: -117.1661, area: "North County Inland" },
  "escondido":             { lat: 33.1192, lng: -117.0864, area: "North County Inland" },
  "vista":                 { lat: 33.2000, lng: -117.2425, area: "North County Inland" },
  "pauma valley":          { lat: 33.3078, lng: -116.9764, area: "North County Inland" },
  "poway":                 { lat: 32.9628, lng: -117.0359, area: "North County Inland" },
  "scripps ranch":         { lat: 32.9078, lng: -117.1035, area: "North County Inland" },
  "pq":                    { lat: 32.9595, lng: -117.1150, area: "North County Inland", label: "Rancho Peñasquitos" },
  "oceanside":             { lat: 33.1959, lng: -117.3795, area: "North County Coastal" },
  "oceanside harbor":      { lat: 33.2050, lng: -117.3900, area: "North County Coastal" },
  "carlsbad":              { lat: 33.1581, lng: -117.3506, area: "North County Coastal" },
  "south carlsbad state beach": { lat: 33.1060, lng: -117.3200, area: "North County Coastal" },
  "encinitas":             { lat: 33.0370, lng: -117.2920, area: "North County Coastal" },
  "leucadia":              { lat: 33.0664, lng: -117.3000, area: "North County Coastal" },
  "cardiff":               { lat: 33.0181, lng: -117.2800, area: "North County Coastal" },
  "solana beach":          { lat: 32.9912, lng: -117.2712, area: "North County Coastal" },
  "solano beach":          { lat: 32.9912, lng: -117.2712, area: "North County Coastal", label: "Solana Beach" },
  "del mar":               { lat: 32.9595, lng: -117.2653, area: "North County Coastal" },
  "little italy":          { lat: 32.7237, lng: -117.1686, area: "Central San Diego" },
  "gaslamp":               { lat: 32.7117, lng: -117.1605, area: "Central San Diego" },
  "downtown":              { lat: 32.7157, lng: -117.1611, area: "Central San Diego" },
  "coronado":              { lat: 32.6859, lng: -117.1831, area: "Central San Diego" },
  "liberty station":       { lat: 32.7395, lng: -117.2100, area: "Central San Diego" },
  "india street":          { lat: 32.7370, lng: -117.1720, area: "Central San Diego" },
  "balboa park":           { lat: 32.7341, lng: -117.1446, area: "Central San Diego" },
  "convoy":                { lat: 32.8280, lng: -117.1550, area: "Central San Diego" },
  "san diego":             { lat: 32.7157, lng: -117.1611, area: "Central San Diego" },
};

const PLACE_KEYS = Object.keys(PLACES).sort((a, b) => b.length - a.length);

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findPlace(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const t = text.toLowerCase();
    for (const key of PLACE_KEYS) {
      const re = new RegExp(`(^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
      if (re.test(t)) return key;
    }
  }
  return null;
}

function mapsQuery(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("query") || "";
  } catch {
    return "";
  }
}

const MD_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BARE_URL = /https?:\/\/[^\s)\]]+/g;

function cleanNote(text) {
  let s = text.trim();
  s = s.replace(BARE_URL, "").trim();
  s = s.replace(/^[\s:\-–—,]+/, "").replace(/[\s:\-–—,]+$/, "").trim();
  // "(foo)" -> "foo" when the whole note is parenthesized
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1).trim();
  s = s.replace(/\s+/g, " ");
  return s;
}

function classifyLink(url) {
  if (/google\.com\/maps/.test(url)) return "maps";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/reddit\.com/.test(url)) return "reddit";
  return "web";
}

export function parseRestaurants(markdown) {
  const lines = markdown.split(/\r?\n/);
  const categories = [];
  const places = [];
  let current = null;
  let lastPlace = null;
  let inLinks = false;

  const ensureCategory = (heading) => {
    const key = heading.trim().toLowerCase();
    const label = CATEGORY_LABELS[key] || heading.trim();
    const cat = { id: slugify(label), label, raw: heading.trim(), links: [] };
    categories.push(cat);
    return cat;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 4 && /^links$/i.test(text)) {
        inLinks = true;
        continue;
      }
      inLinks = false;
      current = ensureCategory(text);
      lastPlace = null;
      continue;
    }

    if (!current) continue;

    const item = line.match(/^- \[( |x|X)\]\s*(.*)$/);
    if (item) {
      inLinks = false;
      const visited = item[1].toLowerCase() === "x";
      const body = item[2];
      const links = [];
      let name = null;
      let rest = body;
      const mdLinks = [...body.matchAll(MD_LINK)];
      if (mdLinks.length) {
        name = mdLinks[0][1].trim();
        for (const m of mdLinks) {
          links.push({ label: m[1].trim(), url: m[2], kind: classifyLink(m[2]) });
        }
        rest = body.replace(MD_LINK, (m, label, url, offset) => (offset === mdLinks[0].index ? "" : label));
      } else {
        // Plain-text item (no link)
        const firstSentence = body.split(/[(:\-–—]/)[0].trim();
        name = firstSentence || body.trim();
        rest = body.slice(name.length);
      }
      for (const m of body.matchAll(BARE_URL)) {
        const url = m[0];
        if (!links.some((l) => l.url === url)) links.push({ label: url, url, kind: classifyLink(url) });
      }
      const note = cleanNote(rest);
      const mapsLink = links.find((l) => l.kind === "maps");
      const query = mapsLink ? mapsQuery(mapsLink.url) : "";
      const placeKey = findPlace(query, note, name);
      const placeInfo = placeKey ? PLACES[placeKey] : null;
      const closed = /temporarily closed|permanently closed/i.test(note);

      const place = {
        id: `${current.id}--${slugify(name)}`,
        name,
        category: current.id,
        visited,
        note,
        links,
        query,
        city: placeInfo ? placeInfo.label || titleCase(placeKey) : null,
        area: placeInfo ? placeInfo.area : "San Diego County",
        closed,
      };
      // De-duplicate ids for repeated entries (the list has a couple)
      let n = 2;
      while (places.some((p) => p.id === place.id)) place.id = `${current.id}--${slugify(name)}-${n++}`;
      places.push(place);
      lastPlace = place;
      continue;
    }

    // Continuation / sub-bullet lines: attach any URLs to the last place
    const isIndented = /^\s+/.test(line) && line.trim().length > 0;
    if (isIndented && lastPlace && !inLinks) {
      for (const m of line.matchAll(MD_LINK)) {
        if (!lastPlace.links.some((l) => l.url === m[2])) lastPlace.links.push({ label: m[1], url: m[2], kind: classifyLink(m[2]) });
      }
      const stripped = line.replace(MD_LINK, "");
      for (const m of stripped.matchAll(BARE_URL)) {
        if (!lastPlace.links.some((l) => l.url === m[0])) lastPlace.links.push({ label: m[0], url: m[0], kind: classifyLink(m[0]) });
      }
      continue;
    }

    // Reference links under a "#### Links" heading belong to the category
    if (inLinks && line.trim()) {
      const seen = new Set();
      for (const m of line.matchAll(MD_LINK)) {
        seen.add(m[2]);
        current.links.push({ label: m[1], url: m[2], kind: classifyLink(m[2]) });
      }
      for (const m of line.matchAll(BARE_URL)) {
        if (!seen.has(m[0])) current.links.push({ label: m[0], url: m[0], kind: classifyLink(m[0]) });
      }
    }
  }

  const visited = places.filter((p) => p.visited).length;
  return {
    categories,
    places,
    stats: {
      total: places.length,
      visited,
      remaining: places.length - visited,
      percent: places.length ? Math.round((visited / places.length) * 100) : 0,
    },
  };
}

export function loadRestaurants(path = new URL("../Restaurants.md", import.meta.url)) {
  return parseRestaurants(readFileSync(path, "utf8"));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  console.log(JSON.stringify(loadRestaurants(), null, 2));
}
