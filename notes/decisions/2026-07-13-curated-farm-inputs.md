---
tags: [decision]
date: 2026-07-13
---

# Fertilizer & soil ship as curated reference + links, not live feeds

**Ask.** Integrate fertilizer availability, soil minerals and scheme updates
for farmers.

**Findings (2026-07, evidence in [[blocked-sources]]).** Schemes have a real
API ([[myscheme]]) → full automated integration. Fertilizer stock and
soil-test data do **not**: iFMS/urvarak resets connections, the SHC portal
WAF-blocks automation, and data.gov.in carries no API-enabled dataset for
either.

**Decision.** Ship what is verifiable and stable instead of scraping fragile
dashboards:

- `config.FARM_INPUTS`: statutory urea MRP + NBS-subsidised DAP price per
  season ([[farm-input-rates]]) + official portal links (iFMS, SHC).
- Per-village soil comes from the SoilGrids point model with rule-based,
  clearly-indicative notes ([[soilgrids]]) never presented as a soil test.

**Rejected.** Scraping urvarak/SHC dashboards (undocumented NIC internals,
geo-fenced, breaks silently same class as the CGWB exclusion).

**Revisit when** iFMS exposes a stable endpoint or OGD enables an API on the
fertilizer/SHC datasets.
