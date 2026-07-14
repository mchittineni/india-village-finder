/** =====================================================================
   Village Finder — "nearby services" lookup
   Queries OpenStreetMap (Overpass API) on demand for civic amenities near a
   village pin: hospitals/clinics, government offices, and key public buildings
   (police, post office, fire station, courthouse, town hall).

   Exposes window.VF_NEARBY.fetch(lat, lng, opts) -> Promise resolving to:
     { health: [item...], government: [item...], civic: [item...] }
   where item = { name, type, dist (in km), lat, lng, osm (url) }.

   Data © OpenStreetMap contributors (ODbL). Results are best-effort — rural
   coverage in OSM is uneven, so a village may legitimately return nothing.

   @module web/nearby
   @file On-demand Overpass (OpenStreetMap) lookup of civic amenities near a
   point, grouped for display and exposed as `window.VF_NEARBY`.
   ===================================================================== */
/**
 * @typedef {Object} NearbyItem  One civic amenity found near a point.
 * @property {string} name  Display name ("" when OSM has none).
 * @property {string} type  hospital | clinic | police | post_office | fire_station | townhall | courthouse | government.
 * @property {number} dist  Distance from the query point, in km.
 * @property {number} lat
 * @property {number} lng
 * @property {string} osm   OpenStreetMap URL for the element.
 */
/**
 * @typedef {Object} NearbyGroups  Amenities grouped for display.
 * @property {NearbyItem[]} health      Hospitals & clinics.
 * @property {NearbyItem[]} government  Government offices & civic buildings.
 * @property {NearbyItem[]} civic       Police, post office, fire station.
 */
window.VF_NEARBY = (function () {
  "use strict";

  var ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  // amenity/office value -> { group, type }
  var CLASS = {
    hospital: { group: "health", type: "hospital" },
    clinic: { group: "health", type: "clinic" },
    doctors: { group: "health", type: "clinic" },
    police: { group: "civic", type: "police" },
    post_office: { group: "civic", type: "post_office" },
    fire_station: { group: "civic", type: "fire_station" },
    townhall: { group: "government", type: "townhall" },
    courthouse: { group: "government", type: "courthouse" }
  };

  /**
   * Classify an OSM element's tags into a display group and amenity type.
   * @param {Object} tags  OSM element tags (amenity / office / government).
   * @returns {({group: string, type: string}|null)} Group & type, or null if irrelevant.
   */
  function classify(tags) {
    var a = tags.amenity,
      o = tags.office,
      g = tags.government;
    if (a && CLASS[a]) return CLASS[a];
    if (o === "government" || g) return { group: "government", type: "government" };
    return null;
  }

  /**
   * Great-circle distance between two lat/lng points.
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} Distance in kilometres.
   */
  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371,
      toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad,
      dLng = (lng2 - lng1) * toRad;
    var s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /**
   * Build the Overpass QL query for relevant amenities within a radius.
   * @param {number} lat  Latitude.
   * @param {number} lng  Longitude.
   * @param {number} radius  Search radius in metres.
   * @returns {string} Overpass QL query.
   */
  function buildQuery(lat, lng, radius) {
    var a = "(around:" + radius + "," + lat + "," + lng + ")";
    return (
      "[out:json][timeout:25];(" +
      'nwr["amenity"~"^(hospital|clinic|doctors|police|post_office|fire_station|townhall|courthouse)$"]' +
      a +
      ";" +
      'nwr["office"="government"]' +
      a +
      ";" +
      'nwr["government"]' +
      a +
      ";" +
      ");out center tags 120;"
    );
  }

  /**
   * Build the OpenStreetMap URL for an element.
   * @param {{type: string, id: (number|string)}} el  OSM element.
   * @returns {string} OSM element URL.
   */
  function osmUrl(el) {
    return "https://www.openstreetmap.org/" + el.type + "/" + el.id;
  }

  /**
   * Parse an Overpass response into deduped, distance-sorted, capped groups.
   * @param {Object} json  Overpass JSON response.
   * @param {number} lat  Query latitude.
   * @param {number} lng  Query longitude.
   * @param {number} [perGroup]  Max items per group (default 5).
   * @returns {NearbyGroups} Grouped amenities.
   */
  function parse(json, lat, lng, perGroup) {
    var groups = { health: [], government: [], civic: [] };
    var seen = {};
    (json.elements || []).forEach(function (el) {
      var tags = el.tags || {};
      var cls = classify(tags);
      if (!cls) return;
      var plat = el.lat != null ? el.lat : el.center && el.center.lat;
      var plng = el.lon != null ? el.lon : el.center && el.center.lon;
      if (plat == null || plng == null) return;
      var name = (tags.name || tags["name:en"] || "").trim();
      var key = (name || "") + "@" + plat.toFixed(4) + "," + plng.toFixed(4);
      if (seen[key]) return;
      seen[key] = 1;
      groups[cls.group].push({
        name: name,
        type: cls.type,
        dist: haversine(lat, lng, plat, plng),
        lat: plat,
        lng: plng,
        osm: osmUrl(el)
      });
    });
    Object.keys(groups).forEach(function (g) {
      groups[g].sort(function (x, y) {
        return x.dist - y.dist;
      });
      groups[g] = groups[g].slice(0, perGroup || 5);
    });
    return groups;
  }

  var cache = {};

  /**
   * POST an Overpass query, falling back to the next mirror on failure.
   * @param {string} query  Overpass QL query.
   * @param {AbortSignal} [signal]  Optional abort signal.
   * @returns {Promise<Object>} Parsed Overpass JSON.
   */
  function fetchOverpass(query, signal) {
    var i = 0;
    /**
     * Try the next endpoint, recursing to the following mirror on a non-abort error.
     * @returns {Promise<Object>} Parsed Overpass JSON.
     */
    function tryNext() {
      var url = ENDPOINTS[i++];
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: signal
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Overpass " + r.status);
          return r.json();
        })
        .catch(function (e) {
          if (i < ENDPOINTS.length && e.name !== "AbortError") return tryNext();
          throw e;
        });
    }
    return tryNext();
  }

  /**
   * Public entry (exposed via `window.VF_NEARBY.fetch`): fetch and group civic
   * amenities near a point, with per-radius caching.
   * @param {number} lat  Latitude.
   * @param {number} lng  Longitude.
   * @param {{radius: number, perGroup: number, signal: AbortSignal}} [opts]
   *   `radius` in metres (default 10000), `perGroup` cap (default 5), abort `signal`.
   * @returns {Promise<NearbyGroups>} Grouped amenities.
   */
  function fetchNearby(lat, lng, opts) {
    opts = opts || {};
    var radius = opts.radius || 10000;
    var perGroup = opts.perGroup || 5;
    var ck = lat.toFixed(4) + "," + lng.toFixed(4) + "/" + radius;
    if (cache[ck]) return Promise.resolve(cache[ck]);
    return fetchOverpass(buildQuery(lat, lng, radius), opts.signal).then(function (json) {
      var groups = parse(json, lat, lng, perGroup);
      cache[ck] = groups;
      return groups;
    });
  }

  return { fetch: fetchNearby };
})();
