# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are published automatically by
[`release.yml`](.github/workflows/release.yml): a **data refresh** is a _patch_,
**adding a new state** is a _minor_, and a breaking change is a _major_. Every
release attaches downloadable datasets — see [Releases][releases].

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/mchittineni/india-village-finder/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mchittineni/india-village-finder/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/mchittineni/india-village-finder/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mchittineni/india-village-finder/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mchittineni/india-village-finder/releases/tag/v1.0.0
[releases]: https://github.com/mchittineni/india-village-finder/releases
