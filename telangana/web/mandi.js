/** =====================================================================
   Village Finder — live mandi (APMC market) commodity prices
   Loads the state's daily Agmarknet price snapshot, published by the
   update-mandi-prices workflow to the repo's `data/mandi-prices` branch as
   one compact JSON per state (columns + row arrays, ₹/quintal), and serves
   it grouped by district for the prices panel.

   Exposes window.VF_MANDI:
     load(url)                -> Promise<MandiData> (cached per session)
     districts(data)          -> [{name, rows}] sorted by name
     matchDistrict(data, lgd) -> best-matching Agmarknet district name for an
                                 LGD district name ("" when nothing plausible —
                                 Agmarknet spells districts its own way, e.g.
                                 LGD "Chittoor" vs Agmarknet "Chittor").

   Price data: Ministry of Agriculture & Farmers Welfare (Agmarknet) via
   data.gov.in (GODL). Prices are ₹ per quintal; not every mandi reports
   every day.

   @module web/mandi
   @file Daily Agmarknet mandi-price snapshot loader/grouper, exposed as
   `window.VF_MANDI`.
   ===================================================================== */
/**
 * @typedef {Object} MandiRow  One market-commodity price quote.
 * @property {string} district  Agmarknet district name.
 * @property {string} market    Mandi / APMC name.
 * @property {string} commodity Commodity ("Tomato").
 * @property {string} variety   Variety ("Hybrid").
 * @property {string} grade     Grade ("FAQ").
 * @property {string} date      Arrival date (dd/mm/yyyy).
 * @property {number} min       Minimum price, ₹/quintal.
 * @property {number} max       Maximum price, ₹/quintal.
 * @property {number} modal     Modal (most common) price, ₹/quintal.
 */
/**
 * @typedef {Object} MandiData  Parsed state snapshot.
 * @property {string} updated   ISO timestamp the snapshot was fetched.
 * @property {MandiRow[]} rows  All quotes for the state.
 * @property {Object<string, MandiRow[]>} byDistrict  Rows keyed by district.
 */
window.VF_MANDI = (function () {
  "use strict";

  var cache = {}; // url -> Promise<MandiData>

  /**
   * Normalise a district name for fuzzy matching: lowercase, letters only.
   * @param {string} s  District name.
   * @returns {string} Normalised form.
   */
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  /**
   * Load and parse a state's price snapshot (cached per session).
   * @param {string} url  Snapshot JSON URL.
   * @returns {Promise<MandiData>}
   */
  function load(url) {
    if (cache[url]) return cache[url];
    cache[url] = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        var cols = j.columns || [];
        var idx = {};
        cols.forEach(function (c, i) {
          idx[c] = i;
        });
        var rows = (j.rows || []).map(function (a) {
          return {
            district: a[idx.district] || "",
            market: a[idx.market] || "",
            commodity: a[idx.commodity] || "",
            variety: a[idx.variety] || "",
            grade: a[idx.grade] || "",
            date: a[idx.arrival_date] || "",
            min: +a[idx.min_price] || 0,
            max: +a[idx.max_price] || 0,
            modal: +a[idx.modal_price] || 0
          };
        });
        var byDistrict = {};
        rows.forEach(function (r) {
          (byDistrict[r.district] = byDistrict[r.district] || []).push(r);
        });
        return { updated: j.updated || "", rows: rows, byDistrict: byDistrict };
      })
      .catch(function (e) {
        delete cache[url]; // don't cache failures — allow retry
        throw e;
      });
    return cache[url];
  }

  /**
   * List districts present in the snapshot, each with its quotes.
   * @param {MandiData} data  Parsed snapshot.
   * @returns {{name: string, rows: MandiRow[]}[]} Sorted by district name.
   */
  function districts(data) {
    return Object.keys(data.byDistrict)
      .sort()
      .map(function (n) {
        return { name: n, rows: data.byDistrict[n] };
      });
  }

  /**
   * Split a district name into lowercase alphabetic tokens ("Dr.B.R.A.Konaseema"
   * -> ["dr","b","r","a","konaseema"]).
   * @param {string} s  District name.
   * @returns {string[]} Tokens.
   */
  function tokens(s) {
    return String(s || "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean);
  }

  /**
   * Length of the common prefix of two strings.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function prefixLen(a, b) {
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) if (a[i] !== b[i]) return i;
    return n;
  }

  /**
   * Find the Agmarknet district best matching an LGD district name. Agmarknet
   * spells districts its own way (LGD "Chittoor" vs "Chittor", "Dr. B.R.
   * Ambedkar Konaseema" vs "Dr.B.R.A.Konaseema"), so after an exact normalised
   * match this scores candidates by common-prefix length and by distinctive
   * shared tokens (>= 5 chars, substring either way), requiring a score of 5+.
   * @param {MandiData} data  Parsed snapshot.
   * @param {string} lgdName  LGD district name (English).
   * @returns {string} Best-matching Agmarknet district name, or "".
   */
  function matchDistrict(data, lgdName) {
    var want = norm(lgdName);
    if (!want) return "";
    var wantToks = tokens(lgdName);
    var names = Object.keys(data.byDistrict);
    var best = "";
    var bestScore = 0;
    for (var i = 0; i < names.length; i++) {
      var have = norm(names[i]);
      if (have === want) return names[i];
      var score = prefixLen(have, want);
      var haveToks = tokens(names[i]);
      for (var h = 0; h < haveToks.length; h++) {
        for (var w = 0; w < wantToks.length; w++) {
          var ht = haveToks[h];
          var wt = wantToks[w];
          if (ht.length >= 5 && wt.indexOf(ht) !== -1) score = Math.max(score, ht.length);
          if (wt.length >= 5 && ht.indexOf(wt) !== -1) score = Math.max(score, wt.length);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = names[i];
      }
    }
    return bestScore >= 5 ? best : "";
  }

  return { load: load, districts: districts, matchDistrict: matchDistrict };
})();
