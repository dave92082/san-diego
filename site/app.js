/* The San Diego List — client script. No framework, no build step beyond data injection. */
(() => {
  "use strict";

  const DATA = JSON.parse(document.getElementById("data").textContent);
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const catById = Object.fromEntries(DATA.categories.map((c) => [c.id, c]));
  const catColor = (id) => `var(--c-${id}, var(--accent))`;

  const BLURBS = {
    "restaurants-bars-and-breweries": "The catch-all: bowling-alley bars in San Marcos, donuts in Escondido, wineries all the way up in Pauma Valley.",
    "speakeasies-and-craft-cocktails": "Unmarked doors and house cocktails, from Convoy to Little Italy.",
    "patios": "Sunshine is the whole point. Pool decks, courtyards, and a bar that rotates.",
    "sit-down-mexican": "Not the taco-shop kind. Plates, margaritas, a booth you can settle into.",
    "rooftops": "Above the Gaslamp, over the bay, and on top of a hotel across from the Oceanside pier.",
    "beachside": "Sand within reach. Highway 101, the pier, the harbor.",
  };

  /* ---------------- state (mirrored in the URL hash) ---------------- */
  const state = { q: "", status: "all", area: "", cat: "" };
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of Object.keys(state)) if (p.has(k)) state[k] = p.get(k);
    if (!["all", "todo", "done"].includes(state.status)) state.status = "all";
  }
  function writeHash() {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v && v !== "all") p.set(k, v);
    const h = p.toString();
    history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
  }

  function matches(p) {
    if (state.status === "todo" && p.visited) return false;
    if (state.status === "done" && !p.visited) return false;
    if (state.area && p.area !== state.area) return false;
    if (state.cat && p.category !== state.cat) return false;
    if (state.q) {
      const hay = `${p.name} ${p.city || ""} ${p.area} ${p.note} ${catById[p.category].label}`.toLowerCase();
      if (!state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const filtered = () => DATA.places.filter(matches);

  /* ---------------- links ---------------- */
  function linkLabel(link, place) {
    if (link.kind === "maps") return link.label && link.label !== place.name ? `${link.label} · Maps` : "Maps";
    if (link.kind === "instagram") return "Instagram";
    if (link.kind === "reddit") return "Reddit";
    try {
      return new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      return "Website";
    }
  }
  const linksHTML = (p) =>
    p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(linkLabel(l, p))}</a>`).join("");

  /* ---------------- by the numbers ---------------- */
  function renderNumbers() {
    const ul = $("#numbers");
    ul.innerHTML = DATA.categories
      .map((c) => {
        const ps = DATA.places.filter((p) => p.category === c.id);
        const done = ps.filter((p) => p.visited).length;
        const pct = ps.length ? Math.round((done / ps.length) * 100) : 0;
        return `<li style="--dot:${catColor(c.id)}"><span class="name">${esc(c.label)}</span><span class="frac">${done} of ${ps.length}</span><span class="bar"><span style="width:${pct}%"></span></span></li>`;
      })
      .join("");
  }

  /* ---------------- toolbar ---------------- */
  function initToolbar() {
    const areaSel = $("#area"), catSel = $("#cat"), q = $("#q");
    for (const a of DATA.areas) areaSel.insertAdjacentHTML("beforeend", `<option value="${esc(a)}">${esc(a)}</option>`);
    for (const c of DATA.categories) catSel.insertAdjacentHTML("beforeend", `<option value="${esc(c.id)}">${esc(c.label)}</option>`);
    areaSel.value = state.area;
    catSel.value = state.cat;
    q.value = state.q;
    $$(".segment button").forEach((b) => b.classList.toggle("is-active", b.dataset.status === state.status));

    let t;
    q.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = q.value.trim(); update(); }, 120);
    });
    areaSel.addEventListener("change", () => { state.area = areaSel.value; update(); });
    catSel.addEventListener("change", () => { state.cat = catSel.value; update(); });
    $$(".segment button").forEach((b) =>
      b.addEventListener("click", () => {
        state.status = b.dataset.status;
        $$(".segment button").forEach((x) => x.classList.toggle("is-active", x === b));
        update();
      }),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        q.focus();
        q.select();
      }
      if (e.key === "Escape" && document.activeElement === q) { q.value = ""; state.q = ""; update(); q.blur(); }
    });
  }

  /* ---------------- collections ---------------- */
  function cardHTML(p, index, feature) {
    const cls = ["card", p.visited && "is-visited", feature && "is-feature"].filter(Boolean).join(" ");
    return `<article class="${cls}" data-id="${esc(p.id)}" style="--dot:${catColor(p.category)}">
      <div class="card-top"><span class="card-no">No. ${String(index).padStart(2, "0")}</span><span class="card-city">${esc(p.city || p.area)}</span></div>
      <h3 class="card-name">${esc(p.name)}</h3>
      ${p.closed ? `<span class="tag">Temporarily closed</span>` : ""}
      ${p.note ? `<p class="card-note">${esc(p.note)}</p>` : ""}
      <div class="card-links">${linksHTML(p)}<button type="button" data-locate="${esc(p.id)}">On the map</button></div>
      ${p.visited ? `<span class="stamp" aria-label="Visited">Been there</span>` : ""}
    </article>`;
  }

  function renderCollections() {
    const main = $("#collections");
    const visible = new Set(filtered().map((p) => p.id));
    const html = DATA.categories
      .map((c, i) => {
        const all = DATA.places.filter((p) => p.category === c.id);
        const shown = all.filter((p) => visible.has(p.id));
        if (!shown.length) return "";
        const done = all.filter((p) => p.visited).length;
        const reading = c.links.length
          ? `<span>Further reading:</span> ${c.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.kind === "reddit" ? "r/sandiego" : (() => { try { return new URL(l.url).hostname.replace(/^www\./, ""); } catch { return "link"; } })())}</a>`).join("")}`
          : "";
        const cards = shown.map((p) => cardHTML(p, all.indexOf(p) + 1, shown.length > 3 && all.indexOf(p) === 0)).join("");
        return `<section class="collection" id="${esc(c.id)}" style="--dot:${catColor(c.id)}">
          <header class="collection-head">
            <span class="collection-no">${String(i + 1).padStart(2, "0")}</span>
            <h2 class="collection-title"><span class="swatch"></span>${esc(c.label)}</h2>
            ${BLURBS[c.id] ? `<p class="collection-desc">${esc(BLURBS[c.id])}</p>` : ""}
            <p class="collection-meta"><span>${shown.length === all.length ? `${all.length} places` : `${shown.length} of ${all.length} places`}</span><span>${done} been</span>${reading}</p>
          </header>
          <div class="cards">${cards}</div>
        </section>`;
      })
      .join("");
    main.innerHTML = html || `<p class="empty">Nothing matches. Loosen the filters and try again.</p>`;
  }

  function renderCount() {
    const n = filtered().length;
    const done = filtered().filter((p) => p.visited).length;
    $("#count").textContent = n === DATA.places.length ? `${n} places, ${done} been` : `${n} of ${DATA.places.length} places`;
  }

  /* ---------------- map ---------------- */
  let map, markers = {};
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const styleURL = () => `https://tiles.openfreemap.org/styles/${isDark() ? "dark" : "positron"}`;
  function pinSVG(p) {
    const color = catColor(p.category);
    const check = p.visited
      ? `<path d="M8.5 13.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<circle cx="13" cy="12.5" r="3.6" fill="#fff"/>`;
    return `<div class="pin${p.precision === "approximate" ? " is-approx" : ""}" style="--dot:${color}"><svg viewBox="0 0 26 34"><path class="body" d="M13 1.5c-6.3 0-11.3 5-11.3 11.3 0 8.2 11.3 19.7 11.3 19.7s11.3-11.5 11.3-19.7C24.3 6.5 19.3 1.5 13 1.5z" fill="${color}" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>${check}</svg></div>`;
  }
  function popupHTML(p) {
    const approx = p.precision === "approximate" ? `<p class="popup-note" style="font-size:.75rem">Pin is approximate (${esc(p.city || p.area)}).</p>` : "";
    return `<p class="popup-name">${esc(p.name)}</p><p class="popup-meta">${esc(catById[p.category].label)} · ${esc(p.city || p.area)}${p.visited ? " · Been" : ""}</p>${p.note ? `<p class="popup-note">${esc(p.note)}</p>` : ""}${approx}<p class="popup-links">${linksHTML(p)}</p>`;
  }
  function setTiles() { if (map) map.setStyle(styleURL()); }
  function mapUnavailable(why) {
    map = null;
    $("#mapCanvas").innerHTML = `<p class="map-fallback">The map needs WebGL, which this browser has turned off. ${esc(why || "")} Every place still has a Maps link below.</p>`;
    $("#legend").hidden = true;
  }
  function initMap() {
    if (new URLSearchParams(location.search).has("nomap")) { mapUnavailable("(Map skipped via ?nomap.)"); return; } // dev aid
    if (typeof maplibregl === "undefined") { mapUnavailable("The map library didn't load."); return; }
    try {
      initMapInner();
    } catch (err) {
      console.warn("Map disabled:", err);
      mapUnavailable();
    }
  }
  function initMapInner() {
    map = new maplibregl.Map({
      container: "mapCanvas",
      style: styleURL(),
      center: [-117.2, 32.95],
      zoom: 9,
      minZoom: 7,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    for (const p of DATA.places) {
      const wrap = document.createElement("div");
      wrap.className = "pin-wrap";
      wrap.innerHTML = pinSVG(p);
      wrap.setAttribute("title", p.name);
      wrap.addEventListener("mouseenter", () => highlightCard(p.id, true));
      wrap.addEventListener("mouseleave", () => highlightCard(p.id, false));
      const popup = new maplibregl.Popup({ offset: 28, maxWidth: "300px" }).setHTML(popupHTML(p));
      const marker = new maplibregl.Marker({ element: wrap, anchor: "bottom" }).setLngLat([p.lng, p.lat]).setPopup(popup);
      markers[p.id] = { marker, added: false, p };
    }
    renderLegend();
    updateMap(true);
  }
  function updateMap(fit) {
    if (!map) return;
    const show = filtered();
    const ids = new Set(show.map((p) => p.id));
    for (const [id, m] of Object.entries(markers)) {
      if (ids.has(id) && !m.added) { m.marker.addTo(map); m.added = true; }
      else if (!ids.has(id) && m.added) { m.marker.remove(); m.added = false; }
    }
    if (fit && show.length) {
      const b = new maplibregl.LngLatBounds();
      for (const p of show) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding: { top: 70, bottom: 70, left: 70, right: 70 }, maxZoom: 14, duration: fit === true ? 0 : 800 });
    }
  }
  function renderLegend() {
    const el = $("#legend");
    el.innerHTML = `<p class="legend-title">What's what</p>` +
      DATA.categories.map((c) => `<button type="button" data-cat="${esc(c.id)}" class="${!state.cat || state.cat === c.id ? "is-active" : ""}" style="--dot:${catColor(c.id)}"><span class="dot"></span>${esc(c.label)}</button>`).join("") +
      `<p class="legend-note">Solid pins are exact. Dashed pins are a best guess at the neighborhood. Filled dot = to try, check = been.</p>`;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-cat]");
      if (!b) return;
      state.cat = state.cat === b.dataset.cat ? "" : b.dataset.cat;
      $("#cat").value = state.cat;
      update(true);
    });
  }
  function highlightCard(id, on) {
    const card = $(`.card[data-id="${CSS.escape(id)}"]`);
    if (card) card.style.borderColor = on ? "var(--accent)" : "";
  }
  function locate(id) {
    const m = markers[id];
    if (!m || !map) return;
    $("#map").scrollIntoView({ behavior: "smooth", block: "start" });
    if (!m.added) { m.marker.addTo(map); m.added = true; }
    setTimeout(() => {
      map.flyTo({ center: [m.p.lng, m.p.lat], zoom: 15, duration: 900 });
      map.once("moveend", () => { if (!m.marker.getPopup().isOpen()) m.marker.togglePopup(); });
    }, 350);
  }

  /* ---------------- surprise me ---------------- */
  function initPick() {
    const btn = $("#spin"), reel = $("#reel");
    btn.addEventListener("click", () => {
      let pool = filtered().filter((p) => !p.visited && !p.closed);
      if (!pool.length) pool = DATA.places.filter((p) => !p.visited && !p.closed);
      if (!pool.length) { reel.innerHTML = `<p class="reel-name">You've been everywhere.</p>`; return; }
      const winner = pool[Math.floor(Math.random() * pool.length)];
      btn.disabled = true;
      reel.classList.add("is-spinning");
      reel.innerHTML = `<p class="reel-name"></p>`;
      const nameEl = $(".reel-name", reel);
      let i = 0, delay = 40;
      const tick = () => {
        nameEl.textContent = pool[Math.floor(Math.random() * pool.length)].name;
        i++;
        delay = i < 14 ? 40 : delay * 1.28;
        if (delay < 420) setTimeout(tick, delay);
        else finish();
      };
      const finish = () => {
        nameEl.textContent = winner.name;
        reel.classList.remove("is-spinning");
        reel.insertAdjacentHTML("beforeend", `<div class="reel-card">${cardHTML(winner, DATA.places.filter((p) => p.category === winner.category).indexOf(winner) + 1, false)}</div>`);
        btn.disabled = false;
        btn.textContent = "Spin again";
      };
      tick();
    });
  }

  /* ---------------- the sky over San Diego ---------------- */
  const SKY = [
    // hour, top, mid, bottom, sun, glow, water-top, water-bottom, silhouette, stars, ink, inkSoft
    [0,    "#070b1c", "#0f1a3a", "#1b2a4a", "#e8ecf7", "rgba(200,215,255,.35)", "#122443", "#070f22", "#05080f", 1, "#f2ecdf", "rgba(242,236,223,.72)"],
    [4.5,  "#0b1230", "#1c2452", "#3a3563", "#e8ecf7", "rgba(200,215,255,.3)",  "#1a2a55", "#0a1330", "#0a0d18", .8, "#f2ecdf", "rgba(242,236,223,.72)"],
    [6,    "#2b2d5c", "#e08a5a", "#ffd6a5", "#fff3d0", "rgba(255,190,120,.6)",  "#4a6fa5", "#1b3a5c", "#1a1a2e", .1, "#1a1a2e", "rgba(26,26,46,.72)"],
    [8,    "#6aa9e6", "#bcdcf7", "#fbe9d0", "#fff8dc", "rgba(255,240,190,.55)", "#4b97d9", "#1e5a8a", "#1d2230", 0, "#171b23", "rgba(23,27,35,.72)"],
    [12,   "#3f8fe0", "#9ccbf5", "#e6f2fb", "#fffbe6", "rgba(255,250,210,.55)", "#3b8fd6", "#1b4f80", "#1d2230", 0, "#171b23", "rgba(23,27,35,.72)"],
    [16,   "#5c9fe0", "#bfd7ee", "#ffe2b8", "#fff1c2", "rgba(255,210,140,.55)", "#4f96d4", "#1f4f7c", "#1d2230", 0, "#171b23", "rgba(23,27,35,.72)"],
    [18,   "#ffb35c", "#ffd9a0", "#8fc1e8", "#fff1c2", "rgba(255,200,120,.6)",  "#4f9be8", "#1b4965", "#1d2230", 0, "#171b23", "rgba(23,27,35,.72)"],
    [19.5, "#f0704a", "#8c4f8a", "#2b2d5c", "#ffd7a3", "rgba(255,150,90,.6)",   "#3b3f7a", "#141b3a", "#0f1224", .3, "#f2ecdf", "rgba(242,236,223,.72)"],
    [21,   "#1a1f45", "#2b2d5c", "#16203d", "#eef0f7", "rgba(200,215,255,.35)", "#1b2a55", "#0b1330", "#070a15", .9, "#f2ecdf", "rgba(242,236,223,.72)"],
    [24,   "#070b1c", "#0f1a3a", "#1b2a4a", "#e8ecf7", "rgba(200,215,255,.35)", "#122443", "#070f22", "#05080f", 1, "#f2ecdf", "rgba(242,236,223,.72)"],
  ];
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgba = (s) => s.match(/[\d.]+/g).map(Number);
  const mixHex = (a, b, t) => `rgb(${hex2rgb(a).map((x, i) => Math.round(x + (hex2rgb(b)[i] - x) * t)).join(",")})`;
  const mixRgba = (a, b, t) => { const A = rgba(a), B = rgba(b); return `rgba(${A.map((x, i) => +(x + (B[i] - x) * t).toFixed(3)).join(",")})`; };
  const forcedHour = Number(new URLSearchParams(location.search).get("hour"));
  function sdHour() {
    if (forcedHour) return forcedHour; // dev aid: ?hour=17.5
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === "hour").value % 24, m = +parts.find((p) => p.type === "minute").value;
    return h + m / 60;
  }
  function paintSky(hour = sdHour()) {
    let a = SKY[0], b = SKY[1];
    for (let i = 0; i < SKY.length - 1; i++) if (hour >= SKY[i][0] && hour <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
    const t = (hour - a[0]) / (b[0] - a[0] || 1);
    const s = document.documentElement.style;
    const set = (k, v) => s.setProperty(k, v);
    set("--sky-top", mixHex(a[1], b[1], t)); set("--sky-mid", mixHex(a[2], b[2], t)); set("--sky-bottom", mixHex(a[3], b[3], t));
    set("--sun", mixHex(a[4], b[4], t)); set("--sun-glow", mixRgba(a[5], b[5], t));
    set("--water-top", mixHex(a[6], b[6], t)); set("--water-bottom", mixHex(a[7], b[7], t));
    set("--silhouette", mixHex(a[8], b[8], t));
    set("--stars", String(a[9] + (b[9] - a[9]) * t));
    set("--hero-ink", mixHex(a[10], b[10], t)); set("--hero-ink-soft", mixRgba(a[11], b[11], t));
    // Sun (or moon) arcs west across the frame from ~6am to ~7:30pm.
    const day = hour >= 5.75 && hour <= 19.75;
    const f = day ? (hour - 5.75) / 14 : ((hour + 24 - 19.75) % 24) / 10;
    // Keep it in the right-hand half so it never sits behind the headline.
    set("--sun-x", `${(97 - f * 32).toFixed(1)}%`);
    set("--sun-y", `${(56 - Math.sin(f * Math.PI) * 40).toFixed(1)}%`);
    set("--wave", day ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.18)");
    $("#sun").style.width = day ? "" : "clamp(60px, 7vw, 90px)";
  }
  const WMO = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy", 51: "drizzling", 53: "drizzling", 55: "drizzling", 61: "light rain", 63: "raining", 65: "pouring", 71: "snow, somehow", 80: "showers", 81: "showers", 82: "heavy showers", 95: "thunderstorms" };
  async function nowLine() {
    const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(new Date());
    const h = sdHour();
    const part = h < 5 ? "Late night" : h < 11 ? "Morning" : h < 16 ? "Afternoon" : h < 19.5 ? "Golden hour" : "Evening";
    let weather = "";
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=32.7157&longitude=-117.1611&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles", { signal: ctrl.signal });
      const j = await r.json();
      const t = Math.round(j.current.temperature_2m), w = WMO[j.current.weather_code] || "";
      weather = ` · ${t}°F${w ? ` and ${w}` : ""}`;
    } catch { /* fine without it */ }
    $("#nowText").textContent = `${part} in San Diego · ${time}${weather}`;
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    try { const t = localStorage.getItem("sd-theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
    $("#themeToggle").addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("sd-theme", next); } catch {}
      if (map) setTiles();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (map && !document.documentElement.dataset.theme) setTiles(); });
  }

  /* ---------------- glue ---------------- */
  function update(fit) {
    writeHash();
    renderCollections();
    renderCount();
    updateMap(fit ?? "soft");
    $$("#legend button[data-cat]").forEach((b) => b.classList.toggle("is-active", !state.cat || state.cat === b.dataset.cat));
  }

  readHash();
  initTheme();
  paintSky();
  setInterval(paintSky, 60_000);
  nowLine();
  setInterval(nowLine, 60_000);
  renderNumbers();
  initToolbar();
  initPick();
  update();
  // The map is the heaviest thing on the page: start it once the section is near the viewport.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); initMap(); }
    }, { rootMargin: "800px 0px" });
    io.observe($("#map"));
  } else {
    initMap();
  }
  $("#generated").textContent = `Last built ${new Date(DATA.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-locate]");
    if (b) locate(b.dataset.locate);
  });
  document.addEventListener("mouseover", (e) => {
    const c = e.target.closest(".card[data-id]");
    if (c && markers[c.dataset.id]) markers[c.dataset.id].marker.getElement().querySelector(".pin").classList.add("is-hover");
  });
  document.addEventListener("mouseout", (e) => {
    const c = e.target.closest(".card[data-id]");
    if (c && markers[c.dataset.id]) markers[c.dataset.id].marker.getElement().querySelector(".pin").classList.remove("is-hover");
  });
  window.addEventListener("hashchange", () => { readHash(); initToolbarValues(); update(true); });
  function initToolbarValues() {
    $("#q").value = state.q; $("#area").value = state.area; $("#cat").value = state.cat;
    $$(".segment button").forEach((b) => b.classList.toggle("is-active", b.dataset.status === state.status));
  }
})();
