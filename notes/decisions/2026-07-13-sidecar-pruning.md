---
tags: [decision]
date: 2026-07-13
---

# Pipeline prunes slow-cadence sidecars against each refresh

**Problem class.** Several committed files regenerate on slower cadences than
the daily LGD refresh: `names_translit.json` / `regions_native.json` (weekly
IndicXlit), `coords.json` (monthly enrich_coords). LGD renumbers/drops
villages in waves, so these sidecars accumulate orphaned codes and the
data-validity tests (rightly) fail the refresh PR. The 13Jul2026 wave orphaned
**990** coords entries at once.

**Decision.** `pipeline.py` prunes every such sidecar against **this run's**
valid codes during the daily build; the slower regeneration then back-fills
genuinely new entries on its own schedule.

**Rule going forward.** Any new committed artifact keyed by LGD codes that is
regenerated less often than daily **must** be added to the pipeline's pruning
step, and a test must assert its keys ⊆ current codes otherwise it will
break the refresh on the next big renumbering wave.

Note: `meta.counts.with_coords` only exists right after `enrich_coords.py`
runs (the daily pipeline rewrites `meta.json` without it), so the count
assertion is conditional by design.
