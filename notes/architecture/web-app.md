---
tags: [architecture]
---

# Web app

Vanilla JS + Leaflet, no build step. One template (`scraper/web_template/`),
copied per state by the pipeline; behavior differences are **config-driven**
via the generated `config.js` (`window.VF_CONFIG`).

## Modules (each an IIFE on `window`)

| Module       | Global       | Does                                                                              |
| ------------ | ------------ | --------------------------------------------------------------------------------- |
| `app.js`     | —            | map, search, panels, popup wiring                                                 |
| `i18n.js`    | `VF_I18N`    | 6-language DICT (en/te/hi/kn/ta/ur) + transliteration engine                      |
| `nearby.js`  | `VF_NEARBY`  | Overpass civic-services lookup                                                    |
| `weather.js` | `VF_WEATHER` | Open-Meteo current + 7-day forecast ([[open-meteo]])                              |
| `mandi.js`   | `VF_MANDI`   | mandi snapshot loader + LGD↔Agmarknet district fuzzy match ([[agmarknet-mandi]]) |
| `schemes.js` | `VF_SCHEMES` | farmer-schemes snapshot loader/filter ([[myscheme]])                              |
| `soil.js`    | `VF_SOIL`    | SoilGrids point profile + agronomic classification ([[soilgrids]])                |

Cadastre (AP/TG/KA): MapLibre GL + PMTiles inside Leaflet, streamed from R2
([[cadastre-ramseraph]]).

## Patterns to preserve

- Feature presence = config presence (`CFG.cadastre`, `CFG.mandi.url`, …) —
  states without a feature simply omit the block.
- On-demand fetch + per-session cache + tap-to-retry for every external call;
  the app must work fully offline-of-feeds (panels degrade, map doesn't).
- The three corner side-panels (parcels / mandi / schemes) are mutually
  exclusive; popup boxes (weather / soil) live inline.
- All user-visible strings go through `t()` — add keys to **all six** languages.
