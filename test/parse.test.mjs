import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRestaurants, loadRestaurants } from "../scripts/parse.mjs";
import { buildData } from "../scripts/build.mjs";
import { readFileSync } from "node:fs";

test("parses the real list without losing any checkbox", () => {
  const md = loadRestaurants();
  const raw = readFileSync(new URL("../Restaurants.md", import.meta.url), "utf8").match(/^- \[( |x)\]/gm).length;
  assert.equal(md.places.length, raw);
  assert.equal(md.stats.visited, md.places.filter((p) => p.visited).length);
  assert.ok(md.categories.length >= 6);
});


test("handles links, notes, sub-bullets and plain-text items", () => {
  const md = `## Rooftop Bars
- [x] [Spot](https://www.google.com/maps/search/?api=1&query=Spot+Encinitas) (Encinitas) - https://spot.example
  - https://www.instagram.com/spot/
- [ ] Bar across the street from the pier
#### Links
https://example.com/list
`;
  const d = parseRestaurants(md);
  assert.equal(d.categories[0].label, "Rooftops");
  assert.deepEqual(d.categories[0].links.map((l) => l.url), ["https://example.com/list"]);
  const [spot, bar] = d.places;
  assert.equal(spot.name, "Spot");
  assert.equal(spot.visited, true);
  assert.equal(spot.city, "Encinitas");
  assert.equal(spot.area, "North County Coastal");
  assert.equal(spot.note, "Encinitas");
  assert.deepEqual(spot.links.map((l) => l.kind), ["maps", "web", "instagram"]);
  assert.equal(bar.name, "Bar across the street from the pier");
  assert.equal(bar.visited, false);
  assert.equal(bar.links.length, 0);
});

test("every place gets coordinates inside San Diego County", () => {
  const d = buildData();
  for (const p of d.places) {
    assert.ok(p.lat > 32.4 && p.lat < 33.6, `${p.name} lat`);
    assert.ok(p.lng > -117.7 && p.lng < -116.0, `${p.name} lng`);
    assert.ok(["exact", "curated", "approximate"].includes(p.precision));
  }
  const ids = new Set(d.places.map((p) => p.id));
  assert.equal(ids.size, d.places.length, "ids are unique");
});
