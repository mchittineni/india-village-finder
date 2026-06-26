# 🗺️ Village Finder — Andhra Pradesh, Telangana & Karnataka

[![Build](https://github.com/mchittineni/india-village-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/mchittineni/india-village-finder/actions/workflows/ci.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Data: GODL-India](https://img.shields.io/badge/data-GODL--India-orange.svg)](DATA_LICENSE.md)
[![Latest release](https://img.shields.io/github/v/release/mchittineni/india-village-finder?sort=semver&color=blueviolet)](https://github.com/mchittineni/india-village-finder/releases/latest)
[![Stars](https://img.shields.io/github/stars/mchittineni/india-village-finder?style=flat&logo=github)](https://github.com/mchittineni/india-village-finder/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Issues welcome](https://img.shields.io/badge/issues-welcome-brightgreen.svg)](https://github.com/mchittineni/india-village-finder/issues/new/choose)

Find **any village** in Andhra Pradesh, Telangana or Karnataka on an interactive map,
organised by the official **District → Mandal/Taluk → Village** hierarchy — and keep
that data fresh automatically.

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

* 🇮🇳 States
* 🏙️ Districts
* 🏡 Mandals / Taluks / Tehsils
* 🌾 Villages
* 📮 PIN Codes

The project is designed for developers, researchers, government services, logistics
platforms, and citizens who need quick and accurate location information through a
modern web interface or API.

> **This release** delivers interactive village maps + search for **Andhra Pradesh**,
> **Telangana** and **Karnataka** (District → Mandal/Taluk → Village). More states and a
> public API are on the roadmap.

|  | Andhra Pradesh | Telangana | Karnataka |
|---|---:|---:|---:|
| Districts | 28 | 33 | 31 |
| Mandals / Taluks | 688 | 621 | 240 |
| **Villages** | **17,957** | **11,308** | **30,771** |

*(Counts come from the latest LGD dump; the automated pipeline keeps them current.
Karnataka's sub-districts are **Taluks**; AP/Telangana's are **Mandals**.)*

---

## What you get

- **A visual map** for each state — districts shaded by how many villages they
  contain (a *choropleth*). Click a district to zoom into its mandals; click a
  mandal to list its villages; click a village to pin it.
- **Instant search** across every village, mandal and district — or by **pincode**.
- **Multilingual UI** — switch the interface between **English, Telugu, Kannada, Hindi
  and Urdu** (Urdu right-to-left). Place names are also rendered in the chosen script
  via best-effort transliteration (approximate; the canonical English name is always
  kept on hover and used for search).
- **Districts, mandals and villages listed A → Z** for predictable scanning.
- **Pincodes** for ~99.9% of villages (from LGD), shown in lists, search and pins.
- **Village locations** where we can confidently place them (matched via GeoNames and
  validated against the village's sub-district; coverage varies by state, ~8–17%); the
  rest pin at sub-district (mandal/taluk) level.
- **Fresh data, automatically** — refreshed from the Government of India's
  **Local Government Directory (LGD)** and proposed as a reviewed pull request,
  so nothing reaches the live site without passing tests and a review.
- **Three independent state apps** — `andhra_pradesh/`, `telangana/` and `karnataka/`
  each stand on their own and can be hosted separately.

---

## How the project is organised

```
.
├── index.html               # landing page → links to all three state maps
├── andhra_pradesh/          # self-contained Andhra Pradesh deliverable
│   ├── data/                #   andhra_pradesh_villages.csv (one row per village)
│   └── web/                 #   the map app (index.html, app.js, i18n.js, styles.css, config.js)
│       └── data/            #   regions.json, villages.json, meta.json, *.geojson
├── telangana/               # identical structure, for Telangana
├── karnataka/               # identical structure, for Karnataka (sub-districts = Taluks)
├── scraper/                 # SHARED tooling — one code path builds all states
│   ├── pipeline.py          #   LGD dump → per-state village data (JSON + CSV)
│   ├── build_boundaries.py  #   LGD polygons → simplified per-state map shapes
│   ├── lgd_client.py        #   live LGD client, used to verify the dump
│   ├── changelog.py         #   writes the "what changed" summary for refresh PRs
│   ├── tests/               #   data-validity tests (run on every PR)
│   ├── web_template/        #   single source of truth for the UI (copied per state)
│   └── requirements*.txt
└── .github/workflows/
    ├── update-data.yml      #   weekly/monthly refresh → opens a reviewed PR
    ├── ci.yml               #   runs the data-validity tests on every PR
    └── deploy-pages.yml     #   publishes the site to GitHub Pages
```

The `scraper/` is shared on purpose: the logic is identical for every state and only
differs by an LGD state code (Andhra Pradesh = `28`, Telangana = `36`, Karnataka =
`29`). Everything a state needs to be hosted lives inside its own folder.

---

## Where the data comes from

| Layer | Source | Why it's trustworthy |
|---|---|---|
| Districts, mandals, villages | **LGD** (`lgdirectory.gov.in`), Ministry of Panchayati Raj | The official Indian government registry of administrative areas. We read it from a **captcha-free [daily mirror](https://github.com/ramSeraph/opendata)** of the LGD dump. |
| Live cross-check | LGD's real-time portal | Every build compares its district & mandal counts against the **live** LGD site, so a stale mirror is caught. The result is saved in each `web/data/meta.json`. |
| Map shapes | [`ramSeraph/indian_admin_boundaries`](https://github.com/ramSeraph/indian_admin_boundaries) | Current (2016/2022) LGD boundary polygons, joined to the village data by LGD code. |
| Pincodes | **LGD** `pincode_villages` mapping | Joined to villages by LGD village code (~99.9% coverage). |
| Village coordinates | [GeoNames](https://www.geonames.org/) (name match, sub-district-validated) | Best-effort *approximate* points; only kept when close to the village's mandal/taluk, so coverage is partial (~8–17%). |

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

# 1) refresh village data for all states (auto-detects the latest LGD dump)
./.venv/bin/python pipeline.py

# 2) (occasionally) rebuild the map boundary shapes
./.venv/bin/python build_boundaries.py

# 3) run the data-validity tests
./.venv/bin/python -m pytest tests -v
```

Handy flags: `--state ap|tg|ka|both`, `--offline` (reuse downloads), `--no-verify`.

**Preview the website locally:**

```bash
# from the repository root
python3 -m http.server 8777
# open http://localhost:8777/
```

---

## How updates stay safe (the review flow)

Data is **never pushed straight to `main`.** Instead:

1. **`update-data.yml`** runs on a schedule — **weekly** for village data, **monthly**
   for map boundaries (or on demand).
2. It rebuilds the data and runs the **test suite**.
3. It opens a **pull request** whose description is an auto-generated
   [summary of exactly what changed](scraper/changelog.py) (villages added / removed /
   reclassified, with before→after counts).
4. The PR must be **green** (tests pass — the `data-validation` check) **and approved**
   by a code owner (and/or GitHub Copilot review) before it can merge.
5. Merging to `main` triggers **`deploy-pages.yml`**, which publishes the new data to
   the live site.

So the commit history doubles as an auditable, reviewed changelog of the data.

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

- `<state>_villages.csv` — flat village list per state (e.g. `karnataka_villages.csv`).
- `<state>_data.zip` — the full per-state dataset (JSON + boundary GeoJSON + CSV).
- `village_data_all.zip` — everything, all states.

Grab the newest at **[Releases](https://github.com/mchittineni/india-village-finder/releases/latest)**.

Releases are **semantically versioned** (`vMAJOR.MINOR.PATCH`):

- **patch** — a data refresh of existing states (automatic).
- **minor** — a new state is added to the project (auto-detected).
- **major** — only when explicitly requested (`Run workflow → bump: major`).

See **[`CHANGELOG.md`](CHANGELOG.md)** for what changed in each release.

---

## Roadmap

- [ ] **More states** — the pipeline is state-code driven, so [adding one](CONTRIBUTING.md) is small.
- [ ] **Public read-only API** for village / pincode lookup.
- [ ] **Better coordinate coverage** for villages.
- [ ] **Native-script place names** from authoritative sources (beyond transliteration).
- [ ] **Accessibility pass** — keyboard, screen-reader and contrast.

Have an idea? [Open a feature request](https://github.com/mchittineni/india-village-finder/issues/new?template=feature_request.yml).

---

## Contributing & community

Contributions are welcome — a **data correction** needs no coding, and code changes
are encouraged.

- 📖 **[Contributing guide](CONTRIBUTING.md)** — dev setup, project layout and the PR flow.
- 🤝 **[Code of Conduct](CODE_OF_CONDUCT.md)** — Contributor Covenant 2.1.
- 🔐 **[Security policy](SECURITY.md)** — report a vulnerability privately.
- 🗒️ **[Changelog](CHANGELOG.md)** — what changed in each release.
- 🐛 **[Open an issue](https://github.com/mchittineni/india-village-finder/issues/new/choose)** — bug, feature or data correction.
- 📌 **[Good first issues](https://github.com/mchittineni/india-village-finder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** — newcomer-friendly.

`main` is protected — every change lands through a reviewed, tested pull request.

---

## Licence

This project is **dual-licensed**, because it combines original code with government
open data:

- **Code** (everything in `scraper/` and the web apps) — **MIT License**, see
  [`LICENSE`](LICENSE).
- **Data** (all CSV / JSON / GeoJSON files and release artifacts) — **Government Open
  Data License – India (GODL-India)**, see [`DATA_LICENSE.md`](DATA_LICENSE.md). If you
  reuse the data you must keep the attribution to the **Local Government Directory**
  (Ministry of Panchayati Raj, Government of India).

If you use this project in research or a product, please cite it — see
[`CITATION.cff`](CITATION.cff).

---

## Acknowledgements

- **[Local Government Directory (LGD)](https://lgdirectory.gov.in)** — Ministry of
  Panchayati Raj, Government of India — the authoritative registry of administrative areas.
- **[@ramSeraph](https://github.com/ramSeraph)** — the captcha-free
  [LGD mirror](https://github.com/ramSeraph/opendata) and the
  [admin-boundary polygons](https://github.com/ramSeraph/indian_admin_boundaries) this
  project builds on.
- **[GeoNames](https://www.geonames.org/)** — populated-place coordinates.
- Built with **[Leaflet](https://leafletjs.com)**, **[CARTO](https://carto.com)**
  basemaps and **[Fuse.js](https://fusejs.io)**.

Provided for educational and research use.
