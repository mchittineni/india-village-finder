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
1. FETCH  the latest LGD (Local Government Directory) village data straight from
   the official Open Government Data platform API (data.gov.in) — no captcha,
   refreshed ~daily; see scraper/lgd_datagov.py. Four CSVs land in
   scraper/.cache/raw/.
2. For EACH state (Andhra Pradesh = 28, Telangana = 36):
     FILTER  rows to that state.
     VERIFY  district/mandal counts against the LIVE LGD portal (non-fatal).
     EMIT    <state>/web/data/{regions,villages,meta}.json
             <state>/data/<state>_villages.csv
     BUILD   copy web_template into <state>/web/ and write config.js.

Run:  python pipeline.py                  (both states, data.gov.in API)
      python pipeline.py --state ap       (only Andhra Pradesh)
      python pipeline.py --offline        (reuse already-fetched raw CSVs)
      python pipeline.py --no-verify      (skip the live LGD cross-check)

A free data.gov.in API key in $DATA_GOV_KEY is required for real runs (the public
sample key caps responses at 10 rows). Register at https://data.gov.in/.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from lgd_datagov import DataGovUnavailable, fetch_datagov

HERE = Path(__file__).resolve().parent  # scraper/
ROOT = HERE.parent  # Village Finder/
RAW = HERE / ".cache" / "raw"
TEMPLATE = HERE / "web_template"

# One config block per state. `slug` is the folder name. `division` is the local
# name for a sub-district (Mandal in AP/Telangana, Taluk in Karnataka/Tamil Nadu) —
# the web app uses it to label that tier correctly. `lang` is the state's official
# language: where LGD publishes a village's name in that script we ship it as an
# authoritative name (preferred over machine transliteration when that language is
# selected).
STATES = {
    28: {
        "name": "Andhra Pradesh",
        "slug": "andhra_pradesh",
        "lang": "te",
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
        "accent": "#0f9d58",
        "accentSoft": "#e3f6ec",
        "division": "mandal",
    },
    29: {
        "name": "Karnataka",
        "slug": "karnataka",
        "lang": "kn",
        "accent": "#d97706",
        "accentSoft": "#fdeccf",
        "division": "taluk",
    },
    33: {
        "name": "Tamil Nadu",
        "slug": "tamil_nadu",
        "lang": "ta",
        "accent": "#dc2626",
        "accentSoft": "#fdeaea",
        "division": "taluk",
    },
}

# Unicode block per language script — used to validate that an LGD "local" name is
# actually in the expected script (some states' local column is blank or Latin).
SCRIPT_RANGE = {
    "te": (0x0C00, 0x0C7F),  # Telugu
    "kn": (0x0C80, 0x0CFF),  # Kannada
    "ta": (0x0B80, 0x0BFF),  # Tamil
    "hi": (0x0900, 0x097F),  # Devanagari
}


def in_script(s: str, lang: str) -> bool:
    rng = SCRIPT_RANGE.get(lang)
    if not rng or not s:
        return False
    lo, hi = rng
    return any(lo <= ord(c) <= hi for c in s)


def transliterate_batch(lang: str, names: list[str]) -> dict[str, str]:
    """Transliterate English names into `lang`'s script via the web app's engine
    (web_template/i18n.js, through translit_cli.mjs) — one shared implementation.
    Returns {name: native}; empty on any failure (e.g. node unavailable), so the
    caller cleanly falls back to LGD-only native names."""
    names = list(names)
    if not lang or not names or shutil.which("node") is None:
        return {}
    try:
        proc = subprocess.run(
            ["node", str(HERE / "translit_cli.mjs")],
            input=json.dumps({"lang": lang, "names": names}),
            capture_output=True,
            text=True,
            timeout=180,
            check=True,
        )
        out = json.loads(proc.stdout)
        return {n: out[i] for i, n in enumerate(names) if i < len(out)}
    except Exception as e:  # pragma: no cover - environment dependent
        print(
            f"[warn] transliteration unavailable ({type(e).__name__}); "
            f"native CSV names limited to LGD-published ones"
        )
        return {}


ALIAS = {
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

csv.field_size_limit(10_000_000)


# ---------------------------------------------------------------------------
# 1. Fetch LGD data (data.gov.in official API — see scraper/lgd_datagov.py)
# ---------------------------------------------------------------------------


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
                mandals[code] = {
                    "code": code,
                    "name": row[c_sname].strip(),
                    "district_code": int(row[c_dcode]),
                }

    with open(paths["villages"], newline="", encoding="utf-8") as fh:
        rd = csv.DictReader(fh)
        c_state = _col(rd.fieldnames, "state code")
        c_scode = _col(rd.fieldnames, "sub-district code")
        c_vcode = _col(rd.fieldnames, "village code")
        c_vname = _col(rd.fieldnames, "village name", "english")
        # Category / status / local name aren't in the data.gov.in feed (the app
        # no longer shows the rural/urban badge); tolerate their absence.
        try:
            c_cat = _col(rd.fieldnames, "village category")
        except KeyError:
            c_cat = None
        try:
            c_status = _col(rd.fieldnames, "village status")
        except KeyError:
            c_status = None
        try:
            c_vlocal = _col(rd.fieldnames, "village name", "local")
        except KeyError:
            c_vlocal = None
        for row in rd:
            if int(row[c_state]) == state_code:
                villages.append(
                    {
                        "code": int(row[c_vcode]),
                        "name": row[c_vname].strip(),
                        "local": (row[c_vlocal].strip() if c_vlocal else ""),
                        "mandal_code": int(row[c_scode]),
                        "category": (row[c_cat].strip() if c_cat else ""),
                        "status": (row[c_status].strip() if c_status else ""),
                    }
                )

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
        result["checks"].append(
            {"check": "district count", "live": len(live), "dump": len(districts), "pass": ok}
        )
        if live:
            d0 = live[0]
            live_m = len(c.sub_districts(d0["districtCode"]))
            dump_m = sum(1 for m in mandals.values() if m["district_code"] == d0["districtCode"])
            p = live_m == dump_m
            ok = ok and p
            result["checks"].append(
                {
                    "check": f"mandals in {d0['districtNameEnglish']}",
                    "live": live_m,
                    "dump": dump_m,
                    "pass": p,
                }
            )
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


def _csv_cell(value):
    """Neutralise CSV formula/DDE injection in the released CSVs: spreadsheet apps
    treat a cell starting with = + - @ (or a leading tab/CR) as a formula. Prefix
    such values with a single quote so they render literally. Defence-in-depth —
    the data is government-sourced, but the CSVs are published downloads."""
    s = "" if value is None else str(value)
    if s[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


def build_state(state_code, cfg, districts, mandals, villages, source_date, verify):
    state_dir = ROOT / cfg["slug"]
    web = state_dir / "web"
    web_data = web / "data"
    web_data.mkdir(parents=True, exist_ok=True)
    (state_dir / "data").mkdir(parents=True, exist_ok=True)

    d_sorted = sorted(districts.values(), key=lambda d: d["name"])
    d_index = {d["code"]: i for i, d in enumerate(d_sorted)}
    m_sorted = sorted(
        (m for m in mandals.values() if m["district_code"] in d_index),
        key=lambda m: (d_index[m["district_code"]], m["name"]),
    )
    m_index = {m["code"]: i for i, m in enumerate(m_sorted)}

    d_counts = [0] * len(d_sorted)
    m_counts = [0] * len(m_sorted)
    rows, dropped = [], 0
    names_local = {}  # villageCode -> authoritative native name
    state_lang = cfg.get("lang")
    for v in villages:
        mi = m_index.get(v["mandal_code"])
        if mi is None:
            dropped += 1
            continue
        di = d_index[m_sorted[mi]["district_code"]]
        d_counts[di] += 1
        m_counts[mi] += 1
        # Category is unavailable from data.gov.in; default unknown -> 0 (the app
        # no longer renders a rural/urban badge). Still set 1 if explicitly urban.
        cat = 1 if v["category"].lower().startswith("urban") else 0
        rows.append([v["name"], mi, v["code"], cat, v.get("pincode", "")])
        # Keep the LGD-published local name only when it is genuinely in the
        # state's script (some states leave it blank or fill it with Latin text).
        loc = v.get("local", "")
        if loc and in_script(loc, state_lang):
            names_local[str(v["code"])] = loc
    rows.sort(key=lambda r: norm(r[0]))
    with_pincode = sum(1 for r in rows if r[4])

    # The current LGD source (data.gov.in) doesn't carry the in-script name column,
    # so names_local can come back empty. Don't overwrite previously-committed
    # authoritative names with an empty file — keep them until a source that
    # publishes them is wired back in. `effective_local` is what actually ends up on
    # disk (this run's names, or the preserved committed set), used for the map,
    # the meta count and the CSV so all three stay consistent.
    names_path = web_data / "names.json"
    write_names = bool(names_local) or not names_path.exists()
    if write_names:
        effective_local = names_local
    else:
        try:
            effective_local = json.loads(names_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            effective_local = {}

    regions = {
        "state": cfg["name"],
        "state_code": state_code,
        "districts": [
            {"i": i, "n": d["name"], "c": d["code"], "vc": d_counts[i]}
            for i, d in enumerate(d_sorted)
        ],
        "mandals": [
            {
                "i": i,
                "n": m["name"],
                "c": m["code"],
                "d": d_index[m["district_code"]],
                "vc": m_counts[i],
            }
            for i, m in enumerate(m_sorted)
        ],
    }
    villages_doc = {"columns": ["name", "mandal", "code", "cat", "pin"], "rows": rows}
    meta = {
        "state": cfg["name"],
        "state_code": state_code,
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Local Government Directory (lgdirectory.gov.in), Ministry of Panchayati Raj, Govt. of India",
        "source_mirror": "data.gov.in (Open Government Data platform, LGD API)",
        "source_date": source_date,
        "counts": {
            "districts": len(d_sorted),
            "mandals": len(m_sorted),
            "villages": len(rows),
            "with_pincode": with_pincode,
            "with_local_names": len(effective_local),
        },
        "native_lang": state_lang,
        "dropped_villages_without_mandal": dropped,
        "verification": verify,
    }

    (web_data / "regions.json").write_text(
        json.dumps(regions, ensure_ascii=False, separators=(",", ":"))
    )
    (web_data / "villages.json").write_text(
        json.dumps(villages_doc, ensure_ascii=False, separators=(",", ":"))
    )
    if write_names:
        names_path.write_text(json.dumps(names_local, ensure_ascii=False, separators=(",", ":")))
    # else: keep the committed authoritative names.json (this source has no in-script names)
    (web_data / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))

    # flat CSV export. Every village gets a name in the state's script: the
    # authoritative LGD spelling where published, else a best-effort
    # transliteration (same engine as the UI). "Native Source" records which.
    writable = [v for v in villages if m_index.get(v["mandal_code"]) is not None]
    needs_translit = sorted(
        {v["name"] for v in writable if not in_script(v.get("local", ""), state_lang)}
    )
    translit = transliterate_batch(state_lang, needs_translit)
    # Prefer the committed NEURAL native names (web/data/names_translit.json, produced
    # offline by enrich_native_names.py) over the rule engine, so the CSV agrees with
    # the map. Absent file → rule engine only. Reading a plain JSON keeps this build
    # (and CI) free of the heavy IndicXlit dependency.
    neural_native = {}
    nt_path = web_data / "names_translit.json"
    if nt_path.exists():
        try:
            neural_native = json.loads(nt_path.read_text(encoding="utf-8"))
        except Exception:
            neural_native = {}
    with open(
        state_dir / "data" / f"{cfg['slug']}_villages.csv", "w", newline="", encoding="utf-8"
    ) as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "State",
                "District",
                "District Code",
                "Mandal",
                "Mandal Code",
                "Village",
                "Village (Native)",
                "Native Source",
                "Village Code",
                "Pincode",
                "Category",
                "Status",
            ]
        )
        for v in sorted(writable, key=lambda x: x["name"]):
            m = m_sorted[m_index[v["mandal_code"]]]
            d = districts[m["district_code"]]
            # Prefer this run's local name, else the preserved authoritative name
            # (keeps the CSV consistent with the map's names.json).
            loc = v.get("local", "") or effective_local.get(str(v["code"]), "")
            if in_script(loc, state_lang):
                native, source = loc, "LGD"
            else:
                native = neural_native.get(str(v["code"])) or translit.get(v["name"], "")
                source = "transliterated" if native else ""
            w.writerow(
                [
                    _csv_cell(x)
                    for x in (
                        cfg["name"],
                        d["name"],
                        d["code"],
                        m["name"],
                        m["code"],
                        v["name"],
                        native,
                        source,
                        v["code"],
                        v.get("pincode", ""),
                        v["category"],
                        v["status"],
                    )
                ]
            )

    _build_web(state_code, cfg, web, meta)
    return meta


def _build_web(state_code, cfg, web: Path, meta):
    # copy the single-source template files
    for fname in ("index.html", "styles.css", "app.js", "i18n.js", "nearby.js"):
        src = TEMPLATE / fname
        if src.exists():
            shutil.copyfile(src, web / fname)
    siblings = [
        {"name": c["name"], "slug": c["slug"], "url": f"../../{c['slug']}/web/index.html"}
        for sc, c in STATES.items()
        if sc != state_code
    ]
    config = {
        "state": cfg["name"],
        "stateCode": state_code,
        "slug": cfg["slug"],
        "accent": cfg["accent"],
        "accentSoft": cfg["accentSoft"],
        "division": cfg.get("division", "mandal"),
        "nativeLang": cfg.get("lang"),
        "cadastre": cfg.get("cadastre"),  # None for states without a parcel layer
        "siblings": siblings,
        "source": {
            "name": "Local Government Directory (LGD)",
            "url": "https://lgdirectory.gov.in",
            "mirror": "https://data.gov.in/ (Open Government Data platform)",
        },
        "sourceDate": meta["source_date"],
        "generatedAt": meta["generated_at"],
        "counts": meta["counts"],
    }
    (web / "config.js").write_text(
        "/* generated by scraper/pipeline.py - do not edit */\n"
        "window.VF_CONFIG = " + json.dumps(config, ensure_ascii=False, indent=2) + ";\n"
    )


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(
        description="Build AP/Telangana/Karnataka/Tamil Nadu village datasets + web apps"
    )
    ap.add_argument("--state", choices=["ap", "tg", "ka", "tn", "both"], default="both")
    ap.add_argument("--offline", action="store_true", help="reuse already-extracted raw CSVs")
    ap.add_argument("--no-verify", action="store_true", help="skip live LGD cross-check")
    args = ap.parse_args()

    targets = list(STATES) if args.state == "both" else [ALIAS[args.state]]
    try:
        paths = fetch_datagov(targets, RAW, args.offline)
    except DataGovUnavailable as e:
        # Transient upstream outage — exit EX_TEMPFAIL (75) so the scheduled
        # workflow can treat it as a skip (no data written, no PR) rather than a
        # hard failure. A genuine bug would exit 1 as usual.
        print(f"[skip] {e}")
        sys.exit(75)
    source_date = _source_date(paths)

    for sc in targets:
        cfg = STATES[sc]
        print(f"\n=== {cfg['name']} (state {sc}) ===")
        districts, mandals, villages = load_state(paths, sc)
        print(
            f"[filter] districts={len(districts)} mandals={len(mandals)} villages={len(villages)}"
        )

        verify = {"ran": False, "ok": None, "checks": [], "error": "skipped"}
        if not args.no_verify:
            print("[verify] cross-checking against live LGD portal ...")
            verify = verify_live(sc, districts, mandals)
            for c in verify["checks"]:
                print(
                    f"    {c['check']}: live={c['live']} dump={c['dump']} "
                    f"{'OK' if c['pass'] else 'MISMATCH'}"
                )
            if verify["error"]:
                print(f"    (verification skipped: {verify['error']})")

        meta = build_state(sc, cfg, districts, mandals, villages, source_date, verify)
        print(
            f"[done] {cfg['slug']}/  ->  {meta['counts']['villages']} villages, "
            f"{meta['counts']['districts']} districts, {meta['counts']['mandals']} mandals"
        )


def _source_date(paths):
    m = re.search(r"\.(\d{2}[A-Za-z]{3}\d{4})\.csv$", paths["villages"].name)
    return m.group(1) if m else "unknown"


if __name__ == "__main__":
    main()
