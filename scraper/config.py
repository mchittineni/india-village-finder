#!/usr/bin/env python3
"""
config.py — single source of truth for the per-state registry shared by every
tool in ``scraper/`` (pipeline, boundaries, parcels index, native names).

Adding a state means editing ONE dict here: give it its LGD state code, folder
slug, official language and UI accents (plus an optional ``cadastre`` block if a
survey-plot layer exists for it). Every script resolves paths and ``--state``
arguments from this registry, so there are no hardcoded state strings to hunt
down across the codebase.
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent  # scraper/
ROOT = HERE.parent  # repo root (parent of scraper/)

# One block per state, keyed by LGD state code. `slug` is the folder name.
# `division` is the local word for a sub-district (Mandal in AP/Telangana, Taluk
# in Karnataka/Tamil Nadu). `lang` is the state's official language: where an
# in-script village name is available it ships as an authoritative name.
STATES: dict[int, dict] = {
    28: {
        "name": "Andhra Pradesh",
        "slug": "andhra_pradesh",
        "lang": "te",
        "iso": "IN-AP",
        "accent": "#1f6feb",
        "accentSoft": "#eaf2ff",
        "division": "mandal",
        # Optional cadastral (survey-plot) vector layer. Presence of this block is
        # the feature flag: only states listed here render land parcels. The web
        # app streams tiles from `url` via HTTP range requests (PMTiles), so the
        # ~850 MB file is a hosting concern only, not a client download.
        # NOTE: the release URL below is a prototype fallback; move to a
        # range-request + CORS enabled host (e.g. Cloudflare R2) before launch.
        "cadastre": {
            "url": (
                "https://github.com/ramSeraph/indian_cadastrals/releases/"
                "download/andhra-pradesh/APSAC_AP_Cadastrals.pmtiles"
            ),
            "sourceLayer": "APSAC_AP_Cadastrals",  # vector layer id inside the PMTiles
            "minZoom": 11,  # Leaflet zoom at which parcels appear (low enough that a
            # whole mandal fits in view, so a selected village's parcels can be
            # located and fitted even when the village has no point coordinate).
            # NB: maplibre-gl-leaflet renders one zoom behind Leaflet, so the GL
            # layer minzoom is minZoom-1 (handled in app.js initCadastre).
            "tileMaxZoom": 13,  # PMTiles maxzoom (overzoomed above this)
            "attribution": (
                'Cadastre &copy; <a href="https://apsac.ap.gov.in/" target="_blank" '
                'rel="noopener">APSAC</a> (CC0) via '
                '<a href="https://github.com/ramSeraph/indian_cadastrals" target="_blank" '
                'rel="noopener">datameet/ramSeraph</a>'
            ),
        },
    },
    36: {
        "name": "Telangana",
        "slug": "telangana",
        "lang": "te",
        "iso": "IN-TG",
        "accent": "#0f9d58",
        "accentSoft": "#e3f6ec",
        "division": "mandal",
    },
    29: {
        "name": "Karnataka",
        "slug": "karnataka",
        "lang": "kn",
        "iso": "IN-KA",
        "accent": "#d97706",
        "accentSoft": "#fdeccf",
        "division": "taluk",
    },
    33: {
        "name": "Tamil Nadu",
        "slug": "tamil_nadu",
        "lang": "ta",
        "iso": "IN-TN",
        "accent": "#dc2626",
        "accentSoft": "#fdeaea",
        "division": "taluk",
    },
}

# Friendly aliases → LGD code, accepted by every script's --state flag.
ALIAS: dict[str, int] = {
    "ap": 28,
    "andhra_pradesh": 28,
    "andhra": 28,
    "tg": 36,
    "ts": 36,
    "telangana": 36,
    "ka": 29,
    "kar": 29,
    "karnataka": 29,
    "tn": 33,
    "tamil_nadu": 33,
    "tamilnadu": 33,
    "tamil": 33,
}

# Convenience lookups derived from the registry (never hand-maintained).
SLUG_BY_CODE: dict[int, str] = {code: s["slug"] for code, s in STATES.items()}
CODE_BY_SLUG: dict[str, int] = {s["slug"]: code for code, s in STATES.items()}
LANG_BY_SLUG: dict[str, str] = {s["slug"]: s["lang"] for s in STATES.values()}


def resolve_codes(arg: str) -> list[int]:
    """Map a --state argument to a list of LGD codes.

    Accepts ``all`` / ``both`` (every state), or any alias/slug in ``ALIAS``.
    Raises ValueError on an unknown value so callers fail loudly.
    """
    if arg in ("all", "both"):
        return list(STATES)
    key = arg.strip().lower()
    if key in ALIAS:
        return [ALIAS[key]]
    raise ValueError(f"unknown --state {arg!r}; try one of: all, {', '.join(sorted(ALIAS))}")


# --------------------------------------------------------------------------- #
# Native-name seeds — human-verified names that beat the neural transliterator.
# Both files are optional and keyed {lang: {english_name_lower: native}}:
#   translit_overrides.json — hand-curated corrections (highest priority)
#   osm_names.json          — crowd-sourced from OpenStreetMap name:<lang> tags
#                             (generated by scraper/seed_osm_names.py)
# --------------------------------------------------------------------------- #
OVERRIDES_FILE = HERE / "translit_overrides.json"
OSM_NAMES_FILE = HERE / "osm_names.json"


def _load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def load_name_seeds(lang: str) -> dict[str, str]:
    """Return {english_name_lower: native} for ``lang`` — OSM names overlaid by the
    manual overrides (overrides win). Empty when neither file has entries."""
    seeds: dict[str, str] = {}
    for src in (OSM_NAMES_FILE, OVERRIDES_FILE):  # overrides applied last → win
        for en, native in (_load_json(src).get(lang) or {}).items():
            if native:
                seeds[en.strip().lower()] = native
    return seeds
