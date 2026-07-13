/** =====================================================================
   Village Finder — government schemes for farmers
   Loads the state's weekly myScheme snapshot, published by the
   update-farmer-schemes workflow to the repo's `data/farmer-schemes` branch
   as one compact JSON per state (state + Central schemes in the
   "Agriculture,Rural & Environment" category, with names localized in every
   UI language), and serves it filtered for the schemes panel.

   Exposes window.VF_SCHEMES:
     load(url)               -> Promise<SchemesData> (cached per session)
     filter(data, q, lang)   -> schemes whose name (any language), tags or
                                brief match the query
     name(scheme, lang)      -> localized scheme name (falls back to English)
     brief(scheme, lang)     -> localized brief description (falls back to
                                English; briefs ship only in en + the state's
                                own language to keep the payload small)
     link(scheme)            -> the scheme's page on myscheme.gov.in

   Scheme data: myScheme (myscheme.gov.in), Digital India / NeGD — the
   national scheme discovery platform. Coverage varies by state (some state
   agriculture schemes are not yet onboarded there).

   @module web/schemes
   @file Weekly myScheme farmer-schemes snapshot loader/filter, exposed as
   `window.VF_SCHEMES`.
   ===================================================================== */
/**
 * @typedef {Object} Scheme  One government scheme.
 * @property {string} slug      myScheme slug (page id on myscheme.gov.in).
 * @property {string} level     "Central" or "State".
 * @property {string} ministry  Nodal ministry ("" for most state schemes).
 * @property {string[]} tags    Topic tags ("Crop Insurance").
 * @property {Object<string, string>} name   Scheme name by language code.
 * @property {Object<string, string>} brief  Short description by language.
 */
/**
 * @typedef {Object} SchemesData  Parsed state snapshot.
 * @property {string} updated   ISO timestamp the snapshot was fetched.
 * @property {Scheme[]} schemes All schemes for the state (Central + State).
 */
window.VF_SCHEMES = (function () {
  "use strict";

  var cache = {}; // url -> Promise<SchemesData>

  /**
   * Load and parse a state's schemes snapshot (cached per session).
   * @param {string} url  Snapshot JSON URL.
   * @returns {Promise<SchemesData>}
   */
  function load(url) {
    if (cache[url]) return cache[url];
    cache[url] = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        return { updated: j.updated || "", schemes: j.schemes || [] };
      })
      .catch(function (e) {
        delete cache[url]; // don't cache failures — allow retry
        throw e;
      });
    return cache[url];
  }

  /**
   * Localized scheme name, falling back to English.
   * @param {Scheme} s  Scheme.
   * @param {string} lang  UI language code.
   * @returns {string} Name.
   */
  function name(s, lang) {
    return (s.name && (s.name[lang] || s.name.en)) || s.slug;
  }

  /**
   * Localized brief description, falling back to English ("" when absent).
   * @param {Scheme} s  Scheme.
   * @param {string} lang  UI language code.
   * @returns {string} Brief description.
   */
  function brief(s, lang) {
    return (s.brief && (s.brief[lang] || s.brief.en)) || "";
  }

  /**
   * The scheme's detail page ("how to apply") on myscheme.gov.in.
   * @param {Scheme} s  Scheme.
   * @returns {string} URL.
   */
  function link(s) {
    return "https://www.myscheme.gov.in/schemes/" + encodeURIComponent(s.slug);
  }

  /**
   * Filter schemes by a free-text query against the name in every shipped
   * language, the tags and the (en + native) briefs.
   * @param {SchemesData} data  Parsed snapshot.
   * @param {string} q  Query ("" returns everything).
   * @param {string} lang  UI language code (unused for matching — all
   *   languages are searched — kept for future ranking).
   * @returns {Scheme[]} Matching schemes, snapshot order preserved.
   */
  function filter(data, q, lang) {
    var needle = String(q || "")
      .trim()
      .toLowerCase();
    if (!needle) return data.schemes;
    return data.schemes.filter(function (s) {
      var hay = [s.slug];
      Object.keys(s.name || {}).forEach(function (k) {
        hay.push(s.name[k]);
      });
      Object.keys(s.brief || {}).forEach(function (k) {
        hay.push(s.brief[k]);
      });
      (s.tags || []).forEach(function (tg) {
        hay.push(tg);
      });
      return hay.join(" ").toLowerCase().indexOf(needle) !== -1;
    });
  }

  return { load: load, filter: filter, name: name, brief: brief, link: link };
})();
