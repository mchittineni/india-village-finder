/** =====================================================================
   Village Finder — village agromet weather lookup
   Fetches the current conditions and a 7-day agricultural forecast for a
   village pin from the Open-Meteo forecast API (free, keyless, CORS-enabled).

   Exposes window.VF_WEATHER.fetch(lat, lng) -> Promise resolving to:
     { current: { tempC, humidityPct, precipMm, windKmh, code },
       days: [{ date, minC, maxC, rainMm, rainProbPct, code }...] }

   Results are cached per ~1 km grid cell for the session, so re-opening the
   same village (or a neighbouring one) doesn't refetch.

   Weather data by Open-Meteo.com (CC BY 4.0).

   @module web/weather
   @file On-demand Open-Meteo forecast lookup for a point, shaped for the
   village popup's agromet panel and exposed as `window.VF_WEATHER`.
   ===================================================================== */
/**
 * @typedef {Object} WeatherNow  Current conditions at the point.
 * @property {number} tempC        Air temperature, °C.
 * @property {number} humidityPct  Relative humidity, %.
 * @property {number} precipMm     Precipitation in the last interval, mm.
 * @property {number} windKmh      10 m wind speed, km/h.
 * @property {number} code         WMO weather interpretation code.
 */
/**
 * @typedef {Object} WeatherDay  One forecast day.
 * @property {string} date         ISO date (local to the village, IST).
 * @property {number} minC         Daily minimum temperature, °C.
 * @property {number} maxC         Daily maximum temperature, °C.
 * @property {number} rainMm       Precipitation sum, mm.
 * @property {number} rainProbPct  Maximum precipitation probability, %.
 * @property {number} code         WMO weather interpretation code.
 */
window.VF_WEATHER = (function () {
  "use strict";

  var ENDPOINT = "https://api.open-meteo.com/v1/forecast";
  var cache = {}; // "lat,lng" (2dp ≈ 1 km) -> Promise

  /**
   * Group a WMO weather-interpretation code into one of the app's i18n label
   * buckets (wx_clear, wx_cloudy, wx_overcast, wx_fog, wx_drizzle, wx_rain,
   * wx_storm) plus a display emoji.
   * @param {number} code  WMO weather code (0-99).
   * @returns {{key: string, icon: string}} Label bucket and emoji.
   */
  function describe(code) {
    if (code === 0) return { key: "wx_clear", icon: "☀️" };
    if (code <= 2) return { key: "wx_cloudy", icon: "🌤️" };
    if (code === 3) return { key: "wx_overcast", icon: "☁️" };
    if (code <= 48) return { key: "wx_fog", icon: "🌫️" };
    if (code <= 57) return { key: "wx_drizzle", icon: "🌦️" };
    if (code <= 82) return { key: "wx_rain", icon: "🌧️" };
    if (code <= 86) return { key: "wx_rain", icon: "🌨️" }; // snow: unlikely here
    return { key: "wx_storm", icon: "⛈️" };
  }

  /**
   * Fetch current conditions + 7-day daily forecast for a point (cached).
   * @param {number} lat  Latitude.
   * @param {number} lng  Longitude.
   * @returns {Promise<{current: WeatherNow, days: WeatherDay[]}>}
   */
  function fetchWeather(lat, lng) {
    var key = lat.toFixed(2) + "," + lng.toFixed(2);
    if (cache[key]) return cache[key];
    var url =
      ENDPOINT +
      "?latitude=" +
      lat.toFixed(4) +
      "&longitude=" +
      lng.toFixed(4) +
      "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum," +
      "precipitation_probability_max,weather_code" +
      "&timezone=Asia%2FKolkata&forecast_days=7";
    cache[key] = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        var c = j.current || {};
        var d = j.daily || {};
        var days = (d.time || []).map(function (date, i) {
          return {
            date: date,
            minC: (d.temperature_2m_min || [])[i],
            maxC: (d.temperature_2m_max || [])[i],
            rainMm: (d.precipitation_sum || [])[i],
            rainProbPct: (d.precipitation_probability_max || [])[i],
            code: (d.weather_code || [])[i]
          };
        });
        return {
          current: {
            tempC: c.temperature_2m,
            humidityPct: c.relative_humidity_2m,
            precipMm: c.precipitation,
            windKmh: c.wind_speed_10m,
            code: c.weather_code
          },
          days: days
        };
      })
      .catch(function (e) {
        delete cache[key]; // don't cache failures — allow retry
        throw e;
      });
    return cache[key];
  }

  return { fetch: fetchWeather, describe: describe };
})();
