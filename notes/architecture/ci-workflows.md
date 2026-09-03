---
tags: [architecture]
---

# CI workflows

Shared steps live as composites in `.github/actions/` (`setup-pipeline`,
`datagov-fetch` = the exit-75 outage-skip contract, `publish-data-branch`,
`overlay-data-branches`); each workflow keeps only its unique logic.

| Workflow                      | Cadence                                | Output                                                   |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `update-data.yml`             | weekly unified refresh                 | **reviewed PR** + mandi prices + farmer schemes branches |
| `seed-osm-names.yml`          | monthly                                | `data/osm-names` branch                                  |
| `build-boundary-tiles.yml`    | monthly                                | `data/boundary-tiles` branch                             |
| `build-parcels-index.yml`     | on demand                              | `data/parcels-index` branch (non-destructive per state)  |
| `regenerate-native-names.yml` | triggered by update-data.yml/on demand | reviewed PR (IndicXlit neural names; per-state matrix)   |
| `mirror-cadastrals.yml`       | on upstream change                     | PMTiles mirrored to Cloudflare R2                        |
| `ci.yml`                      | every PR/push                          | pytest data-validity suite + Prettier format check       |
| `docs.yml`                    | PRs touching docs                      | jsdoc/pdoc build check                                   |
| `release.yml`                 | data merges                            | versioned GitHub Release (+ data-branch overlays)        |
| `publish-blog.yml`            | release published                      | dev.to blog draft (+ Medium via legacy token)            |
| `deploy-pages.yml`            | pushes to main                         | live site (+ data-branch overlays)                       |

Conventions (enforced by review, documented in CONTRIBUTING):

- Third-party actions are **SHA-pinned**; inputs bind via `env:` (never
  interpolated into `run:`).
- Upstream outage = **exit 75** = clean skip with a step-summary note; any
  other non-zero exit stays red. A rotated API key (myScheme) exits 1 on
  purpose; that needs a human.
- The weekly data PR reuses one branch (`data/auto-refresh`) so consecutive
  runs update a single PR in place.
- Heavy per-state work (village refresh, neural names) fans out as a matrix
  leg per state, so the slowest state bounds the wall-clock. The neural-names
  legs also persist three caches between runs (built venv, model weights,
  per-state transliteration results), so a rerun only transliterates
  never-seen names.
