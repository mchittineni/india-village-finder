# scraper/ — shared data pipeline

One code path builds the datasets and map apps for **both** states (Andhra Pradesh =
LGD state code `28`, Telangana = `36`). Run everything from this folder.

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements-dev.txt   # runtime + pytest
```

## Scripts

| Script | What it does |
|---|---|
| `pipeline.py` | Downloads the latest LGD dump (districts / mandals / villages), filters to AP + Telangana, **verifies counts against the live LGD portal**, and writes each state's `web/data/*.json` + `data/*.csv`. Also copies the UI template and writes `web/config.js`. |
| `build_boundaries.py` | Downloads LGD district & mandal boundary polygons, filters per state, drops invalid/duplicate codes, and **simplifies** them (via `mapshaper`) into `web/data/{districts,mandals}.geojson`. Run occasionally — boundaries rarely change. |
| `lgd_client.py` | Minimal client for LGD's live DWR endpoints. Used by `pipeline.py` for the verification cross-check. |
| `changelog.py` | Compares the working tree to `HEAD` and prints a Markdown summary of data changes — used as the body of the automated refresh PR. |
| `tests/` | `pytest` data-validity suite (see the root README). |

Common flags: `--state ap|tg|both` · `--offline` (reuse cached downloads) ·
`--no-verify` (skip the live LGD check).

## How it fits together

```
pipeline.py ──> ../andhra_pradesh/web/data/{regions,villages,meta}.json  +  ../andhra_pradesh/data/*.csv
            └─> ../telangana/...                       (same)
build_boundaries.py ──> ../<state>/web/data/{districts,mandals}.geojson
web_template/ ──(copied by pipeline)──> ../<state>/web/{index.html,app.js,styles.css}
```

`.cache/` holds the downloaded source dumps and is git-ignored (re-downloaded on demand).
Edit the UI **only** in `web_template/`; the per-state copies are regenerated.
