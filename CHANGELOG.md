# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are published automatically by
[`release.yml`](.github/workflows/release.yml): a **data refresh** is a _patch_,
**adding a new state** is a _minor_, and a breaking change is a _major_. Every
release attaches downloadable datasets — see [Releases][releases].

## [Unreleased]

### Added

- **Agromet weather panel** — from a pinned village, current conditions plus a 7-day
  agricultural forecast (min/max °C, rainfall, rain probability) via the keyless,
  CORS-enabled [Open-Meteo](https://open-meteo.com/) API (`web/weather.js`), localised
  in all six UI languages.
- **Live mandi (APMC) prices** — the day's market quotes for the village's district
  (commodity/variety, min–max and modal ₹/quintal, grouped by market, with district
  switcher and commodity search). `scraper/fetch_mandi_prices.py` +
  `update-mandi-prices.yml` snapshot the Agmarknet data.gov.in feed daily to the
  `data/mandi-prices` branch; the app (`web/mandi.js`) fetches it at runtime and
  fuzzy-matches LGD district names to Agmarknet's spellings.
- **Sub-survey / FMB sketch link** — the cadastral parcel popup can copy the parcel's
  identifiers and open the state's land-records portal (BhuNaksha AP / Bhu Bharati TG /
  Bhoomi KA, configured per state via `cadastre.fmb`). None of the portals accepts URL
  prefill, so the copied details are re-entered there.
- **Groundwater & soil map overlays** — a Leaflet layers control with Bhuvan's RGNDWM
  groundwater-prospect WMS (all four states) and ISRIC SoilGrids' WRB soil-class WMS,
  defined once in `config.MAP_OVERLAYS`. (CGWB/India-WRIS was evaluated and skipped —
  its GIS stack is currently unreachable.)

### Changed

- Documentation brought current across the board: refreshed stats, the data.gov.in-era
  data-source tables, AP/TG/KA cadastre coverage, the new workflows, and a
  "live third-party layers" licensing section in `DATA_LICENSE.md`.

## [1.2.9] — 2026-07-10

### Added

- **Parcel GPS coordinates in the popup** — a cadastral parcel popup now shows the
  clicked point's coordinates with copy and open-in-Google-Maps actions.

### Fixed

- **The daily data refresh was silently broken since the data.gov.in migration** —
  three stacked issues resolved:
  - api.data.gov.in's WAF answers HTTP 502 to python-requests' default User-Agent;
    the fetch now identifies itself with a project-specific User-Agent.
  - `create-pull-request`'s `add-paths` wildcards are git pathspecs (no shell-style
    directory expansion) and matched **zero files**, so refreshed data was committed
    nowhere and no PR appeared while the workflow stayed green; now `**`-suffixed.
  - The offline native-name sidecars (`names_translit.json`, `regions_native.json`)
    go stale when LGD renumbers villages/mandals; the pipeline now prunes them
    against each run's fresh codes.
- `build-parcels-index.yml` detected changes with `git diff`, which is silent for
  untracked first-run outputs; switched to `git status --porcelain`.

### Changed

- **Village counts rebased** by the first LGD refresh served from the data.gov.in
  feed (AP 14,715 · TG 10,983 · KA 26,753 · TN 15,833 villages).

## [1.2.8] — 2026-07-05

### Added

- **Telangana & Karnataka land parcels** — cadastral survey plots for two more
  states: TRACGIS Bhunaksha (TG) and KGIS (KA) extracts (**CC0**, via
  `ramSeraph/indian_cadastrals`), mirrored to R2 alongside AP's. KGIS tiles carry no
  place names, so KA highlights a village's parcels by LGD village code.

### Changed

- Neural native names regenerated (IndicXlit) and boundary vector tiles rebuilt on the
  refreshed data.

## [1.2.7] — 2026-07-02

### Added

- **All-state boundary vector tiles** — `build_boundary_tiles.py` tiles every state's
  district/mandal polygons into one PMTiles archive (`tiles/boundaries.pmtiles`) so
  the app can stream shapes per view instead of downloading whole GeoJSON files.
  Off by default (`config.BOUNDARY_TILES["enabled"]`), testable live with `?bt=1`,
  rebuilt monthly in CI.
- **Human-verified native-name seeds** — a shared per-state registry
  (`scraper/config.py`) plus OpenStreetMap name harvesting (`seed_osm_names.py`) and
  manual `translit_overrides.json`; both are preferred over the neural model, so
  committed OSM names upgrade the map/CSV with no PyTorch.

### Changed

- **Data refresh parallelised** — one isolated CI job per state feeding a single
  aggregate reviewed PR, so a failure in one state doesn't block the others.
- Overpass queries now identify the project and honour rate limits.

### Fixed

- Telangana's ISO code (`IN-TS`) in the OSM harvest, and untracked-file change
  detection in the OSM-seed workflow.
- CI hardening: workflow input binding, SHA-pinned actions, `names.json`
  preservation, a CSV guard and fetcher tests.

## [1.2.6] — 2026-07-01

### Added

- **Land parcels (Andhra Pradesh)** — an optional cadastral layer of individual
  survey plots (APSAC, **CC0**), streamed from a PMTiles archive on R2: map toggle,
  per-village parcel selection with a searchable survey-number list, a precomputed
  village→parcel index for precise jumps, and a village coordinate derived from its
  parcels (lifting precise-location coverage). Includes hosting docs and an
  auto-tracking R2 mirror workflow.
- **Whole-project API reference** — JSDoc (web app) + pdoc (pipeline) published to
  GitHub Pages under `/docs/api/` and build-checked on PRs.

### Changed

- **LGD data now comes straight from the official data.gov.in open-data API** — the
  ramSeraph LGD mirror (and its captcha-OCR hop) is removed entirely. A transient
  data.gov.in outage skips the run cleanly (exit 75) instead of failing it.
- Prettier + Black formatting applied project-wide; CI supply-chain hardened
  (SHA-pinned actions, scraper extraction guards, CDN subresource integrity).

## [1.2.5] — 2026-06-28

### Changed

- Neural native names regenerated (IndicXlit) across all four states.

## [1.2.4] — 2026-06-28

### Added

- **Native district, sub-district and state names** — when the state's own language is
  selected, district/taluk/mandal names and the state name now render in native script
  (`web/data/regions_native.json`) instead of going through the rule engine. LGD has no
  local-script column for these, so each is resolved from a same-named village's native
  name where one exists, otherwise IndicXlit (`enrich_native_names.py --regions`). The
  map falls back to the rule engine for anything not yet covered.

## [1.2.3] — 2026-06-28

### Added

- **Neural native village names (AI4Bharat IndicXlit)** — every village now carries a
  native-script name. Where LGD doesn't publish one in-script, it is supplied by a
  trained neural transliteration model instead of the rule engine, shipped as
  `web/data/names_translit.json` (Andhra Pradesh 17,585, Telangana 82, Karnataka
  30,711, Tamil Nadu 17,165 names — **100% village coverage** in each state). The map
  and the CSV resolve a name as **authoritative LGD → neural → rule-based**.

  Measured against LGD's own gold spellings, character accuracy / exact-match jumps
  well past the rule engine:

  | State               | rule engine   | **neural**        |
  | ------------------- | ------------- | ----------------- |
  | Andhra Pradesh (te) | 76.1% / 11.4% | **88.4% / 43.3%** |
  | Karnataka (kn)      | 82.5% / 16.9% | **91.3% / 47.5%** |
  | Tamil Nadu (ta)     | 69.3% / 3.4%  | **81.8% / 21.6%** |

  The model is produced offline by a new tool, `scraper/enrich_native_names.py`, whose
  output is committed; the heavy dependency lives in `scraper/requirements-translit.txt`
  and is read as plain JSON at build time, so CI, the daily pipeline and the browser
  never load PyTorch. `--eval` scores the model against the authoritative names (an
  independent gold), complementing the rule-engine guard in `translit_eval.mjs`.

## [1.2.2] — 2026-06-26

### Fixed

- Transliteration: a doubled nasal (`nn`/`mm`) now geminates (న్న / మ్మ) instead of
  becoming an anusvara + consonant (Dimma → దిమ్మ, Chennai → చెన్నై).

## [1.2.1] — 2026-06-26

### Changed

- **Morpheme-aware transliteration** — the engine now renders common place-name
  suffixes (`-pur`, `-palli`, `-puram`, `-gaon`, `-pettai`, …) from their canonical
  spelling and nasalises stem-final `n`/`m` before them, rather than going letter-by-
  letter. Measured against LGD's official names, exact-match roughly doubles and
  character accuracy rises a few points per state. A new `scraper/translit_eval.mjs`
  reports the metric and guards it in CI.
- **Native name in every CSV row** — the `<state>_villages.csv` exports now fill
  `Village (Native)` for every village (the authoritative LGD spelling where
  published, otherwise transliteration in the state's script), with a `Native
Source` column recording which. Generated via the shared UI engine
  (`scraper/translit_cli.mjs`), so the CSV and the map agree.

## [1.2.0] — 2026-06-26

### Added

- **Tamil Nadu** (LGD state `33`) — 38 districts, 317 taluks and 18,681 villages,
  with pincodes, district/taluk boundary maps and best-effort village coordinates.
- **Tamil (தமிழ்)** added to the language selector, with Tamil-script
  transliteration of place names.
- **Authoritative native village names** — where LGD publishes a village's name in
  the state's own script (`Village Name (In Local)`), it is shipped as `names.json`
  and shown instead of transliteration when that language is selected. Script-
  validated, so Latin/blank entries are dropped (Telangana ~99%, Tamil Nadu/AP
  partial, Karnataka falls back to transliteration).
- **Nearby civic services** — from a pinned village, an on-demand OpenStreetMap
  (Overpass) lookup of nearby hospitals, government offices and police/post/fire.
- **Home navigation** — the brand/◴ icon now links back to the landing page.

## [1.1.0] — 2026-06-26

### Added

- **Karnataka** (LGD state `29`) — 31 districts, 240 taluks and 30,771 villages,
  with pincodes, district/taluk boundary maps and best-effort village coordinates.
- Per-state sub-district term: Karnataka shows **Taluk**, Andhra Pradesh and
  Telangana keep **Mandal** (wired through `config.division` + i18n).
- **Kannada (ಕನ್ನಡ)** added to the language selector, with Kannada-script
  transliteration of place names.

### Fixed

- Transliteration: a word-initial `n`/`m` no longer produces an invalid leading
  anusvara (e.g. "Mysuru").

## [1.0.2] — 2026-06-26

### Added

- **Multilingual UI** — English, Telugu, Hindi and Urdu (Urdu right-to-left),
  with best-effort transliteration of place names; the canonical English name is
  kept for hover and search.
- **Pull-request auto-labeller** — labels PRs by the paths they change.

### Changed

- Districts and mandals are now listed **A → Z** (previously by village count).
- Map zoom controls moved to the **top-right** so they clear the sidebar toggle.

## [1.0.1] — 2026-06-26

### Added

- **Pincodes** for ~99.9% of villages (from LGD `pincode_villages`) — shown in
  lists and pins, and searchable.
- **Best-effort village coordinates** (~16%) matched via GeoNames and validated
  against the village's mandal; unmatched villages pin at mandal level.
- Individual villages are now **clickable** on the map.

## [1.0.0] — 2026-06-26

### Added

- Initial release: interactive village maps + search for **Andhra Pradesh** and
  **Telangana**, organised by District → Mandal → Village.
- Data pipeline that builds each state from the **Local Government Directory
  (LGD)**, cross-checks counts against the live portal, and proposes refreshes as
  reviewed pull requests.
- Dual licensing — **MIT** for code, **GODL-India** for data.
- Automated, semantically-versioned GitHub Releases with downloadable datasets.
- Community-health files: Contributing guide, Code of Conduct, Security policy,
  and issue / pull-request templates.

[Unreleased]: https://github.com/mchittineni/india-village-finder/compare/v1.2.9...HEAD
[1.2.9]: https://github.com/mchittineni/india-village-finder/compare/v1.2.8...v1.2.9
[1.2.8]: https://github.com/mchittineni/india-village-finder/compare/v1.2.7...v1.2.8
[1.2.7]: https://github.com/mchittineni/india-village-finder/compare/v1.2.6...v1.2.7
[1.2.6]: https://github.com/mchittineni/india-village-finder/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/mchittineni/india-village-finder/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/mchittineni/india-village-finder/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/mchittineni/india-village-finder/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/mchittineni/india-village-finder/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/mchittineni/india-village-finder/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/mchittineni/india-village-finder/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mchittineni/india-village-finder/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/mchittineni/india-village-finder/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mchittineni/india-village-finder/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mchittineni/india-village-finder/releases/tag/v1.0.0
[releases]: https://github.com/mchittineni/india-village-finder/releases
