/** =====================================================================
   Village Finder — map application (one build, any state)
   Single-state app: config.js (window.VF_CONFIG) selects the state.
   Data: data/{regions,villages,meta,coords,names,names_translit,regions_native}.json
         + data/{districts,mandals}.geojson
   UI text + place-name transliteration: i18n.js (window.VF_I18N)

   @module web/app
   @file Leaflet map application that renders a single state's districts,
   sub-districts (mandals/taluks) and villages from the LGD open data,
   with search, drill-down panels, i18n place names and on-demand nearby
   civic services.
   ===================================================================== */
/**
 * @typedef {Array<(string|number)>} VillageRow
 * A village record from `villages.json` → `rows`:
 * `[name, mandalIndex, lgdCode, category (0 = rural, 1 = urban), pincode?]`.
 */
/**
 * @typedef {Object} District  A district from `regions.json` → `districts`.
 * @property {number} c   LGD district code.
 * @property {string} n   English name.
 * @property {number} i   Index into `regions.districts`.
 * @property {number} vc  Village count.
 */
/**
 * @typedef {Object} Mandal  A sub-district (mandal/taluk) from `regions.json` → `mandals`.
 * @property {number} c   LGD sub-district code.
 * @property {string} n   English name.
 * @property {number} i   Index into `regions.mandals`.
 * @property {number} d   Parent district index (into `regions.districts`).
 * @property {number} vc  Village count.
 */
/**
 * @typedef {Object} Regions  Parsed `regions.json`.
 * @property {District[]} districts
 * @property {Mandal[]} mandals
 */
/**
 * @typedef {Object} VFConfig  Per-state config injected as `window.VF_CONFIG` (config.js).
 * @property {string}  state         Display name of the state.
 * @property {string}  [slug]        State slug (andhra_pradesh | telangana | karnataka | tamil_nadu).
 * @property {string}  [accent]      Accent colour (hex).
 * @property {string}  [accentSoft]  Soft accent colour (hex).
 * @property {string}  [nativeLang]  The state's own language code (te | kn | ta).
 * @property {("mandal"|"taluk")} [division]  Sub-district term.
 * @property {{url: string}} [source]         Data-source link.
 * @property {Array<{name: string, url: string}>} [siblings]  Other state apps.
 * @property {Object} [counts]       Headline counts.
 * @property {string} [sourceDate]   LGD dump date.
 * @property {CadastreConfig} [cadastre]  Optional land-parcel (cadastral) vector layer.
 */
/**
 * @typedef {Object} CadastreConfig  Optional PMTiles land-parcel layer config.
 * @property {string} url          PMTiles URL (served via HTTP range requests).
 * @property {string} sourceLayer  Vector layer id inside the PMTiles.
 * @property {number} minZoom      Leaflet zoom at which parcels become visible.
 * @property {number} tileMaxZoom  PMTiles maxzoom (display overzooms beyond this).
 * @property {string} [attribution]  HTML attribution string for the parcel source.
 */
(function () {
  "use strict";
  var CFG = window.VF_CONFIG || {};
  var DATA = "data/";

  // ---- i18n ------------------------------------------------------------
  var I18N = window.VF_I18N || {
    LANGS: [{ code: "en", name: "English", dir: "ltr" }],
    t: function (l, k) {
      return k;
    },
    translit: function (l, n) {
      return n;
    },
    dirOf: function () {
      return "ltr";
    }
  };
  var LANG = (function () {
    try {
      var saved = localStorage.getItem("vf_lang");
      if (
        saved &&
        I18N.LANGS.some(function (L) {
          return L.code === saved;
        })
      )
        return saved;
    } catch (e) {}
    return "en";
  })();
  /**
   * Translate a UI string for the current language.
   * @param {string} key  Dictionary key.
   * @param {Object} [params]  `{n}`-style placeholder values.
   * @returns {string} Localised text.
   */
  function t(key, params) {
    return I18N.t(LANG, key, params);
  } // UI string
  /**
   * Transliterate a Roman place name into the current language's script.
   * @param {string} name  English place name.
   * @returns {string} Native-script (or unchanged) name.
   */
  function nm(name) {
    return I18N.translit(LANG, name);
  } // place name
  /**
   * Village display name, in preference order when the chosen language is the state's
   * official one: (1) the authoritative LGD native spelling, (2) a neural
   * transliteration precomputed offline (names_translit.json, IndicXlit), (3) the
   * rule-based UI transliteration. Anything else falls back to (3).
   * @param {VillageRow} row  The village record.
   * @returns {string} Display name.
   */
  function vname(row) {
    if (CFG.nativeLang && LANG === CFG.nativeLang) {
      var loc = localNames[row[2]];
      if (loc) return loc;
      var nt = translitNames[row[2]];
      if (nt) return nt;
    }
    return nm(row[0]);
  }
  /**
   * District / sub-district / state names: prefer the committed native name
   * (regions_native.json) when the chosen language is the state's own, else fall back
   * to rule-based transliteration. (LGD publishes no local-script name for these.)
   * @param {number} code  LGD code.
   * @param {string} english  English name.
   * @param {("districts"|"mandals")} tier  Which native-name map to consult.
   * @returns {string} Display name.
   */
  function rn(code, english, tier) {
    if (CFG.nativeLang && LANG === CFG.nativeLang) {
      var map = regionNative[tier];
      if (map && map[code]) return map[code];
    }
    return nm(english);
  }
  /**
   * District display name.
   * @param {District} d  The district.
   * @returns {string} Display name.
   */
  function rdist(d) {
    return rn(d.c, d.n, "districts");
  }
  /**
   * Sub-district display name.
   * @param {Mandal} m  The mandal/taluk.
   * @returns {string} Display name.
   */
  function rmand(m) {
    return rn(m.c, m.n, "mandals");
  }
  /**
   * State display name (native when the chosen language is the state's own).
   * @returns {string} Display name.
   */
  function sname() {
    if (CFG.nativeLang && LANG === CFG.nativeLang && regionNative.state) return regionNative.state;
    return nm(CFG.state || "");
  }
  // Sub-district tier term: "mandal" (AP/Telangana) or "taluk" (Karnataka).
  // The data still stores this tier under regions.mandals; only the label changes.
  var DIV = CFG.division === "taluk" ? "taluk" : "mandal";
  /**
   * Plural sub-district label ("Mandals"/"Taluks").
   * @param {Object} [params]  Placeholder values.
   * @returns {string} Localised label.
   */
  function tdivs(params) {
    return t(DIV + "s", params);
  } // plural label
  /**
   * "{n} mandals/taluks" label.
   * @param {Object} [params]  Placeholder values (expects `n`).
   * @returns {string} Localised label.
   */
  function tdivN(params) {
    return t("n_" + DIV + "s", params);
  } // "{n} mandals/taluks"

  // ---- tiny DOM helpers ------------------------------------------------
  /**
   * `querySelector` shorthand.
   * @param {string} s  CSS selector.
   * @param {(Element|Document)} [r]  Root to search within (defaults to document).
   * @returns {(Element|null)} First match.
   */
  function $(s, r) {
    return (r || document).querySelector(s);
  }
  /**
   * Create an element with an optional class and inner HTML.
   * @param {string} tag  Tag name.
   * @param {string} [cls]  Class name.
   * @param {string} [html]  Inner HTML.
   * @returns {HTMLElement} The new element.
   */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  /**
   * Format a number with Indian digit grouping.
   * @param {number} n  The number.
   * @returns {string} Grouped string.
   */
  function fmt(n) {
    return (n || 0).toLocaleString("en-IN");
  }
  /**
   * Normalise a string for case/whitespace-insensitive sorting & matching.
   * @param {string} s  Input.
   * @returns {string} Lowercased, collapsed-whitespace, trimmed string.
   */
  function norm(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  /**
   * HTML-escape a string for safe interpolation.
   * @param {string} s  Input.
   * @returns {string} Escaped string.
   */
  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /**
   * Fetch and parse a JSON data file.
   * @param {string} name  File name under `data/`.
   * @returns {Promise<*>} Parsed JSON.
   */
  async function fetchJSON(name) {
    var r = await fetch(DATA + name);
    if (!r.ok) throw new Error("Failed to load " + name + " (" + r.status + ")");
    return r.json();
  }

  // ---- colour ramp from the state accent -------------------------------
  /**
   * Parse a `#rrggbb` hex colour into RGB components.
   * @param {string} h  Hex colour.
   * @returns {number[]} `[r, g, b]`.
   */
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  var ACCENT = CFG.accent || "#1f6feb";
  var ACC_RGB = hexToRgb(ACCENT);
  /**
   * Interpolate the accent colour towards white.
   * @param {number} t2  0 → white, 1 → accent.
   * @returns {string} CSS `rgb(...)` colour.
   */
  function tint(t2) {
    // t2=0 -> white, t2=1 -> accent
    var r = ACC_RGB.map(function (c) {
      return Math.round(255 + (c - 255) * t2);
    });
    return "rgb(" + r[0] + "," + r[1] + "," + r[2] + ")";
  }
  var RAMP = [0.1, 0.26, 0.44, 0.62, 0.8, 1.0].map(tint);
  var NODATA = "#e9edf2";

  /**
   * Compute `n-1` quantile break points over the positive values.
   * @param {number[]} values  Raw values (zeros ignored).
   * @param {number} n  Number of classes (returns `n-1` breaks).
   * @returns {number[]} Ascending break values.
   */
  function quantileBreaks(values, n) {
    var v = values
      .filter(function (x) {
        return x > 0;
      })
      .sort(function (a, b) {
        return a - b;
      });
    if (!v.length) return [];
    var breaks = [];
    for (var i = 1; i < n; i++) {
      var pos = (v.length - 1) * (i / n);
      var lo = Math.floor(pos),
        hi = Math.ceil(pos);
      breaks.push(Math.round(v[lo] + (v[hi] - v[lo]) * (pos - lo)));
    }
    return breaks;
  }
  /**
   * Pick a ramp colour for a count given quantile breaks.
   * @param {number} count  Village count (0 → no-data colour).
   * @param {number[]} breaks  Break points from {@link quantileBreaks}.
   * @returns {string} CSS colour string.
   */
  function colorFor(count, breaks) {
    if (!count) return NODATA;
    for (var i = 0; i < breaks.length; i++) if (count <= breaks[i]) return RAMP[i];
    return RAMP[RAMP.length - 1];
  }

  // ---- state -----------------------------------------------------------
  var regions,
    villages,
    geoD,
    geoM,
    meta,
    coords = {},
    localNames = {},
    translitNames = {};
  var regionNative = {}; // { state, districts:{code:native}, mandals:{code:native} }
  var parcelIndex = {}; // { lgdCode: [minLat, minLng, maxLat, maxLng] } — parcel extents
  var dByCode = {},
    mByCode = {};
  var villagesByMandal = [];
  var dBreaks = [],
    fuse = null;
  var map, dLayer, mLayer, marker;
  var cadLayer = null, // MapLibre-GL cadastral (land-parcel) overlay, or null
    cadOn = false, // whether the parcel layer is currently toggled on
    cadPopup = null, // Leaflet popup for a clicked parcel
    cadToggleBtn = null; // the "land parcels" toggle control button
  var dLayerByCode = {},
    mLayerByCode = {};
  var view = { level: "state", d: null, m: null }; // d,m = region objects

  init();

  /**
   * Bootstrap: apply theme/i18n chrome, load all data files, then build the
   * index, search, map and the initial district view.
   * @returns {Promise<void>}
   */
  async function init() {
    applyTheme();
    buildLangSwitch();
    buildSwitch();
    applyI18n();
    try {
      var res = await Promise.all([
        fetchJSON("regions.json"),
        fetchJSON("villages.json"),
        fetchJSON("districts.geojson"),
        fetchJSON("mandals.geojson"),
        fetchJSON("meta.json").catch(function () {
          return null;
        }),
        fetchJSON("coords.json").catch(function () {
          return {};
        }),
        fetchJSON("names.json").catch(function () {
          return {};
        }),
        fetchJSON("names_translit.json").catch(function () {
          return {};
        }),
        fetchJSON("regions_native.json").catch(function () {
          return {};
        }),
        // Optional: precomputed village -> parcel bbox (only present where a
        // cadastral layer is configured). { lgdCode: [minLat,minLng,maxLat,maxLng] }
        CFG.cadastre
          ? fetchJSON("parcels_index.json").catch(function () {
              return {};
            })
          : Promise.resolve({})
      ]);
      regions = res[0];
      villages = res[1];
      geoD = res[2];
      geoM = res[3];
      meta = res[4];
      coords = res[5] || {};
      localNames = res[6] || {};
      translitNames = res[7] || {};
      regionNative = res[8] || {};
      parcelIndex = res[9] || {};
    } catch (e) {
      $("#map-loading").textContent = "Could not load data: " + e.message;
      return;
    }
    indexData();
    buildFuse();
    initMap();
    showDistrictView(true);
    setFreshness();
    wireSearch();
    wireChrome();
    wireCadastre();
  }

  // ---- theming + chrome ------------------------------------------------
  /**
   * Set the brand CSS custom properties from the state accent colours.
   * @returns {void}
   */
  function applyTheme() {
    var s = document.documentElement.style;
    s.setProperty("--brand", CFG.accent || "#1f6feb");
    s.setProperty("--brand-soft", CFG.accentSoft || "#eaf2ff");
  }

  /**
   * Apply all language-dependent chrome (text direction, static labels, brand).
   * @returns {void}
   */
  function applyI18n() {
    document.documentElement.setAttribute("lang", LANG);
    var dir = I18N.dirOf(LANG);
    var sb = $("#sidebar");
    if (sb) sb.setAttribute("dir", dir);

    var h1 = $(".brand h1");
    if (h1) h1.textContent = t("village_finder");
    var bh = $("#brand-home");
    if (bh) {
      bh.title = t("home");
      bh.setAttribute("aria-label", t("home"));
    }
    var sub = $(".brand-sub");
    if (sub) sub.textContent = sname();
    document.title = sname() + " " + t("village_finder");
    var srcHref = $("#src-link");
    if (srcHref && CFG.source) srcHref.href = CFG.source.url;

    var s = $("#search");
    if (s) s.placeholder = t("search_ph");
    var cb = $("#collapse-btn");
    if (cb) cb.title = t("hide_panel");
    var ss = $("#show-sidebar");
    if (ss) ss.title = t("show_panel");
    var cs = $("#clear-search");
    if (cs) cs.title = t("clear");
    var srcL = $("#src-link");
    if (srcL) srcL.textContent = t("data_lgd");
    var issL = $("#issue-link");
    if (issL) issL.textContent = t("report_issue");
    var srcLink = $("#source-link");
    if (srcLink) srcLink.textContent = t("source");
    var lw = $("#lang-wrap");
    if (lw) lw.title = t("language");
    var ml = $("#map-loading");
    if (ml && !ml.classList.contains("hidden")) ml.textContent = t("loading_map");
  }

  /**
   * Populate the language `<select>` from `I18N.LANGS` and wire its change handler.
   * @returns {void}
   */
  function buildLangSwitch() {
    var sel = $("#lang-select");
    if (!sel) return;
    sel.innerHTML = "";
    I18N.LANGS.forEach(function (L) {
      var o = document.createElement("option");
      o.value = L.code;
      o.textContent = L.name;
      if (L.code === LANG) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () {
      setLang(sel.value);
    };
  }

  /**
   * Switch the active language, persist it, and re-render all chrome and views.
   * @param {string} code  New language code.
   * @returns {void}
   */
  function setLang(code) {
    if (code === LANG) return;
    LANG = code;
    try {
      localStorage.setItem("vf_lang", code);
    } catch (e) {}
    applyI18n();
    buildSwitch();
    setFreshness();
    refreshView(); // re-render panel, breadcrumb, legend and map tooltips
  }

  /**
   * Re-render whatever drill level we're on so all text/tooltips pick up LANG.
   * @returns {void}
   */
  function refreshView() {
    if (!regions) return;
    var inSearch = $("#search") && $("#search").value.trim().length >= 2;
    if (inSearch) {
      runSearch($("#search").value);
    }
    if (view.level === "mandal" && view.m) selectMandal(view.m);
    else if (view.level === "district" && view.d) selectDistrict(view.d);
    else showDistrictView(false);
    if (inSearch) runSearch($("#search").value);
  }

  /**
   * Build the current-state button plus links to sibling state apps.
   * @returns {void}
   */
  function buildSwitch() {
    var box = $("#state-switch");
    if (!box) return;
    box.innerHTML = "";
    var cur = el("button", "active", esc(sname()));
    cur.title = t("currently_viewing", { state: CFG.state });
    box.appendChild(cur);
    (CFG.siblings || []).forEach(function (sib) {
      var a = document.createElement("a");
      a.href = sib.url;
      a.textContent = nm(sib.name);
      a.title = sib.name;
      a.className = "seg-link";
      box.appendChild(a);
    });
  }
  /**
   * Render the "Updated &lt;date&gt; · N villages" freshness line.
   * @returns {void}
   */
  function setFreshness() {
    var c = CFG.counts || (meta && meta.counts) || {};
    var date = CFG.sourceDate || (meta && meta.source_date) || "";
    $("#freshness").innerHTML =
      esc(t("updated")) +
      " <b>" +
      esc(date) +
      "</b> · " +
      esc(t("n_villages", { n: fmt(c.villages) }));
  }
  /**
   * Wire the sidebar collapse / show toggles (with a deferred map resize).
   * @returns {void}
   */
  function wireChrome() {
    var app = $("#app");
    $("#collapse-btn").onclick = function () {
      app.classList.add("collapsed");
      $("#show-sidebar").classList.remove("hidden");
      setTimeout(resizeMap, 320);
    };
    $("#show-sidebar").onclick = function () {
      app.classList.remove("collapsed");
      $("#show-sidebar").classList.add("hidden");
      setTimeout(resizeMap, 320);
    };
  }
  /**
   * Tell Leaflet to recompute its size (after a layout change).
   * @returns {void}
   */
  function resizeMap() {
    if (map) map.invalidateSize();
  }

  // ---- indexing --------------------------------------------------------
  /**
   * Build code→region lookups, group village rows by mandal, and compute the
   * district colour breaks.
   * @returns {void}
   */
  function indexData() {
    regions.districts.forEach(function (d) {
      dByCode[d.c] = d;
    });
    regions.mandals.forEach(function (m) {
      mByCode[m.c] = m;
    });
    villagesByMandal = regions.mandals.map(function () {
      return [];
    });
    villages.rows.forEach(function (row) {
      // row: [name, mandalIdx, code, cat, pin]
      var mi = row[1];
      if (villagesByMandal[mi]) villagesByMandal[mi].push(row);
    });
    dBreaks = quantileBreaks(
      regions.districts.map(function (d) {
        return d.vc;
      }),
      RAMP.length
    );
  }

  /**
   * Build the Fuse.js index. Search always indexes the canonical English names
   * + PIN (most reliable), regardless of the chosen display language.
   * @returns {void}
   */
  function buildFuse() {
    var items = [];
    regions.districts.forEach(function (d) {
      items.push({ t: "d", name: d.n, ref: d });
    });
    regions.mandals.forEach(function (m) {
      items.push({ t: "m", name: m.n, ref: m });
    });
    villages.rows.forEach(function (row) {
      items.push({ t: "v", name: row[0], pin: row[4] || "", ref: row });
    });
    fuse = new Fuse(items, {
      keys: [
        { name: "name", weight: 0.85 },
        { name: "pin", weight: 0.15 }
      ],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
      getFn: function (obj, path) {
        var v = obj[path] || "";
        return [v, v.replace(/\s+/g, "")];
      }
    });
  }

  // ---- map -------------------------------------------------------------
  /**
   * Create the Leaflet map, base tile layer and the regions pane.
   * @returns {void}
   */
  function initMap() {
    // maxZoom is 18 (not 13) so users can zoom in far enough to read individual
    // land parcels when the cadastral layer is present; region choropleths simply
    // stay at their last resolution above 13.
    // Zoom buttons live on the right so they don't collide with the sidebar toggle.
    map = L.map("map", { zoomControl: false, attributionControl: true, minZoom: 5, maxZoom: 18 });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    map.createPane("regions");
    map.getPane("regions").style.zIndex = 410;
    // The cadastral canvas needs its own pane ABOVE the region choropleth (410),
    // otherwise the ~0.85-opacity district/mandal fills paint over the parcels
    // and hide them. Below the marker pane (600) so village pins stay on top.
    map.createPane("cadastre");
    map.getPane("cadastre").style.zIndex = 420;
    map.getPane("cadastre").style.pointerEvents = "none";
    initCadastre();
  }

  /**
   * Set up the optional cadastral (land-parcel) vector layer as a MapLibre-GL
   * overlay inside the Leaflet map, driven by `CFG.cadastre`. Parcels are drawn
   * from a PMTiles archive streamed via HTTP range requests, so only the tiles
   * for the current view are fetched. The layer defaults to OFF and is added on
   * demand by the toggle control; clicks are identified in `wireCadastre()`.
   * No-op when the state has no `cadastre` config or the libraries are missing.
   * @returns {void}
   */
  function initCadastre() {
    var C = CFG.cadastre;
    if (!C || !window.maplibregl || !window.pmtiles || !L.maplibreGL) return;
    // Register the pmtiles:// protocol once so MapLibre can read range requests.
    if (!initCadastre._proto) {
      initCadastre._proto = new pmtiles.Protocol();
      maplibregl.addProtocol("pmtiles", initCadastre._proto.tile);
    }
    var accent = CFG.accent || "#1f6feb";
    // maplibre-gl-leaflet renders one zoom level behind Leaflet (256 vs 512 px
    // tiles), so a GL layer minzoom of N shows at Leaflet zoom N+1. Subtract 1 so
    // parcels actually appear at the configured Leaflet minZoom.
    var mz = (C.minZoom || 11) - 1;
    // Dev/testing override: `?cad=<url>` points the parcel layer at an alternate
    // tile host (e.g. a local same-origin file, or a CORS mirror under test)
    // without editing the generated config. Falls back to the configured URL.
    var url = C.url;
    try {
      var override = new URLSearchParams(location.search).get("cad");
      if (override) url = override;
    } catch (e) {}
    cadLayer = L.maplibreGL({
      // Draw into the dedicated high pane (above the region choropleth); Leaflet
      // keeps pointer control and we query the GL map manually on click.
      pane: "cadastre",
      interactive: false,
      attribution: C.attribution || "",
      style: {
        version: 8,
        sources: {
          cad: { type: "vector", url: "pmtiles://" + url, maxzoom: C.tileMaxZoom || 13 }
        },
        layers: [
          {
            id: "cad-fill",
            type: "fill",
            source: "cad",
            "source-layer": C.sourceLayer,
            // Rendered wherever lines are (very faint) so click-to-identify works
            // at any parcel zoom; too light to muddy the map.
            minzoom: mz,
            paint: { "fill-color": accent, "fill-opacity": 0.04 }
          },
          {
            id: "cad-line",
            type: "line",
            source: "cad",
            "source-layer": C.sourceLayer,
            minzoom: mz,
            // Dark neutral outline so parcels read on any state accent / basemap.
            paint: {
              "line-color": "#3f3f46",
              "line-opacity": 0.85,
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.2, 16, 1.1]
            }
          },
          {
            // Highlight layer for the currently selected village's parcels.
            id: "cad-sel",
            type: "line",
            source: "cad",
            "source-layer": C.sourceLayer,
            minzoom: mz,
            filter: ["boolean", false], // nothing until a village is picked
            paint: { "line-color": accent, "line-opacity": 1, "line-width": 2 }
          }
        ]
      }
    });
  }

  /**
   * Wire the "land parcels" toggle control, click-to-identify and zoom hint for
   * the cadastral layer. No-op when the layer is unavailable.
   * @returns {void}
   */
  function wireCadastre() {
    if (!cadLayer) return;
    try {
      cadOn = localStorage.getItem("vf_parcels") === "1";
    } catch (e) {}

    var Ctl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        var b = L.DomUtil.create("button", "icon-btn cad-toggle");
        b.type = "button";
        b.title = t("parcels_toggle");
        b.setAttribute("aria-label", t("parcels_toggle"));
        b.innerHTML = "▦";
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, "click", function () {
          setParcels(!cadOn);
        });
        cadToggleBtn = b;
        return b;
      }
    });
    map.addControl(new Ctl());
    if (cadOn) setParcels(true);

    // Identify the parcel under a click by querying the embedded GL map.
    map.on("click", function (e) {
      if (!cadOn || map.getZoom() < (CFG.cadastre.minZoom || 14)) return;
      var gl = cadLayer.getMaplibreMap && cadLayer.getMaplibreMap();
      if (!gl) return;
      var pt = gl.project([e.latlng.lng, e.latlng.lat]);
      var hits = gl.queryRenderedFeatures(pt, { layers: ["cad-fill"] });
      if (hits && hits.length) showParcel(hits[0].properties, e.latlng);
    });

    map.on("zoomend", function () {
      updateRegionDim();
      if (cadOn && map.getZoom() < (CFG.cadastre.minZoom || 14)) toast(t("parcels_zoom_hint"));
    });
  }

  /**
   * Fade the region choropleth back while parcels are shown at parcel zoom, so
   * the land-parcel outlines aren't washed out by the district/mandal fills.
   * @returns {void}
   */
  function updateRegionDim() {
    var pane = map.getPane("regions");
    if (!pane) return;
    var dim = cadOn && cadLayer && map.getZoom() >= (CFG.cadastre.minZoom || 14);
    pane.style.opacity = dim ? "0.15" : "";
  }

  /**
   * Turn the parcel layer on/off, persist the choice and reflect it on the toggle.
   * @param {boolean} on  Desired state.
   * @returns {void}
   */
  function setParcels(on) {
    cadOn = !!on;
    if (cadOn) {
      cadLayer.addTo(map);
    } else {
      clearParcelHighlight();
      if (map.hasLayer(cadLayer)) map.removeLayer(cadLayer);
      if (cadPopup) map.closePopup(cadPopup);
    }
    if (cadToggleBtn) {
      cadToggleBtn.classList.toggle("active", cadOn);
      cadToggleBtn.setAttribute("aria-pressed", cadOn ? "true" : "false");
    }
    try {
      localStorage.setItem("vf_parcels", cadOn ? "1" : "0");
    } catch (e) {}
    updateRegionDim();
    if (cadOn && map.getZoom() < (CFG.cadastre.minZoom || 14)) toast(t("parcels_zoom_hint"));
  }

  /**
   * Show a popup describing a clicked land parcel.
   * @param {Object} props   Vector-tile feature properties (parcel_num, v_name, …).
   * @param {Object} latlng  Leaflet LatLng of the click.
   * @returns {void}
   */
  function showParcel(props, latlng) {
    props = props || {};
    var survey = props.parcel_num || "";
    var place = [props.v_name, props.m_name, props.d_name]
      .filter(Boolean)
      .join(" · ");
    var area = props.shape_area ? Math.round(Number(props.shape_area)) : null;
    var wrap = el("div", "vpop cad-pop");
    wrap.setAttribute("dir", I18N.dirOf(LANG));
    wrap.addEventListener("click", function (ev) {
      ev.stopPropagation();
    });
    wrap.innerHTML =
      '<div class="vpop-name">' +
      esc(t("parcel_title")) +
      "</div>" +
      (survey
        ? '<div class="vpop-tags"><span class="vpop-code">' +
          esc(t("survey_no")) +
          " " +
          esc(survey) +
          "</span></div>"
        : "") +
      (place ? '<div class="vpop-meta">' + esc(place) + "</div>" : "") +
      (area != null
        ? '<div class="vpop-meta">' + esc(t("parcel_area", { n: fmt(area) })) + "</div>"
        : "") +
      '<div class="vpop-note">' +
      esc(t("cad_snapshot_note")) +
      "</div>";
    if (cadPopup) map.closePopup(cadPopup);
    cadPopup = L.popup({ className: "village-popup", maxWidth: 280 })
      .setLatLng(latlng)
      .setContent(wrap)
      .openOn(map);
  }

  var CAD_HIDE_FILTER = ["boolean", false]; // matches nothing

  /**
   * Drill into a single village's land parcels: enable the layer, move to the
   * village and highlight its plots. Only 16% of villages have a point coord, so
   * we locate the village from the cadastral data itself — highlight by name,
   * bring the mandal into view so its parcels render, then fit tight to the
   * highlighted parcels. All parcels stay visible (a name miss never blanks the
   * map); the selected village's outline is emphasised.
   * @param {VillageRow} row  The village record.
   * @param {Mandal} m  The parent mandal.
   * @param {Object} [center]  Leaflet LatLng of the village (from coords), if known.
   * @returns {void}
   */
  function showVillageParcels(row, m, center) {
    if (!cadLayer) return;
    if (!cadOn) setParcels(true);
    highlightVillageParcels(row);
    var box = parcelIndex[row[2]];
    if (box) {
      // Precomputed parcel extent for this exact village (LGD code): fit directly.
      map.fitBounds(
        [
          [box[0], box[1]],
          [box[2], box[3]]
        ],
        { padding: [40, 40], maxZoom: 17 }
      );
    } else if (center) {
      // Known point coordinate: go there, then fit to the rendered parcels.
      map.setView(center, Math.max(CFG.cadastre.minZoom || 11, 16), { animate: true });
      fitToVillageParcels(row, 0);
    } else {
      // No index entry and no coordinate: show the mandal so its parcels render,
      // then tighten onto this village's plots (best-effort name match).
      var lyr = mLayerByCode[m.c];
      if (lyr) map.fitBounds(lyr.getBounds(), { padding: [20, 20] });
      fitToVillageParcels(row, 0);
    }
  }

  /**
   * After the highlight is applied, query the rendered highlighted parcels and
   * fit the map tightly to them — this pinpoints the village precisely even with
   * no point coordinate. Retries a few times while tiles stream in; toasts if the
   * village has no matching parcels (missing cadastre or a name-spelling drift).
   * @param {VillageRow} row  The village record.
   * @param {number} tries  Current attempt count.
   * @returns {void}
   */
  function fitToVillageParcels(row, tries) {
    var gl = cadLayer && cadLayer.getMaplibreMap && cadLayer.getMaplibreMap();
    if (!gl) return;
    var run = function () {
      var feats = gl.getLayer("cad-sel") ? gl.queryRenderedFeatures({ layers: ["cad-sel"] }) : [];
      if (feats && feats.length) {
        var b = L.latLngBounds([]);
        feats.forEach(function (f) {
          eachCoord(f.geometry, function (lng, lat) {
            b.extend([lat, lng]);
          });
        });
        if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
      } else if (tries < 6) {
        setTimeout(function () {
          fitToVillageParcels(row, tries + 1);
        }, 450);
      } else {
        toast(t("parcels_none", { name: vname(row) }));
      }
    };
    if (gl.isStyleLoaded()) run();
    else gl.once("idle", run);
  }

  /**
   * Walk every [lng, lat] position in a GeoJSON geometry.
   * @param {Object} geom  GeoJSON geometry.
   * @param {function(number, number):void} fn  Called with (lng, lat).
   * @returns {void}
   */
  function eachCoord(geom, fn) {
    if (!geom) return;
    (function walk(c) {
      if (typeof c[0] === "number") fn(c[0], c[1]);
      else for (var i = 0; i < c.length; i++) walk(c[i]);
    })(geom.coordinates || []);
  }

  /**
   * Set the cadastral highlight filter to the given village, matching its LGD
   * name against `v_name` case-insensitively and tolerating the (U)/(R) urban/
   * rural suffixes the parcel data appends.
   * @param {VillageRow} row  The village record (row[0] = English name).
   * @returns {void}
   */
  function highlightVillageParcels(row) {
    var gl = cadLayer && cadLayer.getMaplibreMap && cadLayer.getMaplibreMap();
    if (!gl) return;
    var n = (row[0] || "").toLowerCase();
    var filter = [
      "in",
      ["downcase", ["get", "v_name"]],
      ["literal", [n, n + " (u)", n + " (r)"]]
    ];
    var apply = function () {
      if (gl.getLayer("cad-sel")) gl.setFilter("cad-sel", filter);
    };
    if (gl.isStyleLoaded()) apply();
    else gl.once("load", apply);
  }

  /**
   * Clear the cadastral highlight (no village emphasised).
   * @returns {void}
   */
  function clearParcelHighlight() {
    var gl = cadLayer && cadLayer.getMaplibreMap && cadLayer.getMaplibreMap();
    if (gl && gl.getLayer && gl.getLayer("cad-sel")) gl.setFilter("cad-sel", CAD_HIDE_FILTER);
  }

  /**
   * Leaflet style function for a district feature (choropleth by village count).
   * @param {Object} f  GeoJSON feature.
   * @returns {Object} Leaflet path style.
   */
  function styleDistrict(f) {
    var d = dByCode[f.properties.c];
    return {
      pane: "regions",
      color: "#ffffff",
      weight: 1.2,
      fillOpacity: 0.85,
      fillColor: colorFor(d ? d.vc : 0, dBreaks)
    };
  }
  /**
   * Leaflet style function for a mandal feature (choropleth by village count).
   * @param {Object} f  GeoJSON feature.
   * @param {number[]} breaks  Quantile breaks for this district's mandals.
   * @returns {Object} Leaflet path style.
   */
  function styleMandal(f, breaks) {
    var m = mByCode[f.properties.c];
    return {
      pane: "regions",
      color: "#ffffff",
      weight: 1,
      fillOpacity: 0.82,
      fillColor: colorFor(m ? m.vc : 0, breaks)
    };
  }

  /**
   * Remove all region layers and the village marker from the map.
   * @returns {void}
   */
  function clearLayers() {
    if (dLayer) {
      map.removeLayer(dLayer);
      dLayer = null;
    }
    if (mLayer) {
      map.removeLayer(mLayer);
      mLayer = null;
    }
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    dLayerByCode = {};
    mLayerByCode = {};
  }

  // ---- DISTRICT (state) view ------------------------------------------
  /**
   * Render the top-level (state) view: all district polygons, breadcrumb,
   * state panel and legend.
   * @param {boolean} fit  Whether to fit the map to the district bounds.
   * @returns {void}
   */
  function showDistrictView(fit) {
    view = { level: "state", d: null, m: null };
    clearLayers();
    dLayer = L.geoJSON(geoD, {
      style: styleDistrict,
      onEachFeature: function (f, layer) {
        var d = dByCode[f.properties.c];
        dLayerByCode[f.properties.c] = layer;
        layer.bindTooltip(
          tip(
            rn(f.properties.c, f.properties.n, "districts"),
            d ? t("n_villages", { n: fmt(d.vc) }) : ""
          ),
          { sticky: true, className: "region-tip", direction: "top" }
        );
        layer.on({
          mouseover: function () {
            layer.setStyle({ weight: 2.4, color: "#334155" });
            layer.bringToFront();
          },
          mouseout: function () {
            dLayer.resetStyle(layer);
          },
          click: function () {
            if (d) selectDistrict(d);
          }
        });
      }
    }).addTo(map);
    if (fit) map.fitBounds(dLayer.getBounds(), { padding: [20, 20] });
    renderBreadcrumb();
    renderStatePanel();
    renderLegend(dBreaks, t("villages_per_district"));
    $("#map-loading").classList.add("hidden");
  }

  // ---- MANDAL view (one district) -------------------------------------
  /**
   * Drill into a district: render its mandal polygons, breadcrumb, panel and legend.
   * @param {District} d  The district to open.
   * @param {{then: Function}} [opts]  Optional `then` callback run after rendering.
   * @returns {void}
   */
  function selectDistrict(d, opts) {
    opts = opts || {};
    view = { level: "district", d: d, m: null };
    clearLayers();
    var feats = geoM.features.filter(function (f) {
      return f.properties.d === d.c;
    });
    var breaks = quantileBreaks(
      regions.mandals
        .filter(function (m) {
          return m.d === d.i;
        })
        .map(function (m) {
          return m.vc;
        }),
      RAMP.length
    );
    mLayer = L.geoJSON(
      { type: "FeatureCollection", features: feats },
      {
        style: function (f) {
          return styleMandal(f, breaks);
        },
        onEachFeature: function (f, layer) {
          var m = mByCode[f.properties.c];
          mLayerByCode[f.properties.c] = layer;
          layer.bindTooltip(
            tip(
              rn(f.properties.c, f.properties.n, "mandals"),
              m ? t("n_villages", { n: fmt(m.vc) }) : ""
            ),
            { sticky: true, className: "region-tip", direction: "top" }
          );
          layer.on({
            mouseover: function () {
              layer.setStyle({ weight: 2.4, color: "#334155" });
              layer.bringToFront();
            },
            mouseout: function () {
              mLayer.resetStyle(layer);
            },
            click: function () {
              if (m) selectMandal(m);
            }
          });
        }
      }
    ).addTo(map);

    if (feats.length) {
      map.fitBounds(mLayer.getBounds(), { padding: [30, 30] });
    } else {
      toast(t("boundary_missing", { name: rdist(d) }));
    }
    renderBreadcrumb();
    renderDistrictPanel(d);
    renderLegend(breaks, t("villages_per_" + DIV));
    if (opts.then) opts.then();
  }

  // ---- VILLAGE list (one mandal) --------------------------------------
  /**
   * Select a mandal, drilling into its parent district first if needed.
   * @param {Mandal} m  The mandal to open.
   * @param {(number|string)} [highlightCode]  LGD village code to auto-select.
   * @returns {void}
   */
  function selectMandal(m, highlightCode) {
    var d = regions.districts[m.d];
    if (view.level === "state" || !view.d || view.d.c !== d.c) {
      // ensure district drilled first, then continue
      selectDistrict(d, {
        then: function () {
          finishMandal(m, highlightCode);
        }
      });
      return;
    }
    finishMandal(m, highlightCode);
  }
  /**
   * Highlight the selected mandal, zoom to it and render its village panel.
   * @param {Mandal} m  The selected mandal.
   * @param {(number|string)} [highlightCode]  LGD village code to auto-select.
   * @returns {void}
   */
  function finishMandal(m, highlightCode) {
    view = { level: "mandal", d: regions.districts[m.d], m: m };
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    // de-emphasise siblings, highlight selected mandal
    Object.keys(mLayerByCode).forEach(function (c) {
      var lyr = mLayerByCode[c];
      lyr.setStyle(
        +c === m.c
          ? { weight: 2.6, color: "#0f172a", fillOpacity: 0.9 }
          : { weight: 0.8, color: "#ffffff", fillOpacity: 0.35 }
      );
    });
    var lyr = mLayerByCode[m.c];
    if (lyr) {
      map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 12 });
      lyr.bringToFront();
    }
    renderBreadcrumb();
    renderMandalPanel(m, highlightCode);
  }

  /**
   * Build a region tooltip's inner HTML (name + optional sub-line).
   * @param {string} name  Region display name.
   * @param {string} [sub]  Sub-line (e.g. village count).
   * @returns {string} Tooltip HTML.
   */
  function tip(name, sub) {
    return (
      "<div>" + esc(name) + "</div>" + (sub ? '<div class="tip-sub">' + esc(sub) + "</div>" : "")
    );
  }

  // ---- breadcrumb ------------------------------------------------------
  /**
   * Render the breadcrumb trail for the current drill level.
   * @returns {void}
   */
  function renderBreadcrumb() {
    var bc = $("#breadcrumb");
    bc.innerHTML = "";
    /**
     * Append one breadcrumb segment.
     * @param {string} label  Crumb text.
     * @param {boolean} active  Whether this is the current (non-clickable) crumb.
     * @param {Function} [fn]  Click handler for inactive crumbs.
     * @returns {void}
     */
    function crumb(label, active, fn) {
      var b = el("button", "crumb" + (active ? " active" : ""), esc(label));
      if (!active && fn) b.onclick = fn;
      bc.appendChild(b);
    }
    /**
     * Append a breadcrumb separator.
     * @returns {void}
     */
    function sep() {
      bc.appendChild(el("span", "crumb-sep", "›"));
    }
    crumb(t("all_districts"), view.level === "state", function () {
      clearSearchUI();
      showDistrictView(true);
    });
    if (view.d) {
      sep();
      crumb(rdist(view.d), view.level === "district", function () {
        selectDistrict(view.d);
      });
    }
    if (view.m) {
      sep();
      crumb(rmand(view.m), true);
    }
  }

  // ---- panels ----------------------------------------------------------
  /**
   * Render the state-level sidebar panel: headline stats and the A→Z district list.
   * @returns {void}
   */
  function renderStatePanel() {
    var c = regions;
    var p = $("#panel");
    p.innerHTML = "";
    var totV = c.districts.reduce(function (a, d) {
      return a + d.vc;
    }, 0);
    var grid = el("div", "stat-grid");
    grid.appendChild(stat(fmt(c.districts.length), t("districts")));
    grid.appendChild(stat(fmt(c.mandals.length), tdivs()));
    var sv = stat(fmt(totV), t("villages"));
    sv.style.gridColumn = "1 / -1";
    grid.appendChild(sv);
    p.appendChild(grid);

    p.appendChild(sectionLabel(t("districts"), t("az")));
    var list = el("div", "list");
    c.districts
      .slice()
      .sort(function (a, b) {
        return norm(a.n) < norm(b.n) ? -1 : 1;
      })
      .forEach(function (d) {
        list.appendChild(districtRow(d));
      });
    p.appendChild(list);
  }

  /**
   * Render the district-level sidebar panel: detail header and A→Z mandal list.
   * @param {District} d  The open district.
   * @returns {void}
   */
  function renderDistrictPanel(d) {
    var p = $("#panel");
    p.innerHTML = "";
    p.appendChild(
      backRow(t("all_districts"), function () {
        showDistrictView(true);
      })
    );
    var mandals = regions.mandals.filter(function (m) {
      return m.d === d.i;
    });
    var head = el("div", "detail-head");
    var title = el("div", "title", esc(rdist(d)));
    title.title = d.n;
    head.appendChild(title);
    head.appendChild(
      el(
        "div",
        "sub",
        esc(
          tdivN({ n: mandals.length }) +
            " · " +
            t("n_villages", { n: fmt(d.vc) }) +
            " · " +
            t("lgd_label") +
            " " +
            d.c
        )
      )
    );
    p.appendChild(head);
    p.appendChild(sectionLabel(tdivs(), t("az")));
    var list = el("div", "list");
    mandals
      .sort(function (a, b) {
        return norm(a.n) < norm(b.n) ? -1 : 1;
      })
      .forEach(function (m) {
        list.appendChild(mandalRow(m));
      });
    p.appendChild(list);
  }

  /**
   * Render the mandal-level sidebar panel: detail header and A→Z village list,
   * auto-selecting a highlighted village when arriving from a search hit.
   * @param {Mandal} m  The open mandal.
   * @param {(number|string)} [highlightCode]  LGD village code to auto-select.
   * @returns {void}
   */
  function renderMandalPanel(m, highlightCode) {
    var d = regions.districts[m.d];
    var p = $("#panel");
    p.innerHTML = "";
    p.appendChild(
      backRow(rdist(d), function () {
        selectDistrict(d);
      })
    );
    var head = el("div", "detail-head");
    var title = el("div", "title", esc(rmand(m)));
    title.title = m.n;
    head.appendChild(title);
    head.appendChild(
      el(
        "div",
        "sub",
        esc(
          rdist(d) +
            " " +
            t("district_word") +
            " · " +
            t("n_villages", { n: fmt(m.vc) }) +
            " · " +
            t("lgd_label") +
            " " +
            m.c
        )
      )
    );
    p.appendChild(head);
    p.appendChild(sectionLabel(t("villages"), t("az")));
    var rows = (villagesByMandal[m.i] || []).slice().sort(function (a, b) {
      return norm(a[0]) < norm(b[0]) ? -1 : 1;
    });
    var list = el("div", "list");
    if (!rows.length) {
      list.appendChild(el("div", "empty", esc(t("no_villages"))));
    }
    rows.forEach(function (row) {
      var r = el("button", "row clickable");
      r.title = row[0];
      if (highlightCode && row[2] === highlightCode) r.dataset.hl = "1";
      var main = el("div", "main");
      main.appendChild(el("div", "name", esc(vname(row))));
      main.appendChild(
        el(
          "div",
          "meta",
          (row[3] === 0 ? t("rural") : t("urban")) +
            (row[4] ? " · " + t("pin_label") + " " + row[4] : "") +
            (coords[row[2]] ? " · 📍" : "")
        )
      );
      r.appendChild(main);
      r.appendChild(el("span", "dot"));
      r.lastChild.style.background = row[3] === 0 ? "#94a3b8" : "#c2570f";
      r.appendChild(el("span", "chev", "›"));
      r.onclick = function () {
        selectVillageRow(list, r, row, m);
      };
      list.appendChild(r);
    });
    p.appendChild(list);

    // if we arrived from a search hit, auto-select that village (pin + popup)
    if (highlightCode) {
      var hlEl = list.querySelector('.row[data-hl="1"]');
      var hlRow = null;
      for (var i = 0; i < rows.length; i++)
        if (rows[i][2] === highlightCode) {
          hlRow = rows[i];
          break;
        }
      if (hlEl && hlRow) {
        hlEl.scrollIntoView({ block: "center" });
        selectVillageRow(list, hlEl, hlRow, m);
      }
    }
  }

  /**
   * Mark a village row as selected and show it on the map.
   * @param {HTMLElement} list  The list container (to clear prior selection).
   * @param {HTMLElement} rowEl  The clicked row element.
   * @param {VillageRow} row  The village record.
   * @param {Mandal} m  The parent mandal.
   * @returns {void}
   */
  function selectVillageRow(list, rowEl, row, m) {
    Array.prototype.forEach.call(list.querySelectorAll(".row.selected"), function (x) {
      x.classList.remove("selected");
    });
    rowEl.classList.add("selected");
    showVillage(row, m);
  }

  /**
   * Pin the selected village at its precise GeoNames point when we have a
   * confident one, otherwise at the centre of its mandal, and show a popup
   * (with the on-demand nearby-services trigger).
   * @param {VillageRow} row  The village record.
   * @param {Mandal} m  The parent mandal.
   * @returns {void}
   */
  function showVillage(row, m) {
    if (!row) return;
    var d = regions.districts[m.d];
    var lyr = mLayerByCode[m.c];
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    var precise = coords[row[2]];
    var center = precise
      ? L.latLng(precise[0], precise[1])
      : lyr
        ? lyr.getBounds().getCenter()
        : null;
    if (!center) {
      toast(t("loc_missing", { name: vname(row) }));
      return;
    }
    marker = L.marker(center, {
      icon: L.divIcon({
        className: "vpin-wrap",
        html: '<span class="village-pin"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 20],
        popupAnchor: [0, -18]
      })
    }).addTo(map);
    var pin = row[4]
      ? '<span class="vpop-code">' + esc(t("pin_label")) + " " + esc(row[4]) + "</span>"
      : "";
    var note = precise ? t("approx_note") : t(DIV + "_note");
    var wrap = el("div", "vpop");
    wrap.setAttribute("dir", I18N.dirOf(LANG));
    // Keep clicks on the interactive popup content (nearby button, retry, links)
    // from bubbling to the map, which would otherwise auto-close the popup.
    wrap.addEventListener("click", function (ev) {
      ev.stopPropagation();
    });
    wrap.innerHTML =
      '<div class="vpop-name" title="' +
      esc(row[0]) +
      '">' +
      esc(vname(row)) +
      "</div>" +
      '<div class="vpop-meta">' +
      esc(rmand(m)) +
      " " +
      esc(t(DIV + "_word")) +
      " · " +
      esc(rdist(d)) +
      " " +
      esc(t("district_word")) +
      "</div>" +
      '<div class="vpop-tags"><span class="badge ' +
      (row[3] === 0 ? "rural" : "urban") +
      '">' +
      esc(row[3] === 0 ? t("rural") : t("urban")) +
      "</span>" +
      pin +
      '<span class="vpop-code">' +
      esc(t("lgd_label")) +
      " " +
      row[2] +
      "</span></div>" +
      '<div class="vpop-note">' +
      esc(note) +
      "</div>";

    // Land parcels — zoom into this village and render its cadastral plots.
    var parcelBtn;
    if (CFG.cadastre && cadLayer) {
      parcelBtn = el("button", "vpop-nb-btn vpop-parcels-btn", esc(t("show_parcels")));
      wrap.appendChild(parcelBtn);
    }

    // Nearby civic services — live OpenStreetMap lookup, fetched on demand.
    var nbBtn, nbBox;
    if (window.VF_NEARBY) {
      nbBtn = el("button", "vpop-nb-btn", esc(t("nb_find")));
      nbBox = el("div", "vpop-nb");
      wrap.appendChild(nbBtn);
      wrap.appendChild(nbBox);
    }

    marker.bindPopup(wrap, { className: "village-popup", maxWidth: 280 }).openPopup();
    if (parcelBtn) {
      parcelBtn.onclick = function () {
        showVillageParcels(row, m, coords[row[2]] ? center : null);
      };
    }
    if (nbBtn) {
      nbBtn.onclick = function () {
        loadNearby(nbBtn, nbBox, center.lat, center.lng);
      };
    }
    if (!map.getBounds().contains(center)) map.panTo(center, { animate: true });
  }

  // ---- nearby services (OpenStreetMap / Overpass, on demand) ------------
  // The popup wrapper grows to fit and the results list scrolls internally, so
  // we deliberately don't call popup.update() — repeated auto-pan on rapid
  // content swaps can dismiss the Leaflet popup mid-interaction.
  var NB_RADIUS_KM = 10;
  /**
   * Format a distance in km (one decimal under 10 km, rounded above).
   * @param {number} km  Distance in kilometres.
   * @returns {string} Formatted distance.
   */
  function fmtKm(km) {
    return km < 10 ? km.toFixed(1) : String(Math.round(km));
  }

  /**
   * Fetch nearby civic services for a point and render them into the popup box,
   * with a tap-to-retry affordance on failure.
   * @param {HTMLButtonElement} btn  The trigger button.
   * @param {HTMLElement} box  Container for the results/status.
   * @param {number} lat  Latitude.
   * @param {number} lng  Longitude.
   * @returns {void}
   */
  function loadNearby(btn, box, lat, lng) {
    btn.disabled = true;
    btn.classList.add("loading");
    box.innerHTML = "";
    box.appendChild(el("div", "nb-status", esc(t("nb_loading"))));
    window.VF_NEARBY.fetch(lat, lng, { radius: NB_RADIUS_KM * 1000 })
      .then(function (groups) {
        renderNearby(btn, box, groups);
      })
      .catch(function () {
        btn.classList.add("hidden");
        box.innerHTML = "";
        var retry = el("button", "nb-status nb-retry", esc(t("nb_err")));
        retry.onclick = function () {
          btn.classList.remove("hidden");
          btn.disabled = false;
          btn.classList.remove("loading");
          loadNearby(btn, box, lat, lng);
        };
        box.appendChild(retry);
      });
  }

  /**
   * Render grouped nearby services (health / government / civic) into the popup box.
   * @param {HTMLButtonElement} btn  The trigger button (hidden once results show).
   * @param {HTMLElement} box  Container for the results.
   * @param {NearbyGroups} groups  Grouped amenities to display.
   * @returns {void}
   */
  function renderNearby(btn, box, groups) {
    btn.classList.add("hidden"); // the trigger is replaced by its results
    box.innerHTML = "";
    var ORDER = ["health", "government", "civic"];
    var total = ORDER.reduce(function (a, g) {
      return a + (groups[g] || []).length;
    }, 0);
    if (!total) {
      box.appendChild(el("div", "nb-status", esc(t("nb_none", { km: NB_RADIUS_KM }))));
      return;
    }
    ORDER.forEach(function (g) {
      var items = groups[g] || [];
      if (!items.length) return;
      var sec = el("div", "nb-group");
      sec.appendChild(el("div", "nb-group-head", esc(t("nb_" + g))));
      items.forEach(function (it) {
        var a = document.createElement("a");
        a.className = "nb-item";
        a.href = "https://www.google.com/maps/search/?api=1&query=" + it.lat + "," + it.lng;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML =
          '<span class="nb-item-name">' +
          esc(it.name || t("t_" + it.type)) +
          "</span>" +
          '<span class="nb-item-meta">' +
          esc(t("t_" + it.type)) +
          " · " +
          esc(t("km", { n: fmtKm(it.dist) })) +
          "</span>";
        sec.appendChild(a);
      });
      box.appendChild(sec);
    });
    var src = document.createElement("a");
    src.className = "nb-src";
    src.href = "https://www.openstreetmap.org/copyright";
    src.target = "_blank";
    src.rel = "noopener";
    src.textContent = t("nb_src");
    box.appendChild(src);
  }

  // ---- search ----------------------------------------------------------
  /**
   * Wire the search input (debounced) and its clear button.
   * @returns {void}
   */
  function wireSearch() {
    var inp = $("#search"),
      clr = $("#clear-search");
    var t2;
    inp.addEventListener("input", function () {
      clr.classList.toggle("hidden", !inp.value);
      clearTimeout(t2);
      t2 = setTimeout(function () {
        runSearch(inp.value);
      }, 120);
    });
    clr.onclick = function () {
      inp.value = "";
      clr.classList.add("hidden");
      clearSearchUI();
      restorePanel();
      inp.focus();
    };
  }
  /**
   * Clear the search field and hide its clear button.
   * @returns {void}
   */
  function clearSearchUI() {
    var i = $("#search");
    if (i) i.value = "";
    $("#clear-search").classList.add("hidden");
  }
  /**
   * Re-render the sidebar panel appropriate to the current drill level.
   * @returns {void}
   */
  function restorePanel() {
    if (view.level === "mandal") renderMandalPanel(view.m);
    else if (view.level === "district") renderDistrictPanel(view.d);
    else renderStatePanel();
  }
  /**
   * Run a fuzzy search and render the matching districts/mandals/villages.
   * @param {string} q  Query string (searches if ≥ 2 chars).
   * @returns {void}
   */
  function runSearch(q) {
    q = q.trim();
    if (q.length < 2) {
      restorePanel();
      return;
    }
    var res = fuse.search(q, { limit: 60 });
    var p = $("#panel");
    p.innerHTML = "";
    p.appendChild(
      sectionLabel(t("results"), t("matches", { n: res.length + (res.length === 60 ? "+" : "") }))
    );
    if (!res.length) {
      p.appendChild(el("div", "empty", esc(t("no_match", { q: q }))));
      return;
    }
    var list = el("div", "list");
    res.forEach(function (hit) {
      var it = hit.item;
      if (it.t === "v") list.appendChild(villageResult(it.ref));
      else if (it.t === "m") list.appendChild(mandalRow(it.ref, true));
      else list.appendChild(districtRow(it.ref, true));
    });
    p.appendChild(list);
  }

  // ---- row builders ----------------------------------------------------
  /**
   * Build a stat tile (number + label) styled per the active state.
   * @param {string} num  Formatted number.
   * @param {string} lab  Label text.
   * @returns {HTMLElement} The stat element.
   */
  function stat(num, lab) {
    var statCls =
      CFG.slug === "telangana"
        ? " tg"
        : CFG.slug === "karnataka"
          ? " ka"
          : CFG.slug === "tamil_nadu"
            ? " tn"
            : " ap";
    var s = el("div", "stat" + statCls);
    s.appendChild(el("div", "num", num));
    s.appendChild(el("div", "lab", lab));
    return s;
  }
  /**
   * Build a section label with an optional right-aligned hint.
   * @param {string} text  Label text.
   * @param {string} [hint]  Hint text.
   * @returns {HTMLElement} The section-label element.
   */
  function sectionLabel(text, hint) {
    var s = el("div", "section-label", "<span>" + esc(text) + "</span>");
    if (hint) s.appendChild(el("span", "hint", esc(hint)));
    return s;
  }
  /**
   * Build a "back" navigation row.
   * @param {string} label  Destination label.
   * @param {Function} fn  Click handler.
   * @returns {HTMLElement} The back-row button.
   */
  function backRow(label, fn) {
    var b = el("button", "back-row", "‹ " + esc(label));
    b.onclick = fn;
    return b;
  }
  /**
   * Build a generic clickable list row (name, optional meta, count and chevron).
   * @param {string} name  Display name.
   * @param {string} [meta]  Secondary line.
   * @param {number} [count]  Trailing count badge.
   * @param {boolean} [kind]  Whether to show a leading accent dot.
   * @param {string} [titleEn]  English title attribute.
   * @returns {HTMLElement} The row button.
   */
  function rowEl(name, meta, count, kind, titleEn) {
    var r = el("button", "row clickable");
    r.title = titleEn || name;
    if (kind) {
      var dot = el("span", "dot");
      dot.style.background = ACCENT;
      r.appendChild(dot);
    }
    var main = el("div", "main");
    main.appendChild(el("div", "name", esc(name)));
    if (meta) main.appendChild(el("div", "meta", esc(meta)));
    r.appendChild(main);
    if (count != null) r.appendChild(el("span", "count", fmt(count)));
    r.appendChild(el("span", "chev", "›"));
    return r;
  }
  /**
   * Build a district list row that drills into the district on click.
   * @param {District} d  The district.
   * @param {boolean} [showKind]  Show the "District" kind label (search results).
   * @returns {HTMLElement} The row button.
   */
  function districtRow(d, showKind) {
    var meta = showKind
      ? t("district")
      : tdivN({
          n: regions.mandals.filter(function (m) {
            return m.d === d.i;
          }).length
        });
    var r = rowEl(rdist(d), meta, d.vc, showKind, d.n);
    r.onclick = function () {
      selectDistrict(d);
    };
    return r;
  }
  /**
   * Build a mandal list row that opens the mandal on click.
   * @param {Mandal} m  The mandal.
   * @param {boolean} [showKind]  Show the tier + district meta (search results).
   * @returns {HTMLElement} The row button.
   */
  function mandalRow(m, showKind) {
    var d = regions.districts[m.d];
    var meta = showKind ? t(DIV) + " · " + rdist(d) : rdist(d);
    var r = rowEl(rmand(m), meta, m.vc, showKind, m.n);
    r.onclick = function () {
      selectMandal(m);
    };
    return r;
  }
  /**
   * Build a village search-result row that opens its mandal and highlights it.
   * @param {VillageRow} row  The village record.
   * @returns {HTMLElement} The row button.
   */
  function villageResult(row) {
    var m = regions.mandals[row[1]];
    var d = regions.districts[m.d];
    var r = el("button", "row clickable");
    r.title = row[0];
    var dot = el("span", "dot");
    dot.style.background = row[3] === 0 ? "#94a3b8" : "#c2570f";
    r.appendChild(dot);
    var main = el("div", "main");
    main.appendChild(el("div", "name", esc(vname(row))));
    main.appendChild(
      el(
        "div",
        "meta",
        esc(rmand(m)) +
          " · " +
          esc(rdist(d)) +
          (row[4] ? " · " + t("pin_label") + " " + row[4] : "")
      )
    );
    r.appendChild(main);
    r.appendChild(
      el(
        "span",
        "badge " + (row[3] === 0 ? "rural" : "urban"),
        esc(row[3] === 0 ? t("rural") : t("urban"))
      )
    );
    r.onclick = function () {
      clearSearchUI();
      selectMandal(m, row[2]);
    };
    return r;
  }

  // ---- legend ----------------------------------------------------------
  /**
   * Render the choropleth legend from the active break points.
   * @param {number[]} breaks  Quantile breaks.
   * @param {string} title  Legend title.
   * @returns {void}
   */
  function renderLegend(breaks, title) {
    $(".legend-title").textContent = title;
    var box = $("#legend-scale");
    box.innerHTML = "";
    var ranges = [];
    var prev = 1;
    for (var i = 0; i < breaks.length; i++) {
      ranges.push([prev, breaks[i]]);
      prev = breaks[i] + 1;
    }
    ranges.push([prev, null]);
    ranges.forEach(function (rg, i) {
      var row = el("div", "legend-row");
      var sw = el("span", "legend-swatch");
      sw.style.background = RAMP[i] || RAMP[RAMP.length - 1];
      row.appendChild(sw);
      var label =
        rg[1] == null
          ? fmt(rg[0]) + "+"
          : rg[0] === rg[1]
            ? fmt(rg[0])
            : fmt(rg[0]) + "–" + fmt(rg[1]);
      row.appendChild(el("span", null, label));
      box.appendChild(row);
    });
  }

  // ---- toast -----------------------------------------------------------
  var toastT;
  /**
   * Show a transient toast message (auto-hides after a few seconds).
   * @param {string} msg  Message text.
   * @returns {void}
   */
  function toast(msg) {
    var t2 = $("#toast");
    t2.textContent = msg;
    t2.classList.remove("hidden");
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      t2.classList.add("hidden");
    }, 3500);
  }
})();
