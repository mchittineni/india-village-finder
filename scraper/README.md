# scraper/ — shared data pipeline

One code path builds the datasets and map apps for **every** state (Andhra Pradesh =
LGD state code `28`, Telangana = `36`, Karnataka = `29`, Tamil Nadu = `33`). Run
everything from this folder.

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements-dev.txt   # runtime + pytest
```

## Scripts

| Script | What it does |
|---|---|
| `pipeline.py` | Downloads the latest LGD dump (districts / sub-districts / villages / pincodes), filters to each state, **verifies counts against the live LGD portal**, and writes each state's `web/data/*.json` + `data/*.csv`. Also extracts LGD's authoritative native village names (`web/data/names.json`, script-validated), copies the UI template, and writes `web/config.js` (incl. the per-state sub-district term — Mandal or Taluk — and native language). |
| `build_boundaries.py` | Downloads LGD district & sub-district boundary polygons, filters per state, drops invalid/duplicate codes, and **simplifies** them (via `mapshaper`) into `web/data/{districts,mandals}.geojson`. Run occasionally — boundaries rarely change. |
| `enrich_coords.py` | Best-effort **precise village coordinates**: matches each village by name to a GeoNames place and keeps it only when close to the village's sub-district. Writes `web/data/coords.json`. |
| `enrich_native_names.py` | Best-effort **neural native names** for the places LGD doesn't publish in-script: runs **AI4Bharat IndicXlit** (a trained English→Indic model, far better than the rule engine). Default writes village names to `web/data/names_translit.json`; `--regions` writes district/sub-district/state names to `web/data/regions_native.json` (reusing same-named villages' native names first, model for the rest — so it degrades gracefully without the model). Run **occasionally** and commit the output — it needs a heavy, **offline-only** dependency (`pip install -r requirements-translit.txt`, pulls in PyTorch). `--eval` scores the model against LGD's authoritative names; `--state ap\|tg\|ka\|tn` limits scope. The map and CSV read the committed JSON, so CI/the browser never need PyTorch. |
| `lgd_client.py` | Minimal client for LGD's live DWR endpoints. Used by `pipeline.py` for the verification cross-check. |
| `changelog.py` | Compares the working tree to `HEAD` and prints a Markdown summary of data changes — used as the body of the automated refresh PR. |
| `release_notes.py` | Generates the notes + version inputs for the automated GitHub Release. |
| `translit_eval.mjs` | Scores the UI transliteration engine against LGD's authoritative native names (exact-match % + character accuracy). `node scraper/translit_eval.mjs` to report; `--check` enforces a floor (run in CI). |
| `translit_cli.mjs` | Batch transliteration bridge (stdin JSON → native script) so `pipeline.py` can fill the CSV's native-name column using the *same* engine as the UI (`web_template/i18n.js`). |
| `tests/` | `pytest` data-validity suite (see the root README). |

Common flags: `--state ap|tg|ka|tn|both` · `--offline` (reuse cached downloads) ·
`--no-verify` (skip the live LGD check).

## How it fits together

```
pipeline.py ──> ../<state>/web/data/{regions,villages,names,meta}.json  +  ../<state>/data/*.csv
                 (<state> = andhra_pradesh | telangana | karnataka | tamil_nadu)
build_boundaries.py     ──> ../<state>/web/data/{districts,mandals}.geojson
enrich_coords.py        ──> ../<state>/web/data/coords.json
enrich_native_names.py  ──> ../<state>/web/data/names_translit.json   (offline; IndicXlit; villages)
enrich_native_names.py --regions ──> ../<state>/web/data/regions_native.json  (district/mandal/state)
web_template/ ──(copied by pipeline)──> ../<state>/web/{index.html,app.js,i18n.js,nearby.js,styles.css}
```

`.cache/` holds the downloaded source dumps and is git-ignored (re-downloaded on demand).
Edit the UI **only** in `web_template/`; the per-state copies are regenerated.

**Native village names — two layers.** `names.json` is the **authoritative** LGD
spelling (script-validated) and is the only one the pipeline writes. Where LGD has no
in-script name, `enrich_native_names.py` produces a clearly-**approximate** neural
spelling in `names_translit.json`. The map (`vname`) and the CSV prefer them in order
**LGD → neural → rule-based transliteration**, so the heavy IndicXlit step is optional
and run offline, yet its committed output upgrades both surfaces. Its dependency lives
in `requirements-translit.txt`, intentionally separate from `requirements-dev.txt`.
