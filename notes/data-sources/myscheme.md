---
tags: [source]
verified: 2026-07-13
---

# myScheme (government schemes for farmers)

- Endpoint: `https://api.myscheme.gov.in/search/v6/schemes` (v4/v5 also live) —
  the same API the myscheme.gov.in frontend calls.
- Auth: the frontend's **public client key** in `x-api-key` **plus**
  `Origin: https://www.myscheme.gov.in` and `Referer` headers — 401 without
  them. Our honest project UA passes. Key rotates with frontend releases →
  `fetch_farmer_schemes.py` exits **1** on 401/403 (red run; fix via
  `MYSCHEME_API_KEY` secret or the `PUBLIC_KEY` constant), **75** on outage.
- Query: `q` = JSON list of `{identifier, value}` filters; repeating
  `beneficiaryState` ORs values → state + `"All"` (Central); category
  `"Agriculture,Rural & Environment"`; `lang=` returns localized
  schemeName/briefDescription for **all six UI languages**.
- Scheme page: `https://www.myscheme.gov.in/schemes/<slug>`.
- **Coverage is uneven per state** (2026-07: TN 37 state agri schemes, TG 4,
  KA 2, AP 0 — central schemes appear for everyone). Upstream gap, not a bug.
- Weekly snapshots → `data/farmer-schemes` branch ([[data-branches]]).
