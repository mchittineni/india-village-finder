---
tags: [source]
verified: 2026-07-10
---

# Open-Meteo (agromet weather)

- `https://api.open-meteo.com/v1/forecast` keyless, CORS-enabled, CC BY 4.0.
- Used for current conditions + 7-day daily agromet forecast
  (min/max °C, precipitation sum, precipitation probability, WMO code),
  `timezone=Asia/Kolkata`.
- Cached per ~1 km cell per session in `weather.js`.
- Offers more agromet params if wanted later (e.g.
  `et0_fao_evapotranspiration`, soil moisture bands).
