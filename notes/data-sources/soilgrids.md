---
tags: [source]
verified: 2026-07-13
---

# ISRIC SoilGrids (soil overlay + point profile)

CC BY 4.0, keyless, 250 m global model. Two integrations:

## WMS overlay (map layer)

- `https://maps.isric.org/mapserv?map=/map/wrb.map`, layer `MostProbable`
  (WRB most-probable class). Leaflet must send `STYLES` (it does by default —
  omitting it yields `MissingParameterValue`).
- Chosen over NBSS&LUP's Bhuvan soil WMS (outline-only styling, no AP/TS).

## Point API (per-village profile)

- `https://rest.isric.org/soilgrids/v2.0/classification/query?lon&lat&number_classes=N`
  → WRB reference group (30 classes; e.g. Guntur → **Vertisols**, correct).
- `…/v2.0/properties/query?lon&lat&property=clay&property=sand&property=phh2o&property=soc&depth=0-5cm&depth=5-15cm&value=mean`
  → values in mapped units; **divide by `d_factor`**; soc lands in g/kg
  (→ % = /10).
- CORS `*` on both. Latency: seconds (first query per area can hit ~12 s).
- **Urban/water pixels are masked** in properties (verified: Guntur town,
  Trichy town return nulls) while classification usually still resolves —
  the UI shows whatever is available.
- Display derivations (texture bucket from clay/sand, pH class, nutrient
  note incl. the alkaline→zinc-deficiency flag) are client-side rules in
  `soil.js`; everything is framed as a model estimate vs a Soil Health Card
  test. See [[2026-07-13-curated-farm-inputs]] for why there's no live SHC
  feed.
