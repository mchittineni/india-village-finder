# Village Finder — web app API

This is the generated reference for the browser application that powers each state's
map (`scraper/web_template/`, copied verbatim into every `<state>/web/`). It is a
dependency-free, vanilla-JS app loaded directly by `index.html`; there is no build step.

It is organised as three modules, each an IIFE that publishes a single global:

| Module                                 | Global             | Responsibility                                                                                                                         |
| -------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`web/app`](module-web_app.html)       | — (entry point)    | Loads the JSON/GeoJSON data, renders the Leaflet map, the District → Mandal/Taluk → Village drill-down, search and the village popups. |
| [`web/i18n`](module-web_i18n.html)     | `window.VF_I18N`   | UI strings in six languages and the rule-based English→Indic place-name transliteration engine.                                        |
| [`web/nearby`](module-web_nearby.html) | `window.VF_NEARBY` | On-demand OpenStreetMap (Overpass) lookup of civic amenities near a pinned village.                                                    |

The per-state behaviour (which state, accent colour, language, Mandal vs Taluk) is
injected at load time as `window.VF_CONFIG` from each state's generated `config.js` —
see the `VFConfig` typedef on the `web/app` module.

The data contracts (`VillageRow`, `District`, `Mandal`, `Regions`, …) are documented as
typedefs and correspond directly to the JSON files in `<state>/web/data/`. For the data
pipeline that produces those files, see the Python reference under `docs/api/python/`.
