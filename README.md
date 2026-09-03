<p align="center">
  <img src="site/icon.svg" width="72" alt="" />
</p>

<h1 align="center">The San Diego List</h1>

<p align="center">
  A running field guide to eating and drinking across San Diego County, from Oceanside to Coronado.<br />
  <strong><a href="https://dave92082.github.io/san-diego/">dave92082.github.io/san-diego</a></strong>
</p>

<p align="center">
  <a href="https://dave92082.github.io/san-diego/"><img alt="visited" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fdave92082.github.io%2Fsan-diego%2Fbadge.json&style=flat-square" /></a>
  <a href="https://github.com/dave92082/san-diego/actions/workflows/deploy.yml"><img alt="deploy" src="https://img.shields.io/github/actions/workflow/status/dave92082/san-diego/deploy.yml?branch=main&label=deploy&style=flat-square" /></a>
  <img alt="dependencies: none" src="https://img.shields.io/badge/dependencies-none-2a9d8f?style=flat-square" />
</p>

---

## The list

Everything lives in **[`Restaurants.md`](Restaurants.md)**. That file is the whole database: a Markdown checklist
with a Google Maps link per place, a note or two, and a `[x]` when we've been.

```markdown
- [x] [Draft Republic](https://www.google.com/maps/search/?api=1&query=Draft+Republic+San+Marcos): Local bar w/Shuffleboard and bowling…
- [ ] [Vintana](https://www.google.com/maps/search/?api=1&query=Vintana+Wine+%26+Dine+Escondido) - Fine Dining, craft cocktails. Recommended by local bartender in Escondido.
```

To add a place, tick one off, or fix a note: edit that file and push. The site rebuilds itself.

## The site

The Markdown is compiled into a static site and published to GitHub Pages on every push to `main`.

- **A sky that matches San Diego right now.** The hero's gradient, sun and stars track the actual time of day in
  San Diego, and the "right now" line pulls the live temperature from Open-Meteo.
- **A real map.** Every place is pinned on a vector map (MapLibre + OpenFreeMap). Exact pins come from OpenStreetMap
  geocoding; when it can't find a place, the pin lands on the neighborhood and is drawn dashed so you know.
- **Filters that stick.** Search, area, category and been/to-try, all mirrored in the URL so a filtered view can be shared.
- **Surprise me.** A one-tap picker that lands on an unvisited place from whatever's filtered.
- **Editorial, not dashboard.** Numbered collections, a progress ledger, a rubber-stamp on the places we've been, dark mode.
- **Installable.** It ships a web manifest, so it can live on a phone's home screen for the moment you're standing on the 101 wondering where to eat.

## Working on it

There are no dependencies. You need Node 20+.

```sh
npm run dev      # build, then serve dist/ at http://localhost:4173
npm test         # parser tests
npm run build    # write dist/
npm run geocode  # look up new places on Nominatim and update data/geocode-cache.json
```

The build never touches the network. Geocoding is a separate, manual step whose results are committed in
`data/geocode-cache.json`; `data/pins.json` holds a handful of hand-placed coordinates that override it.

```
Restaurants.md          the list (source of truth)
scripts/parse.mjs       Markdown → JSON
scripts/build.mjs       JSON + site/ → dist/
scripts/geocode.mjs     Nominatim lookups, cached
site/                   index.html, styles.css, app.js
data/                   geocode cache and pin overrides
```

Add `?hour=17.5` to the URL to preview the hero at any hour of the San Diego day, or `?nomap` to skip the map while working on the rest.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, tiles by [OpenFreeMap](https://openfreemap.org/),
weather by [Open-Meteo](https://open-meteo.com/). Type is [Fraunces](https://fonts.google.com/specimen/Fraunces) and
[Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans).
