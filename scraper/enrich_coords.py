#!/usr/bin/env python3
"""
enrich_coords.py — best-effort *precise* coordinates for villages.

LGD publishes no village point coordinates, so we match each village by name to a
GeoNames populated-place and keep the match only if it sits close to the village's
mandal (centroid of the mandal polygon). The proximity check rejects same-named
places in the wrong district, so a kept coordinate is trustworthy — at the cost of
coverage (many villages simply have no GeoNames entry). Unmatched villages keep the
mandal-centroid pin the web app already computes at runtime.

Output (per state):  <state>/web/data/coords.json  = { "<villageCode>": [lat, lng], ... }
and updates `counts.with_coords` in meta.json.

Needs the mandal polygons (run build_boundaries.py first). Run from the repo root:
    python scraper/enrich_coords.py            (both states)
    python scraper/enrich_coords.py --state ap
"""
from __future__ import annotations

import argparse
import json
import math
import re
import zipfile
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RAW = HERE / ".cache" / "raw"
STATES = {28: "andhra_pradesh", 36: "telangana", 29: "karnataka"}
ALIAS = {"ap": 28, "tg": 36, "ts": 36, "ka": 29, "kar": 29}

GEONAMES_URL = "https://download.geonames.org/export/dump/IN.zip"
# Bounding box covering AP + Telangana + Karnataka (generous) — filters GeoNames
# noise from other states. Karnataka reaches the west coast (~74°E), so the box is
# wider than AP/TG alone; the per-village mandal-proximity check still gates matches.
BBOX = (74.0, 11.5, 86.5, 20.5)            # min_lon, min_lat, max_lon, max_lat
MATCH_DEG = 0.20                            # ~22 km: keep a name match only this close to its mandal


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load_geonames() -> dict[str, list[tuple[float, float]]]:
    """norm(name) -> list of (lat, lng) for populated places within the AP/TG box."""
    RAW.mkdir(parents=True, exist_ok=True)
    zpath = RAW / "IN.zip"
    if not zpath.exists():
        print("  downloading GeoNames IN.zip ...")
        with requests.get(GEONAMES_URL, stream=True, timeout=300) as r:
            r.raise_for_status()
            with open(zpath, "wb") as fh:
                for chunk in r.iter_content(1 << 16):
                    fh.write(chunk)
    minx, miny, maxx, maxy = BBOX
    idx: dict[str, list[tuple[float, float]]] = {}
    with zipfile.ZipFile(zpath) as z:
        for line in z.read("IN.txt").decode("utf-8").splitlines():
            f = line.split("\t")
            if len(f) < 15 or f[6] != "P":          # feature class P = populated place
                continue
            try:
                lat, lng = float(f[4]), float(f[5])
            except ValueError:
                continue
            if not (minx <= lng <= maxx and miny <= lat <= maxy):
                continue
            names = [f[1]] + [a for a in f[3].split(",") if a]
            for nm in names:
                idx.setdefault(norm(nm), []).append((lat, lng))
    print(f"  GeoNames places in box: indexed {len(idx)} distinct names")
    return idx


def polygon_centroid(geom) -> tuple[float, float] | None:
    xs, ys = [], []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        else:
            for x in c:
                walk(x)
    walk(geom.get("coordinates", []))
    if not xs:
        return None
    return (sum(ys) / len(ys), sum(xs) / len(xs))   # (lat, lng)


def enrich(state_code: int, geo_idx) -> dict:
    slug = STATES[state_code]
    web_data = ROOT / slug / "web" / "data"
    regions = json.loads((web_data / "regions.json").read_text(encoding="utf-8"))
    villages = json.loads((web_data / "villages.json").read_text(encoding="utf-8"))
    mandals_geo = json.loads((web_data / "mandals.geojson").read_text(encoding="utf-8"))

    centroid_by_code = {}
    for ft in mandals_geo["features"]:
        c = polygon_centroid(ft["geometry"])
        if c:
            centroid_by_code[ft["properties"]["c"]] = c
    mandal_code_by_idx = [m["c"] for m in regions["mandals"]]

    coords = {}
    matched = 0
    for row in villages["rows"]:
        name, mi, code = row[0], row[1], row[2]
        cands = geo_idx.get(norm(name))
        if not cands:
            continue
        cen = centroid_by_code.get(mandal_code_by_idx[mi]) if mi < len(mandal_code_by_idx) else None
        if not cen:
            continue
        clat, clng = cen
        best, bestd = None, 1e9
        for (lat, lng) in cands:
            d = math.hypot(lat - clat, lng - clng)
            if d < bestd:
                best, bestd = (lat, lng), d
        if best and bestd <= MATCH_DEG:
            coords[str(code)] = [round(best[0], 5), round(best[1], 5)]
            matched += 1

    (web_data / "coords.json").write_text(json.dumps(coords, separators=(",", ":")))

    meta_path = web_data / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["counts"]["with_coords"] = matched
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2))

    total = len(villages["rows"])
    print(f"  {slug}: precise coords for {matched}/{total} villages ({matched/total:.1%})")
    return {"matched": matched, "total": total}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", choices=["ap", "tg", "ka", "both"], default="both")
    args = ap.parse_args()
    targets = list(STATES) if args.state == "both" else [ALIAS[args.state]]
    print("[geonames] loading place index ...")
    geo_idx = load_geonames()
    for sc in targets:
        print(f"=== {STATES[sc]} ===")
        enrich(sc, geo_idx)


if __name__ == "__main__":
    main()
