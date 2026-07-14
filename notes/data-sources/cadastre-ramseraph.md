---
tags: [source]
verified: 2026-07-10
---

# Cadastre (land parcels) state GIS extracts via ramSeraph

- Source: state GIS agencies' survey-plot extracts, **CC0**, via
  [`ramSeraph/indian_cadastrals`](https://github.com/ramSeraph/indian_cadastrals):
  **APSAC** (AP), **TRACGIS** Bhunaksha (TG), **KGIS** (KA). No owner/farmer
  data. TN has no open vector cadastre.
- The agencies' own live servers are **token-gated** (APSAC ArcGIS etc.)
  that's why the mirror route exists. Mirrored to **Cloudflare R2** (zero
  egress, HTTP Range + CORS for the Pages origin) by `mirror-cadastrals.yml`.
- Schema differs per state `config.py` `cadastre.fields` maps each onto
  canonical roles. KGIS tiles carry **no place names** but do carry the LGD
  village code → KA highlights by code.
- Per-village jump indexes are built by `build_parcels_index.py` →
  `data/parcels-index` branch ([[data-branches]]).

## FMB / sub-survey portals (no URL prefill all NIC form wizards)

| State | Portal                                                  | Notes                 |
| ----- | ------------------------------------------------------- | --------------------- |
| AP    | BhuNaksha `bhunaksha.ap.gov.in/bhunaksha/fmb/index.jsp` | no login/captcha      |
| TG    | Bhu Bharati `bhubharati.telangana.gov.in/gis/`          | Dharani's successor   |
| KA    | Bhoomi `landrecords.karnataka.gov.in/service130/`       | OTP login             |
| TN    | eservices chitta/FMB `eservices.tn.gov.in`              | captcha               |
| KL    | Ente Bhoomi (e-Rekha) `survey.entebhoomi.kerala.gov.in` | ILIMS digital records |

The app copies the parcel identifiers to the clipboard and opens the portal
(`cadastre.fmb` in config). NIC portals geo-fence to Indian IPs can't be
verified from outside India.
