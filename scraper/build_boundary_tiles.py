#!/usr/bin/env python3
"""
build_boundary_tiles.py — tile every state's boundary polygons into one PMTiles.

Why: each state app currently downloads its whole districts.geojson +
mandals.geojson (~1–1.5 MB per state) before the map can draw. That is fine for
four states but scales linearly with the roadmap's "more states" — an all-India
build would ship tens of MB of GeoJSON to every visitor. Vector tiles flip that:
the browser streams only the tiles in view (a few KB each) from a single static
archive via HTTP range requests.

What it does:
  1. Merges every state's simplified web/data/{districts,mandals}.geojson
     (produced by build_boundaries.py) into two national layers, tagging each
     feature with its state slug so a state app can filter to itself.
  2. Runs tippecanoe -> tiles/boundaries.pmtiles with two layers ("districts",
     "mandals"). Geometry only (c / n / d / state) — village counts are NOT
     baked in, the app colours the choropleth at runtime from regions.json, so
     tiles rebuild only when boundaries change (rare), not on daily data runs.
  3. Writes per-state web/data/boundary_bounds.json:
         {"d": {code: [minLat,minLng,maxLat,maxLng]}, "m": {...}}
     The GL rendering path needs it for fitBounds/centroids, which the Leaflet
     GeoJSON path used to derive from the loaded geometry.

The output archive (a few MB for four states) is committed to tiles/ and served
same-origin by GitHub Pages, which honours range requests — so unlike the 850 MB
cadastre it needs no external CORS host.

Requires tippecanoe (https://github.com/felt/tippecanoe) on PATH.

Run:  python build_boundary_tiles.py              # all states
      python build_boundary_tiles.py --state ap   # bounds json for one state,
                                                  # tiles still cover all states
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from config import ROOT, SLUG_BY_CODE, STATES, resolve_codes

TILES_DIR = ROOT / "tiles"
OUT_PMTILES = TILES_DIR / "boundaries.pmtiles"
MIN_ZOOM = 4
MAX_ZOOM = 12  # mandal detail; the app overzooms beyond this


def geom_bbox(geometry: dict) -> list[float] | None:
    """[minLat, minLng, maxLat, maxLng] of a (Multi)Polygon, or None."""
    lats: list[float] = []
    lngs: list[float] = []

    def walk(coords):
        if not coords:
            return
        if isinstance(coords[0], (int, float)):
            lngs.append(coords[0])
            lats.append(coords[1])
        else:
            for c in coords:
                walk(c)

    walk((geometry or {}).get("coordinates") or [])
    if not lats:
        return None
    return [
        round(min(lats), 5),
        round(min(lngs), 5),
        round(max(lats), 5),
        round(max(lngs), 5),
    ]


def load_features(slug: str, level: str) -> list[dict]:
    """One state's simplified features for a level, tagged with the state slug."""
    path = ROOT / slug / "web" / "data" / f"{level}.geojson"
    if not path.exists():
        print(f"  [warn] {path.relative_to(ROOT)} missing — run build_boundaries.py first")
        return []
    fc = json.loads(path.read_text(encoding="utf-8"))
    feats = fc.get("features") or []
    for ft in feats:
        ft.setdefault("properties", {})["state"] = slug
    return feats


def write_bounds(slug: str) -> None:
    """Per-state boundary_bounds.json for the GL path's fitBounds lookups."""
    out = {"d": {}, "m": {}}
    for level, key in (("districts", "d"), ("mandals", "m")):
        path = ROOT / slug / "web" / "data" / f"{level}.geojson"
        if not path.exists():
            continue
        fc = json.loads(path.read_text(encoding="utf-8"))
        for ft in fc.get("features") or []:
            code = (ft.get("properties") or {}).get("c")
            bbox = geom_bbox(ft.get("geometry") or {})
            if code and bbox:
                out[key][str(code)] = bbox
    dest = ROOT / slug / "web" / "data" / "boundary_bounds.json"
    dest.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"  {slug}: boundary_bounds.json ({len(out['d'])} districts, {len(out['m'])} mandals)")


def build_tiles() -> None:
    """Merge every state's boundaries and tile them into OUT_PMTILES."""
    if shutil.which("tippecanoe") is None:
        raise SystemExit(
            "tippecanoe is required (https://github.com/felt/tippecanoe) — "
            "brew install tippecanoe, or run the build-boundary-tiles workflow in CI"
        )
    TILES_DIR.mkdir(parents=True, exist_ok=True)
    slugs = [SLUG_BY_CODE[c] for c in STATES]
    with tempfile.TemporaryDirectory() as td:
        layer_args = []
        for level in ("districts", "mandals"):
            feats = []
            for slug in slugs:
                feats.extend(load_features(slug, level))
            merged = Path(td) / f"{level}.geojson"
            merged.write_text(
                json.dumps({"type": "FeatureCollection", "features": feats}),
                encoding="utf-8",
            )
            layer_args += ["-L", f"{level}:{merged}"]
            print(f"  merged {level}: {len(feats)} features")
        cmd = [
            "tippecanoe",
            "-o",
            str(OUT_PMTILES),
            "--force",
            f"--minimum-zoom={MIN_ZOOM}",
            f"--maximum-zoom={MAX_ZOOM}",
            "--detect-shared-borders",  # simplify shared edges consistently (no slivers)
            "--coalesce-densest-as-needed",
            "--no-tile-compression",  # PMTiles range clients read tiles uncompressed
            *layer_args,
        ]
        subprocess.run(cmd, check=True)
    size_mb = OUT_PMTILES.stat().st_size / (1 << 20)
    print(f"  wrote {OUT_PMTILES.relative_to(ROOT)} ({size_mb:.1f} MB)")


def main():
    ap = argparse.ArgumentParser(description="Tile all-state boundary polygons into PMTiles")
    ap.add_argument("--state", default="all", help="ap | tg | ka | tn | all (bounds json scope)")
    ap.add_argument("--skip-tiles", action="store_true", help="only write boundary_bounds.json")
    args = ap.parse_args()
    codes = resolve_codes(args.state)
    for code in codes:
        write_bounds(SLUG_BY_CODE[code])
    if not args.skip_tiles:
        build_tiles()


if __name__ == "__main__":
    main()
