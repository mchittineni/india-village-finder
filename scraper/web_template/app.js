/* =====================================================================
   AP & Telangana Village Finder — map application
   Single-state app: config.js (window.VF_CONFIG) selects the state.
   Data: data/{regions,villages,meta}.json + data/{districts,mandals}.geojson
   ===================================================================== */
(function () {
  "use strict";
  var CFG = window.VF_CONFIG || {};
  var DATA = "data/";

  // ---- tiny DOM helpers ------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmt(n) { return (n || 0).toLocaleString("en-IN"); }
  function norm(s) { return (s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  async function fetchJSON(name) {
    var r = await fetch(DATA + name);
    if (!r.ok) throw new Error("Failed to load " + name + " (" + r.status + ")");
    return r.json();
  }

  // ---- colour ramp from the state accent -------------------------------
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  var ACCENT = CFG.accent || "#1f6feb";
  var ACC_RGB = hexToRgb(ACCENT);
  function tint(t) { // t=0 -> white, t=1 -> accent
    var r = ACC_RGB.map(function (c) { return Math.round(255 + (c - 255) * t); });
    return "rgb(" + r[0] + "," + r[1] + "," + r[2] + ")";
  }
  var RAMP = [0.1, 0.26, 0.44, 0.62, 0.8, 1.0].map(tint);
  var NODATA = "#e9edf2";

  function quantileBreaks(values, n) {
    var v = values.filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    if (!v.length) return [];
    var breaks = [];
    for (var i = 1; i < n; i++) {
      var pos = (v.length - 1) * (i / n);
      var lo = Math.floor(pos), hi = Math.ceil(pos);
      breaks.push(Math.round(v[lo] + (v[hi] - v[lo]) * (pos - lo)));
    }
    return breaks;
  }
  function colorFor(count, breaks) {
    if (!count) return NODATA;
    for (var i = 0; i < breaks.length; i++) if (count <= breaks[i]) return RAMP[i];
    return RAMP[RAMP.length - 1];
  }

  // ---- state -----------------------------------------------------------
  var regions, villages, geoD, geoM, meta;
  var dByCode = {}, mByCode = {};
  var villagesByMandal = [];
  var dBreaks = [], fuse = null;
  var map, dLayer, mLayer, marker;
  var dLayerByCode = {}, mLayerByCode = {};
  var view = { level: "state", d: null, m: null }; // d,m = region objects

  init();

  async function init() {
    applyTheme();
    buildSwitch();
    setBranding();
    try {
      var res = await Promise.all([
        fetchJSON("regions.json"), fetchJSON("villages.json"),
        fetchJSON("districts.geojson"), fetchJSON("mandals.geojson"),
        fetchJSON("meta.json").catch(function () { return null; })
      ]);
      regions = res[0]; villages = res[1]; geoD = res[2]; geoM = res[3]; meta = res[4];
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
  }

  // ---- theming + chrome ------------------------------------------------
  function applyTheme() {
    var s = document.documentElement.style;
    s.setProperty("--brand", CFG.accent || "#1f6feb");
    s.setProperty("--brand-soft", CFG.accentSoft || "#eaf2ff");
  }
  function setBranding() {
    document.title = CFG.state + " Village Finder";
    var sub = $(".brand-sub"); if (sub) sub.textContent = CFG.state;
    var src = $("#src-link"); if (src && CFG.source) src.href = CFG.source.url;
  }
  function buildSwitch() {
    var box = $("#state-switch");
    if (!box) return;
    box.innerHTML = "";
    var cur = el("button", "active", esc(CFG.state));
    cur.title = "Currently viewing " + CFG.state;
    box.appendChild(cur);
    (CFG.siblings || []).forEach(function (sib) {
      var a = document.createElement("a");
      a.href = sib.url; a.textContent = sib.name; a.className = "seg-link";
      box.appendChild(a);
    });
  }
  function setFreshness() {
    var c = (CFG.counts) || (meta && meta.counts) || {};
    var date = CFG.sourceDate || (meta && meta.source_date) || "";
    $("#freshness").innerHTML = "Updated <b>" + esc(date) + "</b> · " +
      fmt(c.villages) + " villages";
  }
  function wireChrome() {
    var app = $("#app");
    $("#collapse-btn").onclick = function () { app.classList.add("collapsed"); $("#show-sidebar").classList.remove("hidden"); setTimeout(resizeMap, 320); };
    $("#show-sidebar").onclick = function () { app.classList.remove("collapsed"); $("#show-sidebar").classList.add("hidden"); setTimeout(resizeMap, 320); };
  }
  function resizeMap() { if (map) map.invalidateSize(); }

  // ---- indexing --------------------------------------------------------
  function indexData() {
    regions.districts.forEach(function (d) { dByCode[d.c] = d; });
    regions.mandals.forEach(function (m) { mByCode[m.c] = m; });
    villagesByMandal = regions.mandals.map(function () { return []; });
    villages.rows.forEach(function (row) {
      // row: [name, mandalIdx, code, cat]
      var mi = row[1];
      if (villagesByMandal[mi]) villagesByMandal[mi].push(row);
    });
    dBreaks = quantileBreaks(regions.districts.map(function (d) { return d.vc; }), RAMP.length);
  }

  function buildFuse() {
    var items = [];
    regions.districts.forEach(function (d) { items.push({ t: "d", name: d.n, ref: d }); });
    regions.mandals.forEach(function (m) { items.push({ t: "m", name: m.n, ref: m }); });
    villages.rows.forEach(function (row) { items.push({ t: "v", name: row[0], ref: row }); });
    fuse = new Fuse(items, {
      keys: ["name"], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2,
      getFn: function (obj) { var v = obj.name; return [v, v.replace(/\s+/g, "")]; }
    });
  }

  // ---- map -------------------------------------------------------------
  function initMap() {
    map = L.map("map", { zoomControl: true, attributionControl: true, minZoom: 5, maxZoom: 13 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    map.createPane("regions"); map.getPane("regions").style.zIndex = 410;
  }

  function styleDistrict(f) {
    var d = dByCode[f.properties.c];
    return { pane: "regions", color: "#ffffff", weight: 1.2, fillOpacity: 0.85,
             fillColor: colorFor(d ? d.vc : 0, dBreaks) };
  }
  function styleMandal(f, breaks) {
    var m = mByCode[f.properties.c];
    return { pane: "regions", color: "#ffffff", weight: 1, fillOpacity: 0.82,
             fillColor: colorFor(m ? m.vc : 0, breaks) };
  }

  function clearLayers() {
    if (dLayer) { map.removeLayer(dLayer); dLayer = null; }
    if (mLayer) { map.removeLayer(mLayer); mLayer = null; }
    if (marker) { map.removeLayer(marker); marker = null; }
    dLayerByCode = {}; mLayerByCode = {};
  }

  // ---- DISTRICT (state) view ------------------------------------------
  function showDistrictView(fit) {
    view = { level: "state", d: null, m: null };
    clearLayers();
    dLayer = L.geoJSON(geoD, {
      style: styleDistrict,
      onEachFeature: function (f, layer) {
        var d = dByCode[f.properties.c];
        dLayerByCode[f.properties.c] = layer;
        layer.bindTooltip(tip(f.properties.n, (d ? fmt(d.vc) + " villages" : "")), { sticky: true, className: "region-tip", direction: "top" });
        layer.on({
          mouseover: function () { layer.setStyle({ weight: 2.4, color: "#334155" }); layer.bringToFront(); },
          mouseout: function () { dLayer.resetStyle(layer); },
          click: function () { if (d) selectDistrict(d); }
        });
      }
    }).addTo(map);
    if (fit) map.fitBounds(dLayer.getBounds(), { padding: [20, 20] });
    renderBreadcrumb(); renderStatePanel(); renderLegend(dBreaks, "Villages per district");
    $("#map-loading").classList.add("hidden");
  }

  // ---- MANDAL view (one district) -------------------------------------
  function selectDistrict(d, opts) {
    opts = opts || {};
    view = { level: "district", d: d, m: null };
    clearLayers();
    var feats = geoM.features.filter(function (f) { return f.properties.d === d.c; });
    var breaks = quantileBreaks(
      regions.mandals.filter(function (m) { return m.d === d.i; }).map(function (m) { return m.vc; }),
      RAMP.length
    );
    mLayer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
      style: function (f) { return styleMandal(f, breaks); },
      onEachFeature: function (f, layer) {
        var m = mByCode[f.properties.c];
        mLayerByCode[f.properties.c] = layer;
        layer.bindTooltip(tip(f.properties.n, (m ? fmt(m.vc) + " villages" : "")), { sticky: true, className: "region-tip", direction: "top" });
        layer.on({
          mouseover: function () { layer.setStyle({ weight: 2.4, color: "#334155" }); layer.bringToFront(); },
          mouseout: function () { mLayer.resetStyle(layer); },
          click: function () { if (m) selectMandal(m); }
        });
      }
    }).addTo(map);

    if (feats.length) {
      map.fitBounds(mLayer.getBounds(), { padding: [30, 30] });
    } else {
      toast("Map boundary not yet published for " + d.n + " (a new district).");
    }
    renderBreadcrumb(); renderDistrictPanel(d);
    renderLegend(breaks, "Villages per mandal");
    if (opts.then) opts.then();
  }

  // ---- VILLAGE list (one mandal) --------------------------------------
  function selectMandal(m, highlightCode) {
    var d = regions.districts[m.d];
    if (view.level === "state" || !view.d || view.d.c !== d.c) {
      // ensure district drilled first, then continue
      selectDistrict(d, { then: function () { finishMandal(m, highlightCode); } });
      return;
    }
    finishMandal(m, highlightCode);
  }
  function finishMandal(m, highlightCode) {
    view = { level: "mandal", d: regions.districts[m.d], m: m };
    if (marker) { map.removeLayer(marker); marker = null; }
    // de-emphasise siblings, highlight selected mandal
    Object.keys(mLayerByCode).forEach(function (c) {
      var lyr = mLayerByCode[c];
      lyr.setStyle(+c === m.c ? { weight: 2.6, color: "#0f172a", fillOpacity: 0.9 }
                              : { weight: 0.8, color: "#ffffff", fillOpacity: 0.35 });
    });
    var lyr = mLayerByCode[m.c];
    if (lyr) { map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 12 }); lyr.bringToFront(); }
    renderBreadcrumb(); renderMandalPanel(m, highlightCode);
  }

  function tip(name, sub) {
    return "<div>" + esc(name) + "</div>" + (sub ? '<div class="tip-sub">' + esc(sub) + "</div>" : "");
  }

  // ---- breadcrumb ------------------------------------------------------
  function renderBreadcrumb() {
    var bc = $("#breadcrumb"); bc.innerHTML = "";
    function crumb(label, active, fn) {
      var b = el("button", "crumb" + (active ? " active" : ""), esc(label));
      if (!active && fn) b.onclick = fn;
      bc.appendChild(b);
    }
    function sep() { bc.appendChild(el("span", "crumb-sep", "›")); }
    crumb("All districts", view.level === "state", function () { clearSearchUI(); showDistrictView(true); });
    if (view.d) { sep(); crumb(view.d.n, view.level === "district", function () { selectDistrict(view.d); }); }
    if (view.m) { sep(); crumb(view.m.n, true); }
  }

  // ---- panels ----------------------------------------------------------
  function renderStatePanel() {
    var c = regions;
    var p = $("#panel"); p.innerHTML = "";
    var totV = c.districts.reduce(function (a, d) { return a + d.vc; }, 0);
    var grid = el("div", "stat-grid");
    grid.appendChild(stat(fmt(c.districts.length), "Districts"));
    grid.appendChild(stat(fmt(c.mandals.length), "Mandals"));
    var sv = stat(fmt(totV), "Villages"); sv.style.gridColumn = "1 / -1"; grid.appendChild(sv);
    p.appendChild(grid);

    p.appendChild(sectionLabel("Districts", "by villages"));
    var list = el("div", "list");
    c.districts.slice().sort(function (a, b) { return b.vc - a.vc; }).forEach(function (d) {
      list.appendChild(districtRow(d));
    });
    p.appendChild(list);
  }

  function renderDistrictPanel(d) {
    var p = $("#panel"); p.innerHTML = "";
    p.appendChild(backRow("All districts", function () { showDistrictView(true); }));
    var mandals = regions.mandals.filter(function (m) { return m.d === d.i; });
    var head = el("div", "detail-head");
    head.appendChild(el("div", "title", esc(d.n)));
    head.appendChild(el("div", "sub", mandals.length + " mandals · " + fmt(d.vc) + " villages · LGD " + d.c));
    p.appendChild(head);
    p.appendChild(sectionLabel("Mandals", "by villages"));
    var list = el("div", "list");
    mandals.sort(function (a, b) { return b.vc - a.vc; }).forEach(function (m) {
      list.appendChild(mandalRow(m));
    });
    p.appendChild(list);
  }

  function renderMandalPanel(m, highlightCode) {
    var d = regions.districts[m.d];
    var p = $("#panel"); p.innerHTML = "";
    p.appendChild(backRow(d.n, function () { selectDistrict(d); }));
    var head = el("div", "detail-head");
    head.appendChild(el("div", "title", esc(m.n)));
    head.appendChild(el("div", "sub", esc(d.n) + " district · " + fmt(m.vc) + " villages · LGD " + m.c));
    p.appendChild(head);
    p.appendChild(sectionLabel("Villages", "A → Z"));
    var rows = (villagesByMandal[m.i] || []).slice().sort(function (a, b) { return norm(a[0]) < norm(b[0]) ? -1 : 1; });
    var list = el("div", "list");
    if (!rows.length) { list.appendChild(el("div", "empty", "No villages listed for this mandal.")); }
    rows.forEach(function (row) {
      var r = el("button", "row");
      var main = el("div", "main");
      var nm = el("div", "name", esc(row[0]));
      if (highlightCode && row[2] === highlightCode) { nm.innerHTML = "<mark>" + esc(row[0]) + "</mark>"; r.scrollIntoViewTarget = true; }
      main.appendChild(nm);
      main.appendChild(el("div", "meta", "LGD " + row[2]));
      r.appendChild(main);
      r.appendChild(el("span", "badge " + (row[3] === 0 ? "rural" : "urban"), row[3] === 0 ? "Rural" : "Urban"));
      list.appendChild(r);
    });
    p.appendChild(list);
    var hl = list.querySelector(".row");
    var target = Array.prototype.find ? Array.prototype.slice.call(list.children).find(function (c) { return c.scrollIntoViewTarget; }) : null;
    if (target) target.scrollIntoView({ block: "center" });
  }

  // ---- search ----------------------------------------------------------
  function wireSearch() {
    var inp = $("#search"), clr = $("#clear-search");
    var t;
    inp.addEventListener("input", function () {
      clr.classList.toggle("hidden", !inp.value);
      clearTimeout(t); t = setTimeout(function () { runSearch(inp.value); }, 120);
    });
    clr.onclick = function () { inp.value = ""; clr.classList.add("hidden"); clearSearchUI(); restorePanel(); inp.focus(); };
  }
  function clearSearchUI() { var i = $("#search"); if (i) i.value = ""; $("#clear-search").classList.add("hidden"); }
  function restorePanel() {
    if (view.level === "mandal") renderMandalPanel(view.m);
    else if (view.level === "district") renderDistrictPanel(view.d);
    else renderStatePanel();
  }
  function runSearch(q) {
    q = q.trim();
    if (q.length < 2) { restorePanel(); return; }
    var res = fuse.search(q, { limit: 60 });
    var p = $("#panel"); p.innerHTML = "";
    p.appendChild(sectionLabel("Results", res.length + (res.length === 60 ? "+" : "") + " matches"));
    if (!res.length) {
      p.appendChild(el("div", "empty", "No village, mandal or district matches “" + esc(q) + "”."));
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
  function stat(num, lab) {
    var s = el("div", "stat" + (CFG.slug === "telangana" ? " tg" : " ap"));
    s.appendChild(el("div", "num", num));
    s.appendChild(el("div", "lab", lab));
    return s;
  }
  function sectionLabel(text, hint) {
    var s = el("div", "section-label", "<span>" + esc(text) + "</span>");
    if (hint) s.appendChild(el("span", "hint", esc(hint)));
    return s;
  }
  function backRow(label, fn) {
    var b = el("button", "back-row", "‹ " + esc(label));
    b.onclick = fn; return b;
  }
  function rowEl(name, meta, count, kind) {
    var r = el("button", "row clickable");
    if (kind) { var dot = el("span", "dot"); dot.style.background = ACCENT; r.appendChild(dot); }
    var main = el("div", "main");
    main.appendChild(el("div", "name", esc(name)));
    if (meta) main.appendChild(el("div", "meta", esc(meta)));
    r.appendChild(main);
    if (count != null) r.appendChild(el("span", "count", fmt(count)));
    r.appendChild(el("span", "chev", "›"));
    return r;
  }
  function districtRow(d, showKind) {
    var r = rowEl(d.n, showKind ? "District" : (regions.mandals.filter(function (m) { return m.d === d.i; }).length + " mandals"), d.vc, showKind);
    r.onclick = function () { selectDistrict(d); };
    return r;
  }
  function mandalRow(m, showKind) {
    var d = regions.districts[m.d];
    var r = rowEl(m.n, showKind ? "Mandal · " + d.n : d.n, m.vc, showKind);
    r.onclick = function () { selectMandal(m); };
    return r;
  }
  function villageResult(row) {
    var m = regions.mandals[row[1]];
    var d = regions.districts[m.d];
    var r = el("button", "row clickable");
    var dot = el("span", "dot"); dot.style.background = (row[3] === 0 ? "#94a3b8" : "#c2570f"); r.appendChild(dot);
    var main = el("div", "main");
    main.appendChild(el("div", "name", esc(row[0])));
    main.appendChild(el("div", "meta", esc(m.n) + " · " + esc(d.n)));
    r.appendChild(main);
    r.appendChild(el("span", "badge " + (row[3] === 0 ? "rural" : "urban"), row[3] === 0 ? "Rural" : "Urban"));
    r.onclick = function () { clearSearchUI(); selectMandal(m, row[2]); };
    return r;
  }

  // ---- legend ----------------------------------------------------------
  function renderLegend(breaks, title) {
    $(".legend-title").textContent = title;
    var box = $("#legend-scale"); box.innerHTML = "";
    var ranges = [];
    var prev = 1;
    for (var i = 0; i < breaks.length; i++) { ranges.push([prev, breaks[i]]); prev = breaks[i] + 1; }
    ranges.push([prev, null]);
    ranges.forEach(function (rg, i) {
      var row = el("div", "legend-row");
      var sw = el("span", "legend-swatch"); sw.style.background = RAMP[i] || RAMP[RAMP.length - 1];
      row.appendChild(sw);
      var label = rg[1] == null ? fmt(rg[0]) + "+" : (rg[0] === rg[1] ? fmt(rg[0]) : fmt(rg[0]) + "–" + fmt(rg[1]));
      row.appendChild(el("span", null, label));
      box.appendChild(row);
    });
  }

  // ---- toast -----------------------------------------------------------
  var toastT;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("hidden"); }, 3500);
  }
})();
