---
tags: [decision]
date: 2026-07-10
---

# Hybrid data model: regenerable artifacts → `data/*` branches

**Problem.** Machine-regenerated outputs (boundary tiles, parcel indexes, OSM
name seeds, daily prices) flowed through reviewed PRs that only ever
rubber-stamped machine output — PR raising/merging kept breaking (stale
branches, `--fill` failures, pathspec traps) for zero review value, and
binary/pmtiles churn bloated main's history.

**Decision (user-selected: "Hybrid").** Publish regenerables straight to
dedicated `data/*` branches; overlay them where consumed (Pages deploys,
release zips, pipeline runs). **Keep the LGD village data and neural native
names on reviewed PRs** — the dataset of record feeds releases and the audit
trail, and the daily pipeline prunes + tests validate the neural names against
it, so splitting them would race.

**Alternatives rejected.**

- All-PRs (status quo): review theater + recurring automation failures.
- Everything to branches: loses the auditable review trail for the actual
  dataset of record.

Current branch inventory: [[data-branches]].
