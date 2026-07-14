---
tags: [source]
verified: 2026-07-10
---

# Bhuvan WMS (groundwater prospects)

- `https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms`, layers
  `gw:AP_LGEOM,gw:TS_LGEOM,gw:KA_LGEOM,gw:TN_LGEOM` (RGNDWM groundwater
  prospects, 1:50K, classified by well depth/yield). Multi-layer in one
  request works; anonymous; HTTPS OK.
- `vec1` sends **no CORS** headers fine for raster `<img>` tiles, but
  GetFeatureInfo would need a proxy. `vec2` sends CORS `*` (hosts the NBSS&LUP
  soil layers we rejected see [[soilgrids]]).
- Attribution required (Bhuvan/NRSC); no redistribution tiles are fetched
  live by the browser, never stored (see DATA_LICENSE "live third-party
  layers").
