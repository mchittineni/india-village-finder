---
tags: [source]
verified: 2026-07-13
---

# Evaluated and rejected sources (with evidence)

Keep this list current it prevents re-litigating dead ends. Re-verify before
citing (government infra does come back sometimes).

- **CGWB / India-WRIS** (groundwater levels) entire stack down 2026-07:
  `arc.indiawris.gov.in` times out even from Indian nodes, `cgwb.gov.in` 502,
  `aims-cgwb.org` NXDOMAIN. Historically flaky → never build a dependency.
  Bhuvan's groundwater-prospects WMS is the working alternative
  ([[bhuvan-wms]]).
- **urvarak.nic.in / iFMS** (district fertilizer stock) resets TCP
  connections to automated clients (2026-07). Dashboard-only, no documented
  API. → curated reference instead ([[2026-07-13-curated-farm-inputs]]).
- **soilhealth.dac.gov.in** (Soil Health Card) WAF 403s non-browser
  clients; React app with undocumented internal APIs; nutrient dashboards
  aggregate by SHC cycle (~2-yearly) anyway. → SoilGrids point model with
  "confirm via SHC test" framing ([[soilgrids]]).
- **data.gov.in fertilizer/SHC datasets** only static parliamentary-answer
  tables; the district/season resources have **no API enabled** ("Request
  API" state, verified via the `lists` catalog endpoint).
- **NBSS&LUP soil WMS on Bhuvan** renders outline-only and lacks AP/TS
  layers → replaced by SoilGrids.
- **data.gov.in `lists` catalog quirk** title search is fuzzy-OR and near
  useless for discovery; expect to hunt resource UUIDs via web search instead.
