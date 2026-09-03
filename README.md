# 🗺️ Village Finder - Andhra Pradesh, Telangana, Karnataka, Tamil Nadu & Kerala

[![Build](https://github.com/mchittineni/india-village-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/mchittineni/india-village-finder/actions/workflows/ci.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Data: GODL-India](https://img.shields.io/badge/data-GODL--India-orange.svg)](DATA_LICENSE.md)
[![Latest release](https://img.shields.io/github/v/release/mchittineni/india-village-finder?sort=semver&color=blueviolet)](https://github.com/mchittineni/india-village-finder/releases/latest)
[![Stars](https://img.shields.io/github/stars/mchittineni/india-village-finder?style=flat&logo=github)](https://github.com/mchittineni/india-village-finder/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Issues welcome](https://img.shields.io/badge/issues-welcome-brightgreen.svg)](https://github.com/mchittineni/india-village-finder/issues/new/choose)

Find **any village** in Andhra Pradesh, Telangana, Karnataka, Tamil Nadu or Kerala on an
interactive map, organised by the official **District → Mandal/Taluk → Village**
hierarchy and keep that data fresh automatically.

> 🌐 **Live site:** <https://mchittineni.github.io/india-village-finder/>

## Contents

- [What you get](#what-you-get) · [How it's organised](#how-the-project-is-organised) ·
  [Where the data comes from](#where-the-data-comes-from) · [Run it yourself](#run-it-yourself)
- [The review flow](#how-updates-stay-safe-the-review-flow) · [Hosting](#hosting-github-pages) ·
  [Downloads](#downloads-github-releases) · [Roadmap](#roadmap)
- [Contributing & community](#contributing--community) · [Licence](#licence) ·
  [Acknowledgements](#acknowledgements)

## About

This is an open-source project that simplifies searching for Indian geographical and
administrative locations. Instead of manually browsing government websites, users can
instantly search for:

- 🇮🇳 States
- 🏙️ Districts
- 🏡 Mandals / Taluks / Tehsils
- 🌾 Villages
- 📮 PIN Codes

The project is designed for developers, researchers, government services, logistics
platforms, and citizens who need quick and accurate location information through a
modern web interface or API.

> **This release** delivers interactive village maps + search for **Andhra Pradesh**,
> **Telangana**, **Karnataka**, **Tamil Nadu** and **Kerala** (District → Mandal/Taluk →
> Village).
> More states and a public API are on the roadmap.

|                  | Andhra Pradesh | Telangana |  Karnataka | Tamil Nadu |    Kerala |
| ---------------- | -------------: | --------: | ---------: | ---------: | --------: |
| Districts        |             28 |        33 |         31 |         38 |        14 |
| Mandals / Taluks |            688 |       617 |        240 |        317 |        78 |
| **Villages**     |     **16,355** | **9,074** | **26,198** | **14,711** | **1,357** |

_(Counts come from the latest LGD refresh via the data.gov.in API; the automated
pipeline keeps them current. Karnataka's, Tamil Nadu's and Kerala's sub-districts
are **Taluks**; AP/Telangana's are **Mandals**. Kerala's ~1.4k revenue villages
are few and large by design.)_

---

## What you get

- **A visual map** for each state districts shaded by how many villages they
  contain (a _choropleth_). Click a district to zoom into its mandals; click a
  mandal to list its villages; click a village to pin it.
- **Instant search** across every village, mandal and district or by **pincode**.
- **Multilingual UI** switch the interface between **English, Telugu, Kannada, Tamil,
  Malayalam, Hindi and Urdu** (Urdu right-to-left). Place names are also rendered in the chosen
  script via a **morpheme-aware** transliteration engine (it renders common place-name
  suffixes like `-pur`/`-palli`/`-puram` from their canonical spelling, not letter-by-
  letter). It's still approximate the canonical English name is always kept on hover
  and used for search but its fidelity is **measured against LGD's official names**
  (`scraper/translit_eval.mjs`) and guarded in CI.
- **Native-script names for every village** when the state's own language is selected,
  each village shows its native name resolved as **authoritative in-script spelling →
  neural transliteration → rule-based transliteration**. The current LGD source (the
  data.gov.in feed) doesn't carry the local-script name column, so names are produced by a
  trained neural model (**AI4Bharat IndicXlit**, committed offline as `names_translit.json`),
  with the rule engine as a final fallback so **every village still carries a native name**.
  The authoritative path remains first in the order and takes precedence automatically if a
  source that publishes official in-script spellings is wired back in. District, sub-district
  and state names render in native script too (`regions_native.json`). The canonical English
  name is always kept on hover and used for search.
- **Instant progressive loading & caching** staged loading architecture renders the map,
  district boundaries and UI chrome in **~100 ms (Stage 1)** while streaming heavy village datasets
  and mandal boundaries in the background (**Stage 2**) without blocking the main thread. A transparent
  browser **Cache Storage API** layer (`window.caches`) serves return visits and state switches in 1–5 ms.
- **Accurate, deletion-resistant data storage** compound sorting `(norm(name), int(village_code))`
  guarantees 100% stable ordering across runs without duplicate-name shuffling. Git-friendly line-by-line JSON
  formatting produces 1-line diffs, and persistent master sidecar archives (`coords_master.json`,
  `names_translit_master.json`) ensure verified coordinates and transliterations are never wiped out.
- **Districts, mandals and villages listed A → Z** for predictable scanning.
- **Pincodes** for ~99.9% of villages (from LGD), shown in lists, search and pins.
- **Village locations** where we can confidently place them (matched via GeoNames and
  validated against the village's sub-district; coverage varies by state, ~8–17%); the
  rest pin at sub-district (mandal/taluk) level.
- **Land parcels (all five states)** an optional cadastral layer showing
  individual survey plots (with survey numbers), streamed from a PMTiles vector archive
  and toggled on the map. Select a village to jump to its plots, and filter the parcel
  list by survey number (AP/TG by name, KA/TN by LGD code; Kerala's tiles carry only
  survey numbers, so it gets the layer + popups without the per-village jump). Data is
  **CC0** from each state's GIS agency (APSAC / TRACGIS / KGIS / TNGIS / Bhuvan no
  owner/farmer information); the tiles must be served from a CORS-enabled host (see
  [`docs/cadastral-hosting.md`](docs/cadastral-hosting.md)).
- **Sub-survey / FMB sketch link** from a parcel popup, one tap copies the parcel's
  identifiers (survey number, village/mandal/district, GPS) and opens the state's
  official land-records portal (BhuNaksha AP / Bhu Bharati TG / Bhoomi KA) where the
  FMB sketch and sub-division ladder live. (None of the portals accepts URL prefill,
  so the copied details are re-entered there.)
- **Nearby civic services** from a pinned village, look up the closest hospitals and
  clinics, government offices, and police/post-office/fire stations, with distance and a
  maps link. Fetched on demand from **[OpenStreetMap](https://www.openstreetmap.org)**
  (rural coverage is uneven, so some villages legitimately return nothing).
- **Agromet weather** from a pinned village, current conditions plus a 7-day
  agricultural forecast (min/max °C, rainfall, rain probability), fetched on demand
  from the keyless **[Open-Meteo](https://open-meteo.com/)** API.
- **Live mandi prices** the day's APMC market quotes (commodity / variety, min–max
  and modal ₹/quintal, grouped by market) for the village's district, from the
  Government of India's **Agmarknet** feed. A daily workflow publishes compact
  per-state snapshots that the app fetches at runtime; a district switcher and
  commodity search cover the whole state.
- **Groundwater & soil overlays** optional map layers: **groundwater prospects**
  (Bhuvan/NRSC lithology–geomorphology, classified by well depth & yield) and
  **soil type** (ISRIC SoilGrids WRB class), togglable from the layers control.
- **Soil & fertilizer profile** from a pinned village, the point's soil type
  (WRB group + the Indian common name black cotton / red / alluvial plus
  texture), pH and organic carbon from the SoilGrids 250 m model, with the
  all-India balanced N-P-K guideline (4:2:1) and an indicative nutrient note
  (e.g. zinc-deficiency risk in alkaline soil) always labelled a model
  estimate to confirm with a Soil Health Card test.
- **Farmer schemes & farm inputs** the government schemes a farmer can apply
  for (the state's own + Central, from the national **myScheme** platform, with
  scheme names in all six UI languages and each entry linking to its
  how-to-apply page), refreshed weekly plus a quick reference of notified
  fertilizer prices (urea MRP, NBS-subsidised DAP) with links to the official
  fertilizer-stock and Soil Health Card portals.
- **Fresh data, automatically** refreshed from the Government of India's
  **Local Government Directory (LGD)** and proposed as a reviewed pull request,
  so nothing reaches the live site without passing tests and a review.
- **Five independent state apps** `andhra_pradesh/`, `telangana/`, `karnataka/`,
  `tamil_nadu/` and `kerala/` each stand on their own and can be hosted separately.

---

## How the project is organised

```
.
├── index.html               # landing page → links to all five state maps
├── andhra_pradesh/          # self-contained Andhra Pradesh deliverable
│   ├── data/                #   andhra_pradesh_villages.csv (one row per village)
│   └── web/                 #   the map app (index.html, app.js, i18n.js, nearby.js,
│       │                    #   weather.js, mandi.js, schemes.js, styles.css, config.js)
│       └── data/            #   regions, villages, meta, coords, names, names_translit,
│                            #   regions_native (.json) + districts/mandals (.geojson)
├── telangana/               # identical structure, for Telangana
├── karnataka/               # identical structure, for Karnataka (sub-districts = Taluks)
├── tamil_nadu/              # identical structure, for Tamil Nadu (sub-districts = Taluks)
├── kerala/                  # identical structure, for Kerala (Malayalam, sub-districts = Taluks)
├── tiles/                   # all-state boundary vector tiles (PMTiles; optional path)
├── docs/                    # API reference build (JSDoc + pdoc) + hosting notes
├── notes/                   # project knowledge vault (Obsidian-compatible Markdown:
│                            #   data-source dossiers, decision log, architecture maps)
├── scraper/                 # SHARED tooling one code path builds all states
│   ├── config.py            #   per-state registry: LGD code, language, cadastre/FMB,
│   │                        #   mandi feed URL, map overlays add a state HERE
│   ├── pipeline.py          #   LGD data → per-state village data (JSON + CSV) + web app
│   ├── lgd_datagov.py       #   fetches LGD data from the data.gov.in open-data API
│   ├── fetch_mandi_prices.py #  daily Agmarknet mandi-price snapshots (data.gov.in)
│   ├── fetch_farmer_schemes.py # weekly myScheme farmer-scheme snapshots (multilingual)
│   ├── build_boundaries.py  #   LGD polygons → simplified per-state map shapes
│   ├── build_boundary_tiles.py # all-state boundary polygons → tiles/boundaries.pmtiles
│   ├── build_parcels_index.py #  cadastral tiles → per-village parcel bbox/centroid index
│   ├── enrich_coords.py     #   best-effort precise village coordinates (GeoNames)
│   ├── enrich_native_names.py #  offline neural native names (IndicXlit; villages + regions)
│   ├── seed_osm_names.py    #   harvests human-verified native names from OpenStreetMap
│   ├── lgd_client.py        #   live LGD client, used to verify the dump
│   ├── changelog.py         #   writes the "what changed" summary for refresh PRs
│   ├── release_notes.py     #   release notes + version bump for the auto-release
│   ├── translit_cli.mjs     #   transliteration bridge so the CSV uses the UI engine
│   ├── translit_eval.mjs    #   scores transliteration vs LGD gold (CI guard)
│   ├── tests/               #   data-validity tests (run on every PR)
│   ├── web_template/        #   single source of truth for the UI (copied per state)
│   └── requirements*.txt    #   runtime · -dev (pytest) · -translit (offline IndicXlit)
└── .github/
    ├── actions/             # local composite actions steps shared by the workflows
    │   ├── setup-pipeline/  #   Python (+ optional Node) toolchain + dependency install
    │   ├── datagov-fetch/   #   run an upstream fetch with the exit-75 outage-skip contract
    │   ├── publish-data-branch/ # commit generated files to a data/* branch (no PR)
    │   └── overlay-data-branches/ # copy data/* branch contents over the working tree
    └── workflows/           # each workflow keeps only its unique logic
        ├── update-data.yml      #   weekly unified refresh (villages, mandi prices, farmer schemes, PR)
        ├── regenerate-native-names.yml # triggered by update-data.yml/on-demand neural names → PR
        ├── seed-osm-names.yml   #   monthly OSM native-name harvest → data/osm-names branch
        ├── build-parcels-index.yml #  rebuilds the village→parcel indexes → data/parcels-index branch
        ├── build-boundary-tiles.yml # monthly boundary vector tiles → data/boundary-tiles branch
        ├── mirror-cadastrals.yml #   mirrors the cadastral tiles to a CORS host (R2)
        ├── ci.yml               #   runs the data-validity tests on every PR
        ├── release.yml          #   publishes a versioned Release with downloadable data
        ├── publish-blog.yml     #   each Release → dev.to blog draft (+ Medium via legacy token)
        ├── docs.yml             #   build-checks the API reference on PRs
        └── deploy-pages.yml     #   publishes the site (main + data/* overlays) + API docs
```

The `scraper/` is shared on purpose: the logic is identical for every state and only
differs by an LGD state code (Andhra Pradesh = `28`, Telangana = `36`, Karnataka =
`29`, Tamil Nadu = `33`, Kerala = `32`). Everything a state needs to be hosted lives inside its own folder.

---

## Where the data comes from

| Layer                                | Source                                                                                                                                                         | Why it's trustworthy                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Districts, mandals, villages         | **LGD** (`lgdirectory.gov.in`), Ministry of Panchayati Raj                                                                                                     | The official Indian government registry of administrative areas. We read it directly from the **[data.gov.in](https://data.gov.in/) open-data API** (captcha-free, refreshed ~daily) no third-party mirror.                                                                                                                                                                  |
| Live cross-check                     | LGD's real-time portal                                                                                                                                         | Every build compares its district & mandal counts against the **live** LGD site, so stale data is caught. The result is saved in each `web/data/meta.json`.                                                                                                                                                                                                                  |
| Map shapes                           | [`ramSeraph/indian_admin_boundaries`](https://github.com/ramSeraph/indian_admin_boundaries)                                                                    | Current (2016/2022) LGD boundary polygons, joined to the village data by LGD code.                                                                                                                                                                                                                                                                                           |
| Pincodes                             | **LGD** `pincode_villages` mapping                                                                                                                             | Joined to villages by LGD village code (~99.9% coverage).                                                                                                                                                                                                                                                                                                                    |
| Native village names (authoritative) | **LGD** `Village Name (In Local)` column (when available)                                                                                                      | The state's _own official_ spelling, kept only when genuinely in the state's script. The current data.gov.in LGD feed doesn't include this column, so it contributes nothing today; the path stays first in priority for when a source that publishes it is wired in.                                                                                                        |
| Native names (neural)                | **AI4Bharat IndicXlit**, generated offline                                                                                                                     | A trained English→Indic model produces the native name for every village/region (`names_translit.json`, `regions_native.json`) — the primary source of native names today. Clearly _approximate_ but markedly better than the rule engine; measured against LGD gold via `enrich_native_names.py --eval`. Committed as plain JSON, so CI and the browser never load PyTorch. |
| Village coordinates                  | [GeoNames](https://www.geonames.org/) (name match, sub-district-validated)                                                                                     | Best-effort _approximate_ points; only kept when close to the village's mandal/taluk, so coverage is partial (~8–17%).                                                                                                                                                                                                                                                       |
| Nearby civic services                | [OpenStreetMap](https://www.openstreetmap.org/copyright) via [Overpass](https://overpass-api.de/)                                                              | Live, on-demand lookup of hospitals/offices/police near a pinned village (ODbL).                                                                                                                                                                                                                                                                                             |
| Land parcels (cadastre)              | APSAC (AP) / TRACGIS (TG) / KGIS (KA) / TNGIS (TN) / Bhuvan (KL), **CC0**, via [`ramSeraph/indian_cadastrals`](https://github.com/ramSeraph/indian_cadastrals) | Each state GIS agency's own survey-plot extract — the only open, vectorised, survey-numbered source (the agencies' live servers are token-gated).                                                                                                                                                                                                                            |
| Mandi (APMC) prices                  | **Agmarknet**, Ministry of Agriculture & Farmers Welfare, via the [data.gov.in](https://data.gov.in/) API                                                      | The government's own daily market-arrival price feed; snapshotted per state each day by `update-mandi-prices.yml` (prices are ₹/quintal; not every mandi reports every day).                                                                                                                                                                                                 |
| Farmer schemes                       | **[myScheme](https://www.myscheme.gov.in/)** (Digital India / NeGD)                                                                                            | The national scheme-discovery platform's own search API; the state's + Central "Agriculture, Rural & Environment" schemes, snapshotted weekly by `update-farmer-schemes.yml` with names in all six UI languages. Coverage varies by state — some state agriculture schemes aren't onboarded there yet.                                                                       |
| Fertilizer reference prices          | Dept. of Fertilizers notifications (curated)                                                                                                                   | No open live feed exists — iFMS/urvarak.nic.in drops connections and the Soil Health portal blocks automation — so the notified urea MRP / NBS-subsidised DAP price are curated in `config.FARM_INPUTS` per season, with links to the official portals for live stock.                                                                                                       |
| Weather forecast                     | [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)                                                                                                              | National-weather-model aggregator with an open, keyless, CORS-enabled API — fetched live by the browser, never stored.                                                                                                                                                                                                                                                       |
| Groundwater / soil overlays          | [Bhuvan](https://bhuvan.nrsc.gov.in) (NRSC/ISRO) · [ISRIC SoilGrids](https://soilgrids.org) (CC BY 4.0)                                                        | Bhuvan's RGNDWM groundwater-prospect maps (1:50K, classified by well depth/yield) and SoilGrids' WRB soil classes, rendered as standard WMS overlays straight from the source servers.                                                                                                                                                                                       |
| Soil profile (per village)           | [ISRIC SoilGrids](https://soilgrids.org) point API (CC BY 4.0)                                                                                                 | The 250 m global model queried live by the browser at the village point (WRB classification + topsoil clay/sand/pH/organic carbon); texture, pH class and the nutrient note are derived client-side by standard agronomic rules and clearly framed as indicative — a Soil Health Card test remains the reference.                                                            |

> ℹ️ Government data can lag recent changes. For example, the brand-new AP districts
> **Markapuram** and **Polavaram** appear in the lists and search but don't yet have
> published map boundaries. Always confirm anything official on the LGD portal.

---

## Run it yourself

You need **Python 3.10+**. Node is only needed if you rebuild map boundaries.

```bash
cd scraper
python3 -m venv .venv
./.venv/bin/pip install -r requirements-dev.txt

# 1) refresh village data for all states (fetches from the data.gov.in LGD API)
./.venv/bin/python pipeline.py

# 2) (occasionally) rebuild the map boundary shapes
./.venv/bin/python build_boundaries.py

# 3) run the data-validity tests
./.venv/bin/python -m pytest tests -v
```

> The data fetch uses the **[data.gov.in](https://data.gov.in/) LGD API**. Without a key
> it falls back to the public sample key, which caps pages at 10 rows — fine for a smoke
> test, not a full build. For real runs register a free key and export it:
> `export DATA_GOV_KEY=<your-key>` (in CI it's the `DATA_GOV_KEY` repo secret).

Handy flags: `--state ap|tg|ka|tn|kl|both`, `--offline` (reuse cached CSVs), `--no-verify`.

**Preview the website locally:**

```bash
# from the repository root
python3 -m http.server 8777
# open http://localhost:8777/
```

---

## How updates stay safe (the review flow)

Data is **never pushed straight to `main`.** Instead:

1. **`update-data.yml`** runs on a schedule **weekly** for village data, **monthly**
   for map boundaries (or on demand). Once complete, it directly invokes **`regenerate-native-names.yml`** to run neural transliterations and add them to the same PR. A transient data.gov.in outage is retried and,
   worst case, skipped cleanly rather than opening an empty/failed PR.
2. It rebuilds the data and runs the **test suite**.
3. It opens a **pull request** whose description is an auto-generated
   [summary of exactly what changed](scraper/changelog.py) (villages added / removed /
   reclassified, with before→after counts).
4. The PR must be **green** (tests pass the `data-validation` check) **and approved**
   by a code owner (and/or GitHub Copilot review) before it can merge.
5. Merging to `main` triggers **`deploy-pages.yml`**, which publishes the new data to
   the live site.

So the commit history doubles as an auditable, reviewed changelog of the data.

> **The deliberate exception regenerable artifacts live on `data/*` branches,
> not in `main`:** machine-regenerated outputs whose "review" would only ever be
> rubber-stamping are published straight to dedicated data branches by their
> workflows, and overlaid back in where they're consumed:
>
> | Branch                | Content                                               | Consumed by                                 |
> | --------------------- | ----------------------------------------------------- | ------------------------------------------- |
> | `data/mandi-prices`   | daily Agmarknet price snapshots                       | the app, at runtime (raw.githubusercontent) |
> | `data/farmer-schemes` | weekly myScheme farmer-scheme snapshots               | the app, at runtime (raw.githubusercontent) |
> | `data/boundary-tiles` | `tiles/boundaries.pmtiles` + `boundary_bounds.json`   | Pages deploys + release zips (overlay)      |
> | `data/parcels-index`  | per-state `parcels_index.json`, `village_points.json` | Pages deploys + release zips (overlay)      |
> | `data/osm-names`      | `scraper/osm_names.json` (OSM name seeds)             | pipeline runs, at build time (overlay)      |
>
> The **LGD village data itself** (and the neural native names, which the weekly
> pipeline prunes and the tests validate against it) stays on the reviewed-PR
> path above that's the dataset of record that feeds releases.

### Tests

[`scraper/tests/`](scraper/tests/) checks each state's data on every pull request:
internal consistency (every village → a real mandal → a real district), counts that
agree across files, unique codes, the live-LGD verification result, the CSV matching
the JSON, and that the map polygons are valid and join to the data. A failure blocks
the merge.

---

## Hosting (GitHub Pages)

The site is served by **GitHub Pages** via `deploy-pages.yml`. In
**Settings → Pages**, the source is set to **GitHub Actions**. Pushing to `main`
rebuilds and republishes automatically.

---

## Downloads (GitHub Releases)

Every time fresh data is merged, a **GitHub Release** is published with downloadable
artifacts (`.github/workflows/release.yml`):

- `<state>_villages.csv` flat village list per state (e.g. `karnataka_villages.csv`),
  including each village's **native-script name** (`Village (Native)`) the official LGD
  spelling where published, else transliteration with a `Native Source` column marking which.
- `<state>_data.zip` the full per-state dataset (JSON + boundary GeoJSON + CSV).
- `village_data_all.zip` everything, all states.

Grab the newest at **[Releases](https://github.com/mchittineni/india-village-finder/releases/latest)**.

Releases are **semantically versioned** (`vMAJOR.MINOR.PATCH`):

- **patch** a data refresh of existing states (automatic).
- **minor** a new state is added to the project (auto-detected).
- **major** only when explicitly requested (`Run workflow → bump: major`).

See **[`CHANGELOG.md`](CHANGELOG.md)** for what changed in each release.

---

## Roadmap

- [ ] **More states** the pipeline is state-code driven, so [adding one](CONTRIBUTING.md) is small.
- [ ] **Public read-only API** for village / pincode lookup.
- [ ] **Better coordinate coverage** for villages.
- [x] **Native-script names everywhere** authoritative LGD spellings where published, a
      neural model (IndicXlit) for the rest, covering villages _and_ districts/sub-districts/state.
- [ ] **Accessibility pass** keyboard, screen-reader and contrast.

Have an idea? [Open a feature request](https://github.com/mchittineni/india-village-finder/issues/new?template=feature_request.yml).

---

## Contributing & community

Contributions are welcome a **data correction** needs no coding, and code changes
are encouraged.

- 📖 **[Contributing guide](CONTRIBUTING.md)** dev setup, project layout and the PR flow.
- 🤝 **[Code of Conduct](CODE_OF_CONDUCT.md)** Contributor Covenant 2.1.
- 🔐 **[Security policy](SECURITY.md)** report a vulnerability privately.
- 🗒️ **[Changelog](CHANGELOG.md)** what changed in each release.
- 🐛 **[Open an issue](https://github.com/mchittineni/india-village-finder/issues/new/choose)** bug, feature or data correction.
- 📌 **[Good first issues](https://github.com/mchittineni/india-village-finder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** newcomer-friendly.

`main` is protected every change lands through a reviewed, tested pull request.

---

## Licence

This project is **dual-licensed**, because it combines original code with government
open data:

- **Code** (everything in `scraper/` and the web apps) **MIT License**, see
  [`LICENSE`](LICENSE).
- **Data** (all CSV / JSON / GeoJSON files and release artifacts) **Government Open
  Data License – India (GODL-India)**, see [`DATA_LICENSE.md`](DATA_LICENSE.md). If you
  reuse the data you must keep the attribution to the **Local Government Directory**
  (Ministry of Panchayati Raj, Government of India).

If you use this project in research or a product, please cite it see
[`CITATION.cff`](CITATION.cff).

---

## Acknowledgements

- **[Local Government Directory (LGD)](https://lgdirectory.gov.in)** Ministry of
  Panchayati Raj, Government of India the authoritative registry of administrative areas,
  read via the **[data.gov.in](https://data.gov.in/) open-data API**.
- **[Agmarknet](https://agmarknet.gov.in/)** Ministry of Agriculture & Farmers
  Welfare daily mandi (APMC market) prices, via the data.gov.in API.
- **[myScheme](https://www.myscheme.gov.in/)** Digital India / NeGD the national
  government-scheme discovery platform, source of the farmer-schemes panel.
- **[@ramSeraph](https://github.com/ramSeraph)** the
  [admin-boundary polygons](https://github.com/ramSeraph/indian_admin_boundaries) and
  [cadastral data](https://github.com/ramSeraph/indian_cadastrals) (APSAC / TRACGIS / TNGIS / Bhuvan /
  KGIS extracts) this project builds on.
- **[GeoNames](https://www.geonames.org/)** populated-place coordinates.
- **[OpenStreetMap](https://www.openstreetmap.org/copyright)** contributors (ODbL),
  queried via the [Overpass API](https://overpass-api.de/) for nearby civic services
  and native place names.
- **[Open-Meteo](https://open-meteo.com/)** (CC BY 4.0) village weather forecasts.
- **[Bhuvan](https://bhuvan.nrsc.gov.in)** (NRSC/ISRO) groundwater-prospect map
  overlay; **[ISRIC SoilGrids](https://soilgrids.org)** (CC BY 4.0) soil-class overlay.
- Built with **[Leaflet](https://leafletjs.com)**, **[MapLibre GL](https://maplibre.org)** +
  **[PMTiles](https://protomaps.com/docs/pmtiles)** (cadastre), **[CARTO](https://carto.com)**
  basemaps and **[Fuse.js](https://fusejs.io)**.

Provided for educational and research use.
