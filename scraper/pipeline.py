#!/usr/bin/env python3
"""
pipeline.py — build per-state village datasets + web apps for
Andhra Pradesh and Telangana.

Project layout (shared tooling, self-contained per-state outputs)
-----------------------------------------------------------------
    scraper/                 <- this shared pipeline (one code path, both states)
      lgd_client.py
      pipeline.py
      web_template/          <- single source of truth for the map UI
      .cache/raw/            <- national LGD dump (downloaded once, shared)
    andhra_pradesh/
      data/                  <- AP flat CSV export
      web/                   <- AP map app (generated: template + config + data)
    telangana/
      data/  web/            <- same, for Telangana

Data flow
---------
1. DOWNLOAD  the latest daily LGD (Local Government Directory) CSV dump from the
   community mirror `ramSeraph/opendata` (official LGD data, republished
   captcha-free, refreshed daily) into scraper/.cache/raw/. One national file
   set is shared by both states.
2. For EACH state (Andhra Pradesh = 28, Telangana = 36):
     FILTER  rows to that state.
     VERIFY  district/mandal counts against the LIVE LGD portal (non-fatal).
     EMIT    <state>/web/data/{regions,villages,meta}.json
             <state>/data/<state>_villages.csv
     BUILD   copy web_template into <state>/web/ and write config.js.

Run:  python pipeline.py                  (both states, auto-detect latest dump)
      python pipeline.py --state ap       (only Andhra Pradesh)
      python pipeline.py --state tg       (only Telangana)
      python pipeline.py --offline        (reuse already-downloaded raw CSVs)
      python pipeline.py --no-verify      (skip the live LGD cross-check)
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import shutil
from pathlib import Path

import requests

try:
    import py7zr
except ImportError:  # pragma: no cover
    py7zr = None

HERE = Path(__file__).resolve().parent          # scraper/
ROOT = HERE.parent                              # Village Finder/
RAW = HERE / ".cache" / "raw"
TEMPLATE = HERE / "web_template"

RELEASES_API = "https://api.github.com/repos/ramSeraph/opendata/releases?per_page=100"
ASSET_RE = re.compile(r"^(pincode_villages|villages|subdistricts|districts)\.(\d{2}[A-Za-z]{3}\d{4})\.csv\.7z$")
REQUIRED_KINDS = {"villages", "subdistricts", "districts"}  # pincode_villages is optional

# One config block per state. `slug` is the folder name. `division` is the local
# name for a sub-district (Mandal in AP/Telangana, Taluk in Karnataka) — the web
# app uses it to label that tier correctly.
STATES = {
    28: {"name": "Andhra Pradesh", "slug": "andhra_pradesh",
         "accent": "#1f6feb", "accentSoft": "#eaf2ff", "division": "mandal"},
    36: {"name": "Telangana", "slug": "telangana",
         "accent": "#0f9d58", "accentSoft": "#e3f6ec", "division": "mandal"},
    29: {"name": "Karnataka", "slug": "karnataka",
         "accent": "#d97706", "accentSoft": "#fdeccf", "division": "taluk"},
}
ALIAS = {"ap": 28, "andhra_pradesh": 28, "andhra": 28,
         "tg": 36, "ts": 36, "telangana": 36,
         "ka": 29, "kar": 29, "karnataka": 29}

csv.field_size_limit(10_000_000)


# ---------------------------------------------------------------------------
# 1. Download latest national LGD dump (shared)
# ---------------------------------------------------------------------------
def find_latest_assets() -> tuple[dict[str, str], str]:
    r = requests.get(RELEASES_API, timeout=60, headers={"Accept": "application/vnd.github+json"})
    r.raise_for_status()
    best: dict[str, tuple[dt.date, str]] = {}
    for rel in r.json():
        for a in rel.get("assets", []):
            m = ASSET_RE.match(a["name"])
            if not m:
                continue
            kind, datestr = m.group(1), m.group(2)
            d = dt.datetime.strptime(datestr, "%d%b%Y").date()
            if kind not in best or d > best[kind][0]:
                best[kind] = (d, a["browser_download_url"])
    if set(best) < REQUIRED_KINDS:
        raise RuntimeError(f"Could not find all LGD assets; found {set(best)}")
    date = max(best[k][0] for k in REQUIRED_KINDS).strftime("%d%b%Y")
    return {k: v[1] for k, v in best.items()}, date


def download_and_extract(offline: bool) -> dict[str, Path]:
    RAW.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    if offline:
        for kind in ("districts", "subdistricts", "villages", "pincode_villages"):
            found = sorted(RAW.glob(f"{kind}.*.csv"))
            if found:
                paths[kind] = found[-1]
            elif kind in REQUIRED_KINDS:
                raise RuntimeError(f"--offline but no extracted {kind} CSV in {RAW}")
        print(f"[offline] using {', '.join(p.name for p in paths.values())}")
        return paths

    if py7zr is None:
        raise RuntimeError("py7zr is required to extract the .7z dumps (pip install py7zr)")

    assets, date = find_latest_assets()
    print(f"[download] latest LGD dump: {date}")
    for kind, url in assets.items():
        archive = RAW / url.split("/")[-1]
        if not archive.exists():
            print(f"  fetching {kind} ...")
            with requests.get(url, stream=True, timeout=300) as resp:
                resp.raise_for_status()
                with open(archive, "wb") as fh:
                    for chunk in resp.iter_content(1 << 16):
                        fh.write(chunk)
        with py7zr.SevenZipFile(archive, "r") as z:
            z.extractall(RAW)
        paths[kind] = sorted(RAW.glob(f"{kind}.*.csv"))[-1]
    return paths


# ---------------------------------------------------------------------------
# 2. Filter to a single state
# ---------------------------------------------------------------------------
def _col(fieldnames, *needles):
    for n in fieldnames:
        low = n.lower()
        if all(part in low for part in needles):
            return n
    raise KeyError(f"no column matching {needles} in {fieldnames}")


def load_state(paths: dict[str, Path], state_code: int):
    districts, mandals, villages = {}, {}, []

    with open(paths["districts"], newline="", encoding="utf-8") as fh:
        rd = csv.DictReader(fh)
        c_state = _col(rd.fieldnames, "state code")
        c_dcode = _col(rd.fieldnames, "district code")
        c_dname = _col(rd.fieldnames, "district name")
        for row in rd:
            if int(row[c_state]) == state_code:
                code = int(row[c_dcode])
                districts[code] = {"code": code, "name": row[c_dname].strip()}

    with open(paths["subdistricts"], newline="", encoding="utf-8") as fh:
        rd = csv.DictReader(fh)
        c_state = _col(rd.fieldnames, "state code")
        c_dcode = _col(rd.fieldnames, "district code")
        c_scode = _col(rd.fieldnames, "sub-district code")
        c_sname = _col(rd.fieldnames, "sub-district name")
        for row in rd:
            if int(row[c_state]) == state_code:
                code = int(row[c_scode])
                mandals[code] = {"code": code, "name": row[c_sname].strip(),
                                 "district_code": int(row[c_dcode])}

    with open(paths["villages"], newline="", encoding="utf-8") as fh:
        rd = csv.DictReader(fh)
        c_state = _col(rd.fieldnames, "state code")
        c_scode = _col(rd.fieldnames, "sub-district code")
        c_vcode = _col(rd.fieldnames, "village code")
        c_vname = _col(rd.fieldnames, "village name", "english")
        c_cat = _col(rd.fieldnames, "village category")
        c_status = _col(rd.fieldnames, "village status")
        for row in rd:
            if int(row[c_state]) == state_code:
                villages.append({"code": int(row[c_vcode]), "name": row[c_vname].strip(),
                                 "mandal_code": int(row[c_scode]),
                                 "category": row[c_cat].strip(), "status": row[c_status].strip()})

    # village -> pincode (optional LGD mapping; joins by village code)
    pincodes = {}
    if paths.get("pincode_villages"):
        with open(paths["pincode_villages"], newline="", encoding="utf-8") as fh:
            rd = csv.DictReader(fh)
            c_state = _col(rd.fieldnames, "state code")
            c_vcode = _col(rd.fieldnames, "village code")
            c_pin = _col(rd.fieldnames, "pincode")
            for row in rd:
                if int(row[c_state]) == state_code:
                    pin = (row[c_pin] or "").strip()
                    if pin.isdigit():
                        pincodes[int(row[c_vcode])] = pin
    for v in villages:
        v["pincode"] = pincodes.get(v["code"], "")
    return districts, mandals, villages


# ---------------------------------------------------------------------------
# 3. Verify against live LGD (optional, non-fatal)
# ---------------------------------------------------------------------------
def verify_live(state_code, districts, mandals) -> dict:
    result = {"ran": True, "ok": None, "checks": [], "error": None}
    try:
        from lgd_client import LGDClient
        c = LGDClient()
        live = c.districts(state_code)
        ok = len(live) == len(districts)
        result["checks"].append({"check": "district count", "live": len(live),
                                 "dump": len(districts), "pass": ok})
        if live:
            d0 = live[0]
            live_m = len(c.sub_districts(d0["districtCode"]))
            dump_m = sum(1 for m in mandals.values() if m["district_code"] == d0["districtCode"])
            p = live_m == dump_m
            ok = ok and p
            result["checks"].append({"check": f"mandals in {d0['districtNameEnglish']}",
                                     "live": live_m, "dump": dump_m, "pass": p})
        result["ok"] = ok
    except Exception as e:
        result["ok"] = None
        result["error"] = f"{type(e).__name__}: {e}"
    return result


# ---------------------------------------------------------------------------
# 4. Emit per-state outputs + build the web app
# ---------------------------------------------------------------------------
def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def build_state(state_code, cfg, districts, mandals, villages, source_date, verify):
    state_dir = ROOT / cfg["slug"]
    web = state_dir / "web"
    web_data = web / "data"
    web_data.mkdir(parents=True, exist_ok=True)
    (state_dir / "data").mkdir(parents=True, exist_ok=True)

    d_sorted = sorted(districts.values(), key=lambda d: d["name"])
    d_index = {d["code"]: i for i, d in enumerate(d_sorted)}
    m_sorted = sorted((m for m in mandals.values() if m["district_code"] in d_index),
                      key=lambda m: (d_index[m["district_code"]], m["name"]))
    m_index = {m["code"]: i for i, m in enumerate(m_sorted)}

    d_counts = [0] * len(d_sorted)
    m_counts = [0] * len(m_sorted)
    rows, dropped = [], 0
    for v in villages:
        mi = m_index.get(v["mandal_code"])
        if mi is None:
            dropped += 1
            continue
        di = d_index[m_sorted[mi]["district_code"]]
        d_counts[di] += 1
        m_counts[mi] += 1
        cat = 0 if v["category"].lower().startswith("rural") else 1
        rows.append([v["name"], mi, v["code"], cat, v.get("pincode", "")])
    rows.sort(key=lambda r: norm(r[0]))
    with_pincode = sum(1 for r in rows if r[4])

    regions = {
        "state": cfg["name"], "state_code": state_code,
        "districts": [{"i": i, "n": d["name"], "c": d["code"], "vc": d_counts[i]}
                      for i, d in enumerate(d_sorted)],
        "mandals": [{"i": i, "n": m["name"], "c": m["code"],
                     "d": d_index[m["district_code"]], "vc": m_counts[i]}
                    for i, m in enumerate(m_sorted)],
    }
    villages_doc = {"columns": ["name", "mandal", "code", "cat", "pin"], "rows": rows}
    meta = {
        "state": cfg["name"], "state_code": state_code,
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Local Government Directory (lgdirectory.gov.in), Ministry of Panchayati Raj, Govt. of India",
        "source_mirror": "github.com/ramSeraph/opendata (LGD daily dump)",
        "source_date": source_date,
        "counts": {"districts": len(d_sorted), "mandals": len(m_sorted), "villages": len(rows),
                   "with_pincode": with_pincode},
        "dropped_villages_without_mandal": dropped,
        "verification": verify,
    }

    (web_data / "regions.json").write_text(json.dumps(regions, ensure_ascii=False, separators=(",", ":")))
    (web_data / "villages.json").write_text(json.dumps(villages_doc, ensure_ascii=False, separators=(",", ":")))
    (web_data / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))

    # flat CSV export
    with open(state_dir / "data" / f"{cfg['slug']}_villages.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["State", "District", "District Code", "Mandal", "Mandal Code",
                    "Village", "Village Code", "Pincode", "Category", "Status"])
        for v in sorted(villages, key=lambda x: x["name"]):
            mi = m_index.get(v["mandal_code"])
            if mi is None:
                continue
            m = m_sorted[mi]
            d = districts[m["district_code"]]
            w.writerow([cfg["name"], d["name"], d["code"], m["name"], m["code"],
                        v["name"], v["code"], v.get("pincode", ""), v["category"], v["status"]])

    _build_web(state_code, cfg, web, meta)
    return meta


def _build_web(state_code, cfg, web: Path, meta):
    # copy the single-source template files
    for fname in ("index.html", "styles.css", "app.js", "i18n.js", "nearby.js"):
        src = TEMPLATE / fname
        if src.exists():
            shutil.copyfile(src, web / fname)
    siblings = [{"name": c["name"], "slug": c["slug"], "url": f"../../{c['slug']}/web/index.html"}
                for sc, c in STATES.items() if sc != state_code]
    config = {
        "state": cfg["name"], "stateCode": state_code, "slug": cfg["slug"],
        "accent": cfg["accent"], "accentSoft": cfg["accentSoft"],
        "division": cfg.get("division", "mandal"),
        "siblings": siblings,
        "source": {"name": "Local Government Directory (LGD)", "url": "https://lgdirectory.gov.in",
                   "mirror": "https://github.com/ramSeraph/opendata"},
        "sourceDate": meta["source_date"], "generatedAt": meta["generated_at"],
        "counts": meta["counts"],
    }
    (web / "config.js").write_text(
        "/* generated by scraper/pipeline.py - do not edit */\n"
        "window.VF_CONFIG = " + json.dumps(config, ensure_ascii=False, indent=2) + ";\n"
    )


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Build AP/Telangana/Karnataka village datasets + web apps")
    ap.add_argument("--state", choices=["ap", "tg", "ka", "both"], default="both")
    ap.add_argument("--offline", action="store_true", help="reuse already-extracted raw CSVs")
    ap.add_argument("--no-verify", action="store_true", help="skip live LGD cross-check")
    args = ap.parse_args()

    targets = list(STATES) if args.state == "both" else [ALIAS[args.state]]
    paths = download_and_extract(args.offline)
    source_date = _source_date(paths)

    for sc in targets:
        cfg = STATES[sc]
        print(f"\n=== {cfg['name']} (state {sc}) ===")
        districts, mandals, villages = load_state(paths, sc)
        print(f"[filter] districts={len(districts)} mandals={len(mandals)} villages={len(villages)}")

        verify = {"ran": False, "ok": None, "checks": [], "error": "skipped"}
        if not args.no_verify:
            print("[verify] cross-checking against live LGD portal ...")
            verify = verify_live(sc, districts, mandals)
            for c in verify["checks"]:
                print(f"    {c['check']}: live={c['live']} dump={c['dump']} "
                      f"{'OK' if c['pass'] else 'MISMATCH'}")
            if verify["error"]:
                print(f"    (verification skipped: {verify['error']})")

        meta = build_state(sc, cfg, districts, mandals, villages, source_date, verify)
        print(f"[done] {cfg['slug']}/  ->  {meta['counts']['villages']} villages, "
              f"{meta['counts']['districts']} districts, {meta['counts']['mandals']} mandals")


def _source_date(paths):
    m = re.search(r"\.(\d{2}[A-Za-z]{3}\d{4})\.csv$", paths["villages"].name)
    return m.group(1) if m else "unknown"


if __name__ == "__main__":
    main()
