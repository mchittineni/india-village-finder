#!/usr/bin/env python3
"""
seed_osm_names.py — harvest human-verified native place names from OpenStreetMap.

OSM contributors tag many Indian settlements with a localised name (``name:te``,
``name:kn``, ``name:ta``) alongside the English ``name``. Those are human-checked,
so they beat any machine transliteration. This tool queries the Overpass API for
place nodes/ways in each state that carry both an English name and a name in the
state's script, and writes ``scraper/osm_names.json``:

    { "te": { "anantapur": "…", … }, "kn": { … }, "ta": { … } }

The pipeline and the neural-names tool read this via ``config.load_name_seeds`` and
prefer it over the model, so committing this file upgrades the native names shown
on the map and in the CSV — no PyTorch required.

Overpass is public and rate-limited, so this is a run-occasionally-in-CI job (see
.github/workflows/seed-osm-names.yml), not part of the daily pipeline.

Run:  python seed_osm_names.py                 # all states, merge into osm_names.json
      python seed_osm_names.py --state ka       # one state
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests

from config import OSM_NAMES_FILE, STATES, resolve_codes

# Public Overpass endpoints (same set the web app uses for nearby services).
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
SCRIPT_RANGE = {
    "te": (0x0C00, 0x0C7F),
    "kn": (0x0C80, 0x0CFF),
    "ta": (0x0B80, 0x0BFF),
}


def in_script(s: str, lang: str) -> bool:
    lo, hi = SCRIPT_RANGE.get(lang, (0, 0))
    return any(lo <= ord(c) <= hi for c in s) if s else False


def build_query(iso: str, lang: str) -> str:
    """Overpass QL: every settlement in the state's admin area that has both an
    English name and a name in the target script."""
    return (
        "[out:json][timeout:600];"
        f'area["ISO3166-2"="{iso}"]->.a;'
        "("
        f'  node["place"~"city|town|village|hamlet"]["name"]["name:{lang}"](area.a);'
        f'  way["place"~"city|town|village|hamlet"]["name"]["name:{lang}"](area.a);'
        ");"
        "out tags center;"
    )


def parse_elements(elements: list[dict], lang: str) -> dict[str, str]:
    """Map {english_name_lower: native} from Overpass elements, keeping only
    entries whose localised name is genuinely in the target script."""
    out: dict[str, str] = {}
    for el in elements:
        tags = el.get("tags") or {}
        en = (tags.get("name") or "").strip()
        native = (tags.get(f"name:{lang}") or "").strip()
        if en and native and in_script(native, lang):
            out.setdefault(en.lower(), native)
    return out


def fetch_overpass(query: str, session: requests.Session, retries: int = 4) -> list[dict]:
    """POST a query to Overpass, trying each endpoint with backoff. Returns the
    ``elements`` list; raises on total failure."""
    last: Exception | None = None
    delay = 5.0
    for attempt in range(retries):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            resp = session.post(endpoint, data={"data": query}, timeout=600)
            if resp.status_code in (429, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp.json().get("elements", [])
        except (requests.RequestException, ValueError) as e:
            last = e
            if attempt == retries - 1:
                break
            print(f"  [retry] {endpoint}: {e} — waiting {delay:.0f}s")
            time.sleep(delay)
            delay = min(delay * 2, 120.0)
    raise RuntimeError(f"Overpass unreachable: {last}")


def seed(state_codes, out_path: Path = OSM_NAMES_FILE) -> dict:
    """Query OSM for the given states and merge results into ``out_path``.
    Returns the merged mapping."""
    merged: dict[str, dict] = {}
    if out_path.exists():
        try:
            merged = json.loads(out_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            merged = {}

    with requests.Session() as s:
        for code in state_codes:
            cfg = STATES[code]
            lang, iso = cfg["lang"], cfg.get("iso")
            if not iso:
                print(f"[skip] {cfg['slug']}: no ISO code in registry")
                continue
            print(f"[osm] {cfg['slug']} ({iso}) name:{lang} ...")
            elements = fetch_overpass(build_query(iso, lang), s)
            found = parse_elements(elements, lang)
            merged.setdefault(lang, {})
            before = len(merged[lang])
            merged[lang].update(found)  # newer harvest wins for a given name
            print(f"    {len(found)} names ({len(merged[lang]) - before} new)")

    out_path.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    total = sum(len(v) for v in merged.values())
    print(f"[osm] wrote {out_path.name}: {total} names across {len(merged)} language(s)")
    return merged


def main():
    ap = argparse.ArgumentParser(description="Seed native place names from OpenStreetMap")
    ap.add_argument("--state", default="all", help="ap | tg | ka | tn | all (default: all)")
    args = ap.parse_args()
    seed(resolve_codes(args.state))


if __name__ == "__main__":
    main()
