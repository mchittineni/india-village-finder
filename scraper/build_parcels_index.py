#!/usr/bin/env python3
"""
build_parcels_index.py — precompute a village → parcel-extent index from the
cadastral PMTiles, so the web app can jump precisely to a village's land parcels.

Why this exists
---------------
Only ~16% of villages carry a point coordinate in the open LGD data, so the map
otherwise can't locate the other 84% precisely. The cadastral parcels *do* cover
them, so we aggregate each village's parcels into a bounding box here (once,
offline) and key it by LGD village code. At runtime the app looks up the code and
fits straight to the box — no fragile in-browser name matching, and it also tells
the UI which villages actually have parcels.

Crosswalk note: AP's 2022 reorganisation renumbered districts, so the cadastral
`d_name` (older) disagrees with LGD's current district. Mandal + village names are
stable, so we match on (mandal, village) only.

Source: the same PMTiles the app renders (STATES[…]["cadastre"]["url"]). We read
the max-zoom (z13) tiles — full parcel detail — and convert tile coordinates to
lat/lng. Heavy (whole-state scan); intended to run in CI, not on a laptop.

Output: <slug>/web/data/parcels_index.json
    { "<lgd_village_code>": [minLat, minLng, maxLat, maxLng], ... }

Run:
    python build_parcels_index.py --slug andhra_pradesh \
        --pmtiles scraper/.cache/cadastrals/APSAC_AP_Cadastrals.pmtiles
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import re
import sys
from pathlib import Path

try:
    from pmtiles.reader import MmapSource, Reader
    import mapbox_vector_tile as mvt
except ImportError:  # pragma: no cover - environment dependent
    print(
        "build_parcels_index requires 'pmtiles' and 'mapbox-vector-tile' "
        "(pip install pmtiles mapbox-vector-tile)",
        file=sys.stderr,
    )
    raise

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
EXTENT = 4096  # MVT tile coordinate extent


def norm(s: str) -> str:
    """Normalise a place name for matching: lowercase, drop parenthetical
    suffixes like (U)/(R)/(CT), keep alphanumerics only."""
    s = (s or "").lower()
    s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def tile_to_lnglat(px: float, py: float, z: int, x: int, y: int):
    """Convert a tile-local coordinate (0..EXTENT, origin top-left, y down) to
    (lng, lat) degrees."""
    n = 2**z
    lng = (x + px / EXTENT) / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / EXTENT) / n))))
    return lng, lat


def load_lgd_lookup(slug: str) -> dict[str, int]:
    """Build {norm(mandal)|norm(village): lgd_code} from the generated web data.
    Keys that map to more than one code (name collisions) are dropped."""
    data = ROOT / slug / "web" / "data"
    regions = json.loads((data / "regions.json").read_text())
    villages = json.loads((data / "villages.json").read_text())
    rows = villages if isinstance(villages, list) else villages.get("rows", [])
    mandals = regions["mandals"]
    lookup: dict[str, int] = {}
    dupes: set[str] = set()
    for r in rows:
        name, m_idx, code = r[0], r[1], r[2]
        mandal = mandals[m_idx]["n"] if 0 <= m_idx < len(mandals) else ""
        key = f"{norm(mandal)}|{norm(name)}"
        if key in lookup and lookup[key] != code:
            dupes.add(key)
        else:
            lookup[key] = code
    for k in dupes:
        lookup.pop(k, None)
    return lookup


def aggregate_parcels(pmtiles: Path, source_layer: str):
    """Scan the z13 tiles and accumulate a lat/lng bbox per
    norm(mandal)|norm(village). Returns {key: [minLat, minLng, maxLat, maxLng]}."""
    r = Reader(MmapSource(open(pmtiles, "rb")))
    hdr = r.header()
    z = hdr["max_zoom"]
    lat_lo = hdr["min_lat_e7"] / 1e7
    lat_hi = hdr["max_lat_e7"] / 1e7
    lng_lo = hdr["min_lon_e7"] / 1e7
    lng_hi = hdr["max_lon_e7"] / 1e7
    n = 2**z

    def xtile(lng):
        return int((lng + 180.0) / 360.0 * n)

    def ytile(lat):
        rad = math.radians(lat)
        return int((1 - math.log(math.tan(rad) + 1 / math.cos(rad)) / math.pi) / 2 * n)

    x0, x1 = xtile(lng_lo), xtile(lng_hi)
    y0, y1 = ytile(lat_hi), ytile(lat_lo)  # y grows southward
    boxes: dict[str, list] = {}
    tiles = decoded = 0
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            raw = r.get(z, x, y)
            if not raw:
                continue
            tiles += 1
            if raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)
            try:
                dec = mvt.decode(raw)
            except Exception:
                continue
            layer = dec.get(source_layer) or next(iter(dec.values()), None)
            if not layer:
                continue
            decoded += 1
            for feat in layer["features"]:
                props = feat["properties"]
                key = f"{norm(props.get('m_name'))}|{norm(props.get('v_name'))}"
                if key == "|":
                    continue
                # feature bbox in tile space -> two lng/lat corners
                mnx = mny = float("inf")
                mxx = mxy = float("-inf")
                stack = [feat["geometry"]["coordinates"]]
                while stack:
                    c = stack.pop()
                    if c and isinstance(c[0], (int, float)):
                        mnx = min(mnx, c[0]); mxx = max(mxx, c[0])
                        mny = min(mny, c[1]); mxy = max(mxy, c[1])
                    else:
                        stack.extend(c)
                if mnx == float("inf"):
                    continue
                # MVT geometry carries a buffer beyond the 0..EXTENT tile box;
                # clamp so an edge parcel doesn't overshoot into neighbouring
                # ground. The union across the tiles a village spans still
                # reconstructs its full extent.
                clamp = lambda v: 0.0 if v < 0 else (EXTENT if v > EXTENT else v)
                mnx, mny, mxx, mxy = clamp(mnx), clamp(mny), clamp(mxx), clamp(mxy)
                lng_a, lat_a = tile_to_lnglat(mnx, mny, z, x, y)
                lng_b, lat_b = tile_to_lnglat(mxx, mxy, z, x, y)
                blo_lat, bhi_lat = min(lat_a, lat_b), max(lat_a, lat_b)
                blo_lng, bhi_lng = min(lng_a, lng_b), max(lng_a, lng_b)
                b = boxes.get(key)
                if b is None:
                    boxes[key] = [blo_lat, blo_lng, bhi_lat, bhi_lng]
                else:
                    b[0] = min(b[0], blo_lat); b[1] = min(b[1], blo_lng)
                    b[2] = max(b[2], bhi_lat); b[3] = max(b[3], bhi_lng)
    print(f"[scan] {tiles} tiles with data, {decoded} decoded, {len(boxes)} villages in cadastre")
    return boxes


def main() -> None:
    ap = argparse.ArgumentParser(description="Build a village->parcel bbox index")
    ap.add_argument("--slug", required=True, help="state slug (e.g. andhra_pradesh)")
    ap.add_argument("--pmtiles", required=True, type=Path, help="cadastral PMTiles path")
    ap.add_argument("--source-layer", default="APSAC_AP_Cadastrals")
    args = ap.parse_args()

    lgd = load_lgd_lookup(args.slug)
    boxes = aggregate_parcels(args.pmtiles, args.source_layer)

    index: dict[str, list] = {}
    matched = 0
    for key, box in boxes.items():
        code = lgd.get(key)
        if code is None:
            continue
        matched += 1
        index[str(code)] = [round(v, 5) for v in box]

    out = ROOT / args.slug / "web" / "data" / "parcels_index.json"
    out.write_text(json.dumps(index, separators=(",", ":")) + "\n")
    rate = 100 * matched / len(boxes) if boxes else 0
    print(
        f"[index] matched {matched}/{len(boxes)} cadastral villages to LGD "
        f"({rate:.0f}%); wrote {len(index)} entries -> {out.relative_to(ROOT)} "
        f"({out.stat().st_size // 1024} KB)"
    )


if __name__ == "__main__":
    main()
