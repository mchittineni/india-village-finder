---
tags: [architecture]
---

# Web app

Vanilla JS + Leaflet, no build step. One template (`scraper/web_template/`),
copied per state by the pipeline; behavior differences are **config-driven**
via the generated `config.js` (`window.VF_CONFIG`).

## Modules (each an IIFE on `window`)

| Module       | Global       | Does                                                                                   |
| ------------ | ------------ | -------------------------------------------------------------------------------------- |
| `app.js`     | —            | map + base layers, search, drill-down panels, village detail view, Near me, deep links |
| `i18n.js`    | `VF_I18N`    | 7-language DICT (en/te/hi/kn/ta/ml/ur) + transliteration engine                        |
| `nearby.js`  | `VF_NEARBY`  | Overpass civic-services lookup                                                         |
| `weather.js` | `VF_WEATHER` | Open-Meteo current + 7-day forecast ([[open-meteo]])                                   |
| `mandi.js`   | `VF_MANDI`   | mandi snapshot loader + LGD↔Agmarknet district fuzzy match ([[agmarknet-mandi]])       |
| `schemes.js` | `VF_SCHEMES` | farmer-schemes snapshot loader/filter ([[myscheme]])                                   |
| `soil.js`    | `VF_SOIL`    | SoilGrids point profile + agronomic classification ([[soilgrids]])                     |

Cadastre (all five states): MapLibre GL + PMTiles inside Leaflet, streamed from R2
([[cadastre-ramseraph]]).

## Patterns to preserve

- Feature presence = config presence (`CFG.cadastre`, `CFG.mandi.url`, …)
  states without a feature simply omit the block.
- On-demand fetch + per-session cache + tap-to-retry for every external call;
  the app must work fully offline-of-feeds (panels degrade, map doesn't).
- The three corner side-panels (parcels / mandi / schemes) are mutually
  exclusive. On phones (≤820 px) they become bottom sheets over the list.
- The map popup is an info-only label. Everything you can do for a village lives
  in the side-panel **village detail view** (`renderVillagePanel`): a grid of
  `.vd-tile` buttons; weather / soil / nearby render into its `.vd-out` box via
  the shared `loadInto()` (loading line → result, or tap-to-retry), while mandi /
  schemes / parcels open their side panels.
- **Deep links:** the open village is mirrored to `#v=<LGD code>` with
  `history.replaceState` (no history spam); `openFromHash()` reopens it once the
  Stage-2 village data has loaded (and on `hashchange`).
- **Near me:** browser geolocation (never sent anywhere) → point-in-polygon over
  `mandals.geojson` to find the mandal/taluk → nearest village with a known point
  (`village_points.json`, then `coords.json`) inside it, else within ~25 km.
- **Base maps:** OpenStreetMap standard tiles (default) and Esri World Imagery,
  switchable in the layers control; the choice persists in `localStorage.vf_base`.
  CARTO's keyless basemaps were dropped when they started requiring an API key.
- **Phone layout (≤820 px):** a CSS grid puts the map on top (40dvh) and the
  panel below; the collapse button toggles "bigger map". `#app[data-level]`
  (set in `renderBreadcrumb`) hides the state chips, breadcrumb and footer past
  the state level so content stays above the fold.
- **Accessibility floor:** ≥44 px tap targets, 16 px base text (inputs too, so
  iOS never zooms), muted text `#64748b` (AA on white), one global
  `:focus-visible` ring, `prefers-reduced-motion` honoured, toast is
  `role="status"`, icons are inline SVG with `aria-hidden`.
- All user-visible strings go through `t()`: add keys to **all seven** languages
  (`scraper/tests/test_i18n_parity.py` fails otherwise).
