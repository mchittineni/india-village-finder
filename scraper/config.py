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
        # Hosted on Cloudflare R2 (zero egress, honours HTTP Range + CORS for the
        # GitHub Pages origin). The file is auto-mirrored from the upstream
        # ramSeraph release by .github/workflows/mirror-cadastrals.yml.
        "cadastre": {
            "url": (
                "https://pub-f9d4d8c3e04d4318832ab39d095575b6.r2.dev/" "APSAC_AP_Cadastrals.pmtiles"
            ),
            "sourceLayer": "APSAC_AP_Cadastrals",  # vector layer id inside the PMTiles
            "minZoom": 11,  # Leaflet zoom at which parcels appear (low enough that a
            # whole mandal fits in view, so a selected village's parcels can be
            # located and fitted even when the village has no point coordinate).
            # NB: maplibre-gl-leaflet renders one zoom behind Leaflet, so the GL
            # layer minzoom is minZoom-1 (handled in app.js initCadastre).
            "tileMaxZoom": 13,  # PMTiles maxzoom (overzoomed above this)
            # Tile property keys the web app reads (APSAC schema). Each source
            # agency names its fields differently, so every cadastre block maps
            # its own keys onto these canonical roles. `village` names the parcel
            # village-name field (used to highlight a selected village by name);
            # states whose tiles carry no place name set `villageCode` instead
            # (highlight by LGD code) and omit village/mandal/district.
            "fields": {
                "survey": "parcel_num",
                "village": "v_name",
                "mandal": "m_name",
                "district": "d_name",
                "area": "shape_area",
                "id": ["objectid", "objectid_1"],
            },
            "attribution": (
                'Cadastre &copy; <a href="https://apsac.ap.gov.in/" target="_blank" '
                'rel="noopener">APSAC</a> (CC0) via '
                '<a href="https://github.com/ramSeraph/indian_cadastrals" target="_blank" '
                'rel="noopener">datameet/ramSeraph</a>'
            ),
            # Official FMB / sub-survey viewer (no URL prefill supported —
            # the app copies the parcel identifiers and opens this page).
            "fmb": {
                "name": "BhuNaksha AP",
                "url": "https://bhunaksha.ap.gov.in/bhunaksha/fmb/index.jsp",
            },
        },
    },
    36: {
        "name": "Telangana",
        "slug": "telangana",
        "lang": "te",
        # ISO 3166-2 renamed Telangana IN-TG -> IN-TS (2023); OSM uses IN-TS.
        "iso": "IN-TS",
        "accent": "#0f9d58",
        "accentSoft": "#e3f6ec",
        "division": "mandal",
        # Cadastral parcels — Telangana TRACGIS Bhunaksha extract (CC0) via
        # ramSeraph, mirrored to R2 (mirror-cadastrals.yml). Same field layout as
        # APSAC but TitleCase keys; villages carry names, so the app highlights a
        # selected village's parcels by name like AP.
        "cadastre": {
            "url": (
                "https://pub-f9d4d8c3e04d4318832ab39d095575b6.r2.dev/"
                "TRACGIS_Bhunaksha_Cadastrals.pmtiles"
            ),
            "sourceLayer": "TRACGIS_Bhunaksha_Cadastrals",
            "minZoom": 11,
            "tileMaxZoom": 13,
            "fields": {
                "survey": "Parcel_num",
                "village": "V_Name",
                "mandal": "M_Name",
                "district": "D_Name",
                "area": "Shape_Area",
                "id": ["OBJECTID", "OBJECTID_12", "OBJECTID_1"],
            },
            "attribution": (
                "Cadastre &copy; TRACGIS (Telangana Bhunaksha, CC0) via "
                '<a href="https://github.com/ramSeraph/indian_cadastrals" '
                'target="_blank" rel="noopener">datameet/ramSeraph</a>'
            ),
            # Bhu Bharati (Dharani's successor) cadastral viewer; TG publishes
            # no public FMB sketches — survey-boundary view is the closest.
            "fmb": {
                "name": "Bhu Bharati",
                "url": "https://bhubharati.telangana.gov.in/gis/",
            },
        },
    },
    29: {
        "name": "Karnataka",
        "slug": "karnataka",
        "lang": "kn",
        "iso": "IN-KA",
        "accent": "#d97706",
        "accentSoft": "#fdeccf",
        "division": "taluk",
        # Cadastral parcels — Karnataka KGIS extract (CC0) via ramSeraph, mirrored
        # to R2. KGIS tiles carry no place names (only codes), but include the LGD
        # village code — so the app highlights a village's parcels by code
        # (fields.villageCode) instead of by name, and popups show just the
        # survey number.
        "cadastre": {
            "url": (
                "https://pub-f9d4d8c3e04d4318832ab39d095575b6.r2.dev/"
                "KGISMAPS_KN_Cadastrals.pmtiles"
            ),
            "sourceLayer": "KGISMAPS_KN_Cadastrals",
            "minZoom": 11,
            "tileMaxZoom": 13,
            "fields": {
                "survey": "Surveynumber_Old",
                "villageCode": "LGD_VillageCode",
                "area": "SHAPE.STArea()",
                "id": ["OBJECTID", "KGISCadastralID"],
            },
            "attribution": (
                "Cadastre &copy; KGIS (Karnataka, CC0) via "
                '<a href="https://github.com/ramSeraph/indian_cadastrals" '
                'target="_blank" rel="noopener">datameet/ramSeraph</a>'
            ),
            # Bhoomi "view survey documents" (Tippan/FMB; OTP login, no prefill).
            "fmb": {
                "name": "Bhoomi survey documents",
                "url": "https://landrecords.karnataka.gov.in/service130/",
            },
        },
    },
    33: {
        "name": "Tamil Nadu",
        "slug": "tamil_nadu",
        "lang": "ta",
        "iso": "IN-TN",
        "accent": "#dc2626",
        "accentSoft": "#fdeaea",
        "division": "taluk",
        # Cadastral parcels — Tamil Nadu TNGIS extract (CC0) via ramSeraph,
        # mirrored to R2 (mirror-cadastrals.yml). The tiles carry no place names
        # but do carry the LGD village code, so the app highlights a selected
        # village's parcels by code like Karnataka. A minority of features have
        # corrupted attribute keys from the upstream scrape; the canonical
        # survey_number / lgd_village_code keys cover the rest.
        "cadastre": {
            "url": (
                "https://pub-f9d4d8c3e04d4318832ab39d095575b6.r2.dev/" "TNGIS_TN_Cadastrals.pmtiles"
            ),
            "sourceLayer": "TNGIS_TN_Cadastrals",
            "minZoom": 11,
            "tileMaxZoom": 14,
            "fields": {
                "survey": "survey_number",
                "villageCode": "lgd_village_code",
                "id": ["object_id", "id"],
            },
            "attribution": (
                "Cadastre &copy; TNGIS (Tamil Nadu, CC0) via "
                '<a href="https://github.com/ramSeraph/indian_cadastrals" '
                'target="_blank" rel="noopener">datameet/ramSeraph</a>'
            ),
            # TN e-Services "View Patta & FMB / Chitta / TSLR Extract" (no URL
            # prefill — the app copies the parcel identifiers first).
            "fmb": {
                "name": "TN e-Services (Patta / FMB)",
                "url": "https://eservices.tn.gov.in/eservicesnew/index.html",
            },
        },
    },
    32: {
        "name": "Kerala",
        "slug": "kerala",
        "lang": "ml",
        "iso": "IN-KL",
        "accent": "#0d9488",
        "accentSoft": "#d9f2ef",
        "division": "taluk",
        # Cadastral parcels — Bhuvan's Kerala extract (CC0) via ramSeraph,
        # mirrored to R2. The tiles carry ONLY the survey number (par_num) — no
        # village name or LGD code — so the app renders the parcel layer and
        # per-parcel popups, but can't highlight a selected village's parcels
        # or build the per-village jump index (build_parcels_index skips it).
        "cadastre": {
            "url": (
                "https://pub-f9d4d8c3e04d4318832ab39d095575b6.r2.dev/"
                "Bhuvan_Kerala_Cadastrals.pmtiles"
            ),
            "sourceLayer": "Bhuvan_Kerala_Cadastrals",
            "minZoom": 11,
            "tileMaxZoom": 13,
            "fields": {
                "survey": "par_num",
                "id": ["par_num"],
            },
            "attribution": (
                "Cadastre &copy; Bhuvan (NRSC/ISRO, CC0) via "
                '<a href="https://github.com/ramSeraph/indian_cadastrals" '
                'target="_blank" rel="noopener">datameet/ramSeraph</a>'
            ),
            # Ente Bhoomi (ILIMS) digital survey records — the e-Rekha successor;
            # no URL prefill, the app copies the parcel identifiers first.
            "fmb": {
                "name": "Ente Bhoomi (e-Rekha)",
                "url": "https://survey.entebhoomi.kerala.gov.in/portal/web/menu/digitalrecords",
            },
        },
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
    "kl": 32,
    "kerala": 32,
}

# All-state boundary vector tiles (tiles/boundaries.pmtiles, built by
# build_boundary_tiles.py). When `enabled`, the web apps stream district/mandal
# polygons from this archive instead of downloading whole GeoJSON files —
# constant payload per view however many states exist. Served same-origin by
# GitHub Pages (range requests work there), so no external host is needed.
# Flip `enabled` to True and re-run pipeline.py to switch the apps over; until
# then the GeoJSON path is untouched (testable per-session via ?bt=1).
BOUNDARY_TILES: dict = {
    "enabled": False,
    "url": "../../tiles/boundaries.pmtiles",
    "districtsLayer": "districts",
    "mandalsLayer": "mandals",
    "minZoom": 4,
    "tileMaxZoom": 12,
}

# Daily Agmarknet mandi-price snapshots (scraper/fetch_mandi_prices.py), published
# by .github/workflows/update-mandi-prices.yml to the dedicated `data/mandi-prices`
# branch — NOT main, so daily price churn never needs a reviewed PR.
# raw.githubusercontent.com serves the branch with `Access-Control-Allow-Origin: *`,
# which lets the GitHub Pages app fetch it cross-origin.
# Optional agri map overlays (WMS raster — no CORS/keys needed for img tiles),
# rendered by app.js initOverlays() into a Leaflet layers control. `labelKey`
# is an i18n key (web_template/i18n.js). Verified anonymous + HTTPS 2026-07:
#  - Bhuvan RGNDWM groundwater prospects (lithology-geomorphology, classified
#    by well depth/yield) for all four states in one overlay.
#  - ISRIC SoilGrids WRB most-probable soil class (250 m, CC-BY 4.0) — the
#    NBSS&LUP soil WMS renders outline-only and lacks AP/TS, so SoilGrids is
#    the usable classified soil layer. CGWB/India-WRIS endpoints are down
#    (2026-07) and historically flaky — deliberately not used.
MAP_OVERLAYS: list[dict] = [
    {
        "id": "gw",
        "labelKey": "ov_gw",
        "url": "https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms",
        "wms": {
            "layers": "gw:AP_LGEOM,gw:TS_LGEOM,gw:KA_LGEOM,gw:TN_LGEOM,gw:KL_LGEOM",
            "format": "image/png",
            "transparent": True,
            "version": "1.1.1",
        },
        "opacity": 0.6,
        "maxZoom": 15,
        "attribution": (
            'Groundwater prospects: <a href="https://bhuvan.nrsc.gov.in" '
            'target="_blank" rel="noopener">Bhuvan, NRSC/ISRO</a>'
        ),
    },
    {
        "id": "soil",
        "labelKey": "ov_soil",
        "url": "https://maps.isric.org/mapserv?map=/map/wrb.map",
        "wms": {
            "layers": "MostProbable",
            "format": "image/png",
            "transparent": True,
            "version": "1.3.0",
        },
        "opacity": 0.65,
        "maxZoom": 14,
        "attribution": (
            'Soil: <a href="https://soilgrids.org" target="_blank" '
            'rel="noopener">ISRIC SoilGrids</a> (CC BY 4.0)'
        ),
    },
]

MANDI_PRICES_URL = (
    "https://raw.githubusercontent.com/mchittineni/india-village-finder/"
    "refs/heads/data/mandi-prices/{slug}.json"
)

# Weekly myScheme snapshot of government schemes for farmers (state + Central,
# "Agriculture,Rural & Environment"), multilingual — see
# scraper/fetch_farmer_schemes.py. Published by update-farmer-schemes.yml to
# the `data/farmer-schemes` branch, fetched at runtime like the mandi feed.
FARMER_SCHEMES_URL = (
    "https://raw.githubusercontent.com/mchittineni/india-village-finder/"
    "refs/heads/data/farmer-schemes/{slug}.json"
)

# Farm-inputs quick reference shown in the schemes panel. Static and curated:
# there is no reliable open feed for fertilizer stock or soil-test data —
# iFMS/urvarak.nic.in drops connections and the Soil Health portal sits behind
# a WAF (verified 2026-07) — so the app shows the notified reference prices
# plus links to the official portals instead. Urea MRP is statutory; DAP is
# the NBS-subsidised market price. Update `season`/prices when the Cabinet
# notifies new NBS rates (₹41,534 cr Kharif-2026 round: Apr–Sep 2026).
FARM_INPUTS: dict = {
    "season": "Kharif 2026",
    "fertilizers": [
        {"name": "Urea (45 kg)", "price": "₹266.50"},
        {"name": "DAP (50 kg)", "price": "₹1,350"},
    ],
    "links": [
        {"labelKey": "farm_stock_link", "url": "https://urvarak.nic.in/"},
        {"labelKey": "farm_shc_link", "url": "https://soilhealth.dac.gov.in/"},
    ],
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
# A third file pins a fix to exactly ONE village, keyed {lang: {lgd_code:
# native}} — for spellings that must not propagate to same-named villages
# (e.g. a locally-used translated form). Written by translit_review.py
# harvest for notes marked `scope: code`; beats the name-keyed seeds.
# --------------------------------------------------------------------------- #
OVERRIDES_FILE = HERE / "translit_overrides.json"
OVERRIDES_BY_CODE_FILE = HERE / "translit_overrides_by_code.json"
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


def load_code_overrides(lang: str) -> dict[str, str]:
    """Return {lgd_village_code: native} for ``lang`` — per-village pins that beat
    the name-keyed seeds for that one village (see OVERRIDES_BY_CODE_FILE)."""
    return {
        str(code).strip(): native
        for code, native in (_load_json(OVERRIDES_BY_CODE_FILE).get(lang) or {}).items()
        if native
    }
