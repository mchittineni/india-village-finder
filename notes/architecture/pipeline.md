---
tags: [architecture]
---

# Data pipeline

One code path builds every state (`scraper/`, registry in `config.py`: AP 28,
TG 36, KA 29, TN 33, KL 32). Full script table: [scraper/README](../../scraper/README.md).

```
lgd_datagov.py ─(data.gov.in LGD API)→ .cache/raw/*.csv
pipeline.py    → <state>/web/data/{regions,villages,names,meta}.json + data/*.csv
               → copies web_template/ → <state>/web/ + writes config.js
build_boundaries.py / build_parcels_index.py / build_boundary_tiles.py
enrich_coords.py (monthly) / enrich_native_names.py (offline IndicXlit)
fetch_mandi_prices.py (daily) / fetch_farmer_schemes.py (weekly) → data/* branches
```

Key invariants:

- `pipeline.py` **verifies counts against the live LGD portal** each run and
  records the result in `meta.json` (tests fail a real mismatch).
- **Sidecar pruning**: files regenerated on slower cadences than the daily
  refresh (`names_translit.json`, `regions_native.json`, `coords.json`) are
  pruned against each run's fresh village/mandal codes so a refresh PR stays
  internally consistent. See [[2026-07-13-sidecar-pruning]].
- The UI is edited **only** in `scraper/web_template/`; per-state copies are
  build artifacts that happen to be committed. `config.js` is fully generated.
- Upstream outages exit **75** (EX_TEMPFAIL) → CI treats as a clean skip, never
  a red run ([[ci-workflows]]).

Related: [[lgd-datagov]] · [[data-branches]] · [[web-app]]
