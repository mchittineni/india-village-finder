/** =====================================================================
   Village Finder — village soil & fertilizer profile lookup
   Fetches the WRB soil classification and topsoil properties (clay/sand,
   pH, organic carbon) for a village pin from the ISRIC SoilGrids point
   API (free, keyless, CORS-enabled; 250 m global model — the same source
   as the app's soil-type map overlay), then derives the display profile:
   texture bucket, pH class and an indicative nutrient note (e.g. zinc
   availability falls in alkaline soil).

   Exposes window.VF_SOIL:
     fetch(lat, lng) -> Promise<SoilProfile> (cached per ~1 km cell)
     texture(clayPct, sandPct)  -> texture bucket i18n key ("" if unknown)
     phClass(ph)                -> "soil_ph_acidic|neutral|alkaline" ("" if unknown)
     noteKey(ph, sandPct)       -> indicative nutrient-note i18n key
     groupKey(wrb)              -> Indian common-name i18n key for a WRB
                                   reference group ("" if unmapped)

   Everything here is a MODEL ESTIMATE (SoilGrids, CC BY 4.0), not a soil
   test — the UI must keep the "verify with a Soil Health Card" framing.

   @module web/soil
   @file On-demand SoilGrids classification + properties lookup for a point,
   shaped for the village popup's soil panel and exposed as `window.VF_SOIL`.
   ===================================================================== */
/**
 * @typedef {Object} SoilProfile  Model soil profile at the point.
 * @property {string} wrb      WRB reference group ("Vertisols"), "" if masked.
 * @property {?number} clayPct Topsoil clay, % (avg of 0-5 and 5-15 cm), null if masked.
 * @property {?number} sandPct Topsoil sand, % — same depths, null if masked.
 * @property {?number} ph      Topsoil pH (H₂O), null if masked.
 * @property {?number} ocPct   Topsoil organic carbon, %, null if masked.
 */
window.VF_SOIL = (function () {
  "use strict";

  var BASE = "https://rest.isric.org/soilgrids/v2.0";
  var cache = {}; // "lat,lng" (2dp ≈ 1 km) -> Promise<SoilProfile>

  /**
   * Average the mean values of the 0-5 cm and 5-15 cm depths of one
   * property layer, converting mapped units to target units via d_factor.
   * @param {Object} layer  One `properties.layers[]` entry.
   * @returns {?number} Averaged value in target units, or null when masked.
   */
  function topsoil(layer) {
    var df = (layer.unit_measure && layer.unit_measure.d_factor) || 1;
    var vals = (layer.depths || [])
      .map(function (d) {
        return d.values && d.values.mean;
      })
      .filter(function (v) {
        return v != null;
      });
    if (!vals.length) return null;
    var sum = 0;
    vals.forEach(function (v) {
      sum += v;
    });
    return sum / vals.length / df;
  }

  /**
   * Fetch and shape the soil profile for a point (cached). The two API
   * calls run in parallel; either failing alone still yields a profile
   * (the UI shows whatever is available — urban/water pixels are masked
   * in the properties model but usually still classify).
   * @param {number} lat  Latitude.
   * @param {number} lng  Longitude.
   * @returns {Promise<SoilProfile>}
   */
  function fetchSoil(lat, lng) {
    var key = lat.toFixed(2) + "," + lng.toFixed(2);
    if (cache[key]) return cache[key];
    var at = "lon=" + lng.toFixed(4) + "&lat=" + lat.toFixed(4);
    var classify = fetch(BASE + "/classification/query?" + at + "&number_classes=1")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () {
        return null;
      });
    var props = fetch(
      BASE +
        "/properties/query?" +
        at +
        "&property=clay&property=sand&property=phh2o&property=soc" +
        "&depth=0-5cm&depth=5-15cm&value=mean"
    )
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () {
        return null;
      });
    cache[key] = Promise.all([classify, props]).then(function (res) {
      var cls = res[0];
      var by = {};
      (((res[1] || {}).properties || {}).layers || []).forEach(function (l) {
        by[l.name] = topsoil(l);
      });
      var profile = {
        wrb: (cls && cls.wrb_class_name) || "",
        clayPct: by.clay != null ? by.clay : null,
        sandPct: by.sand != null ? by.sand : null,
        ph: by.phh2o != null ? by.phh2o : null,
        ocPct: by.soc != null ? by.soc / 10 : null // g/kg -> %
      };
      if (!profile.wrb && profile.ph == null) {
        delete cache[key]; // nothing usable — allow retry
        throw new Error("no soil data");
      }
      return profile;
    });
    cache[key].catch(function () {
      delete cache[key]; // don't cache failures — allow retry
    });
    return cache[key];
  }

  /**
   * Coarse texture bucket from the clay/sand fractions (simplified USDA
   * triangle — buckets, not the full 12 classes).
   * @param {?number} clayPct  Clay, %.
   * @param {?number} sandPct  Sand, %.
   * @returns {string} i18n key (soil_tex_*) or "" when unknown.
   */
  function texture(clayPct, sandPct) {
    if (clayPct == null || sandPct == null) return "";
    if (clayPct >= 40) return "soil_tex_clay";
    if (clayPct >= 27) return "soil_tex_clayloam";
    if (sandPct >= 65) return "soil_tex_sandy";
    if (sandPct >= 45) return "soil_tex_sandyloam";
    return "soil_tex_loam";
  }

  /**
   * pH reaction class.
   * @param {?number} ph  Topsoil pH.
   * @returns {string} i18n key (soil_ph_*) or "" when unknown.
   */
  function phClass(ph) {
    if (ph == null) return "";
    if (ph < 6.0) return "soil_ph_acidic";
    if (ph <= 7.5) return "soil_ph_neutral";
    return "soil_ph_alkaline";
  }

  /**
   * Indicative nutrient note for the point, by standard agronomic rules:
   * alkaline soil depresses zinc/iron availability (Zn is the most common
   * micronutrient gap in Indian soils), acidic soil fixes phosphorus, and
   * very sandy soil leaches nitrogen/potash between split doses.
   * @param {?number} ph  Topsoil pH.
   * @param {?number} sandPct  Sand, %.
   * @returns {string} i18n key (soil_note_*).
   */
  function noteKey(ph, sandPct) {
    if (ph != null && ph > 7.5) return "soil_note_alk";
    if (ph != null && ph < 5.5) return "soil_note_acid";
    if (sandPct != null && sandPct >= 65) return "soil_note_sandy";
    return "soil_note_ok";
  }

  /**
   * Indian common-name bucket for a WRB reference group (only the groups
   * that actually occur across AP/TG/KA/TN are mapped).
   * @param {string} wrb  WRB reference group name.
   * @returns {string} i18n key (soil_grp_*) or "" when unmapped.
   */
  function groupKey(wrb) {
    var GROUPS = {
      Vertisols: "soil_grp_black",
      Luvisols: "soil_grp_red",
      Lixisols: "soil_grp_red",
      Nitisols: "soil_grp_red",
      Acrisols: "soil_grp_red",
      Ferralsols: "soil_grp_red",
      Fluvisols: "soil_grp_alluvial",
      Cambisols: "soil_grp_alluvial",
      Gleysols: "soil_grp_alluvial",
      Arenosols: "soil_grp_sandy",
      Calcisols: "soil_grp_calc",
      Leptosols: "soil_grp_shallow",
      Regosols: "soil_grp_shallow"
    };
    return GROUPS[wrb] || "";
  }

  return {
    fetch: fetchSoil,
    texture: texture,
    phClass: phClass,
    noteKey: noteKey,
    groupKey: groupKey
  };
})();
