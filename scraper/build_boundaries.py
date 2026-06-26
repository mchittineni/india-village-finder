#!/usr/bin/env python3
"""
build_boundaries.py — fetch + simplify district & mandal map polygons per state.

Boundaries change rarely (a district/mandal reorganisation every few years), so
this is a *separate* step from the weekly village-data refresh — run it monthly
or on demand.

Source: github.com/ramSeraph/indian_admin_boundaries — current (2016/2022) LGD
administrative polygons for all of India, as 7z-compressed GeoJSON-Lines. Each
feature carries the LGD code (`dist_lgd` / `subdt_lgd`) so the web app joins a
polygon to its village counts by code, not by fragile name matching.

For each state we: stream-filter the national file to that state, keep only the
LGD code + name (small payload), then topology-aware simplify with mapshaper
(via npx) so the polygons are lightweight enough for the browser. If mapshaper
is unavailable we fall back to the un-simplified (larger) GeoJSON.

Outputs:  <state>/web/data/districts.geojson
          <state>/web/data/mandals.geojson
          (+ updates <state>/web/data/boundaries_meta.json)

Run:  python build_boundaries.py            (both states)
      python build_boundaries.py --state ap
      python build_boundaries.py --offline  (reuse cached .7z downloads)
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import datetime as dt
from pathlib import Path

import requests

try:
    import py7zr
except ImportError:  # pragma: no cover
    py7zr = None

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RAW = HERE / ".cache" / "raw"

STATES = {28: "andhra_pradesh", 36: "telangana", 29: "karnataka"}
ALIAS = {"ap": 28, "tg": 36, "ts": 36, "ka": 29, "kar": 29}

BASE = "https://github.com/ramSeraph/indian_admin_boundaries/releases/download"
LEVELS = {
    "districts": {
        "url": f"{BASE}/districts/LGD_Districts.geojsonl.7z",
        "archive": "LGD_Districts.geojsonl.7z",
        "jsonl": "LGD_Districts.geojsonl",
        "code": "dist_lgd", "name": "dtname",
        "simplify": "12%",
    },
    "mandals": {
        "url": f"{BASE}/subdistricts/LGD_Subdistricts.geojsonl.7z",
        "archive": "LGD_Subdistricts.geojsonl.7z",
        "jsonl": "LGD_Subdistricts.geojsonl",
        "code": "subdt_lgd", "name": "sdtname", "parent": "dist_lgd",
        "simplify": "9%",
    },
}


def ensure_jsonl(level: dict, offline: bool) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    jsonl = RAW / level["jsonl"]
    if jsonl.exists():
        return jsonl
    archive = RAW / level["archive"]
    if not archive.exists():
        if offline:
            raise RuntimeError(f"--offline but {archive} missing")
        print(f"  downloading {level['archive']} ...")
        with requests.get(level["url"], stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(archive, "wb") as fh:
                for chunk in r.iter_content(1 << 16):
                    fh.write(chunk)
    if py7zr is None:
        raise RuntimeError("py7zr required to extract boundary archives")
    print(f"  extracting {level['archive']} ...")
    with py7zr.SevenZipFile(archive, "r") as z:
        z.extractall(RAW)
    return jsonl


def filter_state(jsonl: Path, level: dict, state_code: int) -> dict:
    """Stream the national geojsonl, keep this state's features with trim props.

    Drops polygons with a missing/zero LGD code and de-duplicates by code, so the
    shipped GeoJSON joins cleanly to the village data. (The upstream boundary set
    occasionally carries placeholder code 0 or duplicate features.)
    """
    feats = []
    seen = set()
    code_k, name_k = level["code"], level["name"]
    parent_k = level.get("parent")
    with open(jsonl, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().rstrip(",")
            if not line or line[0] != "{":
                continue
            try:
                ft = json.loads(line)
            except json.JSONDecodeError:
                continue
            p = ft.get("properties", {})
            if p.get("state_lgd") != state_code:
                continue
            code = p.get(code_k)
            if not isinstance(code, int) or code <= 0 or code in seen:
                continue
            seen.add(code)
            props = {"c": code, "n": (p.get(name_k) or "").strip()}
            if parent_k:
                props["d"] = p.get(parent_k)
            feats.append({"type": "Feature", "properties": props, "geometry": ft.get("geometry")})
    return {"type": "FeatureCollection", "features": feats}


def simplify(fc: dict, percent: str, out_path: Path) -> bool:
    """Topology-aware simplify via mapshaper (npx). Returns True on success."""
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".geojson", delete=False) as tf:
            json.dump(fc, tf)
            tmp = tf.name
        cmd = ["npx", "--yes", "mapshaper", tmp,
               "-simplify", percent, "keep-shapes", "-clean",
               "-o", "format=geojson", "precision=0.0001", str(out_path)]
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=600)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        msg = getattr(e, "stderr", "") or str(e)
        print(f"  [warn] mapshaper unavailable/failed, writing un-simplified: {msg[:120]}")
        out_path.write_text(json.dumps(fc, separators=(",", ":")))
        return False
    finally:
        Path(tmp).unlink(missing_ok=True)


def build(state_code: int, offline: bool):
    slug = STATES[state_code]
    web_data = ROOT / slug / "web" / "data"
    web_data.mkdir(parents=True, exist_ok=True)
    meta = {"generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "github.com/ramSeraph/indian_admin_boundaries (LGD admin polygons)",
            "levels": {}}
    print(f"\n=== {slug} (state {state_code}) ===")
    for lvl_name, lvl in LEVELS.items():
        jsonl = ensure_jsonl(lvl, offline)
        fc = filter_state(jsonl, lvl, state_code)
        out = web_data / f"{lvl_name}.geojson"
        simplified = simplify(fc, lvl["simplify"], out)
        size_kb = out.stat().st_size / 1024
        print(f"  {lvl_name}: {len(fc['features'])} polygons -> {out.name} "
              f"({size_kb:.0f} KB, {'simplified' if simplified else 'raw'})")
        meta["levels"][lvl_name] = {"features": len(fc["features"]),
                                    "simplified": simplified, "size_kb": round(size_kb)}
    (web_data / "boundaries_meta.json").write_text(json.dumps(meta, indent=2))


def main():
    ap = argparse.ArgumentParser(description="Build per-state district/mandal map polygons")
    ap.add_argument("--state", choices=["ap", "tg", "ka", "both"], default="both")
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()
    targets = list(STATES) if args.state == "both" else [ALIAS[args.state]]
    for sc in targets:
        build(sc, args.offline)


if __name__ == "__main__":
    main()
