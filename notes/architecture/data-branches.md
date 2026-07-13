---
tags: [architecture]
---

# Hybrid data model — `data/*` branches vs reviewed PRs

Decision record: [[2026-07-10-hybrid-data-branches]].

Machine-regenerated artifacts whose "review" would only rubber-stamp are
published straight to dedicated branches; the **LGD village data and neural
native names stay on the reviewed-PR path** (dataset of record; tests validate
the neural names against it, and the daily pipeline prunes them).

| Branch                | Content                                | Cadence | Consumed via                           |
| --------------------- | -------------------------------------- | ------- | -------------------------------------- |
| `data/mandi-prices`   | Agmarknet price snapshots (per state)  | daily   | app at runtime (raw.githubusercontent) |
| `data/farmer-schemes` | myScheme scheme snapshots (per state)  | weekly  | app at runtime (raw.githubusercontent) |
| `data/boundary-tiles` | `boundaries.pmtiles` + bbox indexes    | monthly | Pages deploy + release zips (overlay)  |
| `data/parcels-index`  | per-state parcel bbox/centroid indexes | on need | Pages deploy + release zips (overlay)  |
| `data/osm-names`      | OSM native-name seeds                  | monthly | pipeline runs at build time (overlay)  |

Mechanics:

- **Runtime branches** are flat and force-pushed as a single commit each run —
  history never grows. raw.githubusercontent serves them with CORS `*`.
- **Overlay branches** use the `publish-data-branch` / `overlay-data-branches`
  composites (`.github/actions/`); absent branches are skipped so first runs
  and forks work.
- Consequence: overlay-branch updates reach the live site **on the next Pages
  deploy** (their workflows trigger one); runtime branches are instant.
