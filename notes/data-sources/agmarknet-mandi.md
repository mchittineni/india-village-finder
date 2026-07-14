---
tags: [source]
verified: 2026-07-13
---

# Agmarknet mandi prices (data.gov.in)

- Resource: **"Current Daily Price of Various Commodities from Various Markets
  (Mandi)"**, id `9ef84268-d588-465a-a308-a864a43d0070` a rolling snapshot
  refreshed through the IST trading day (fetch at ~16:20 IST catches most).
- Same `DATA_GOV_KEY` + custom-UA plumbing as [[lgd-datagov]].
- Volume: ~1.5–7k rows/state/day (TN heaviest); ₹/quintal; not every mandi
  reports every day.
- Published daily to `data/mandi-prices` (flat, force-pushed) →
  fetched by the app at runtime ([[data-branches]]).
- **District names differ from LGD** ("Chittor" vs "Chittoor",
  "Dr.B.R.A.Konaseema" vs "Dr. B.R. Ambedkar Konaseema") `mandi.js`
  `matchDistrict()` scores common-prefix + shared ≥5-char tokens, threshold 5.
