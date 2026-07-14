---
tags: [architecture]
---

# CI workflows

Shared steps live as composites in `.github/actions/` (`setup-pipeline`,
`datagov-fetch` = the exit-75 outage-skip contract, `publish-data-branch`,
`overlay-data-branches`); each workflow keeps only its unique logic.

| Workflow                      | Cadence                      | Output                                                  |
| ----------------------------- | ---------------------------- | ------------------------------------------------------- |
| `update-data.yml`             | daily (+ monthly boundaries) | **reviewed PR** on `data/auto-refresh`                  |
| `update-mandi-prices.yml`     | daily 10:47 UTC              | `data/mandi-prices` branch                              |
| `update-farmer-schemes.yml`   | weekly Mon                   | `data/farmer-schemes` branch                            |
| `seed-osm-names.yml`          | monthly                      | `data/osm-names` branch                                 |
| `build-boundary-tiles.yml`    | monthly                      | `data/boundary-tiles` branch                            |
| `build-parcels-index.yml`     | on demand                    | `data/parcels-index` branch (non-destructive per state) |
| `regenerate-native-names.yml` | weekly/on demand             | reviewed PR (IndicXlit neural names)                    |
| `mirror-cadastrals.yml`       | on upstream change           | PMTiles mirrored to Cloudflare R2                       |
| `ci.yml`                      | every PR/push                | pytest data-validity suite                              |
| `docs.yml`                    | PRs touching docs            | jsdoc/pdoc build check                                  |
| `release.yml`                 | data merges                  | versioned GitHub Release (+ data-branch overlays)       |
| `publish-blog.yml`            | release published            | dev.to blog draft (+ Medium via legacy token)           |
| `deploy-pages.yml`            | pushes to main               | live site (+ data-branch overlays)                      |

Conventions (enforced by review, documented in CONTRIBUTING):

- Third-party actions are **SHA-pinned**; inputs bind via `env:` (never
  interpolated into `run:`).
- Upstream outage = **exit 75** = clean skip with a step-summary note; any
  other non-zero exit stays red. A rotated API key (myScheme) exits 1 on
  purpose; that needs a human.
- The daily data PR reuses one branch (`data/auto-refresh`) so consecutive
  runs update a single PR in place.
