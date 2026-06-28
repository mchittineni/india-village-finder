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
- **Native district, sub-district and state names** — when the state's own language is
  selected, district/taluk/mandal names and the state name now render in native script
  (`web/data/regions_native.json`) instead of going through the rule engine. LGD has no
  local-script column for these, so each is resolved from a same-named village's native
  name where one exists, otherwise IndicXlit (`enrich_native_names.py --regions`). The
  map falls back to the rule engine for anything not yet covered.
- **Neural native village names (AI4Bharat IndicXlit)** — every village now carries a
  native-script name. Where LGD doesn't publish one in-script, it is supplied by a
  trained neural transliteration model instead of the rule engine, shipped as
  `web/data/names_translit.json` (Andhra Pradesh 17,585, Telangana 82, Karnataka
  30,711, Tamil Nadu 17,165 names — **100% village coverage** in each state). The map
  and the CSV resolve a name as **authoritative LGD → neural → rule-based**.

  Measured against LGD's own gold spellings, character accuracy / exact-match jumps
  well past the rule engine:

  | State | rule engine | **neural** |
  |---|---|---|
  | Andhra Pradesh (te) | 76.1% / 11.4% | **88.4% / 43.3%** |
  | Karnataka (kn) | 82.5% / 16.9% | **91.3% / 47.5%** |
  | Tamil Nadu (ta) | 69.3% / 3.4% | **81.8% / 21.6%** |

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

[Unreleased]: https://github.com/mchittineni/india-village-finder/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/mchittineni/india-village-finder/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/mchittineni/india-village-finder/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/mchittineni/india-village-finder/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mchittineni/india-village-finder/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/mchittineni/india-village-finder/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mchittineni/india-village-finder/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mchittineni/india-village-finder/releases/tag/v1.0.0
[releases]: https://github.com/mchittineni/india-village-finder/releases
