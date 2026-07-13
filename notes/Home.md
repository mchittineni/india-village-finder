---
tags: [moc]
---

# Village Finder — knowledge map

Start here. Each link is a note in this vault; see [README](README.md) for conventions.

## Architecture

- [[pipeline]] — LGD dump → per-state datasets + web apps; sidecar pruning
- [[web-app]] — the vanilla-JS map app and its `VF_*` modules
- [[data-branches]] — the hybrid model: what lives on `data/*` branches vs reviewed PRs
- [[ci-workflows]] — every workflow, its cadence, and what it publishes

## Data sources (verified dossiers)

- [[lgd-datagov]] — villages/districts/pincodes (the dataset of record)
- [[agmarknet-mandi]] — daily mandi (APMC) prices
- [[myscheme]] — government schemes for farmers
- [[soilgrids]] — soil type overlay + per-village soil profile
- [[bhuvan-wms]] — groundwater-prospects overlay
- [[open-meteo]] — agromet weather
- [[cadastre-ramseraph]] — land parcels (APSAC / TRACGIS / KGIS) + FMB portals
- [[blocked-sources]] — what was evaluated and rejected, with evidence

## Decisions

- [[2026-07-10-datagov-user-agent]] — why the daily refresh silently 502'd
- [[2026-07-10-hybrid-data-branches]] — regenerable artifacts off main
- [[2026-07-13-sidecar-pruning]] — slow-cadence sidecars vs the daily refresh
- [[2026-07-13-curated-farm-inputs]] — fertilizer/soil as curated reference, not feeds

## Reference

- [[farm-input-rates]] — notified fertilizer prices & NBS rates (update per season)

## Comms

- [blog/](blog/README.md) — ready-to-post blog drafts (intro, war stories,
  architecture, farming features, i18n); release announcements are automated
  by `publish-blog.yml`
