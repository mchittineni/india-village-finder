#!/usr/bin/env python3
"""
lgd_datagov.py — pull LGD village data straight from the official Open Government
Data platform (data.gov.in), instead of the community ramSeraph mirror.

Why: the ramSeraph mirror scrapes lgdirectory.gov.in and breaks its captchas with
OCR. data.gov.in republishes the same LGD data as an official API — no captcha,
refreshed ~daily — so we can drop that extra hop and the captcha dependency.

Source resource: "Local Government Directory (LGD) - Villages with PIN Codes".
Each record carries state/district/subdistrict/village codes + English names +
pincode, which is everything the pipeline needs to build districts, subdistricts,
villages and the pincode mapping. (Village Category / local-script name are not in
this feed — the web app no longer shows the rural/urban badge, and local names are
covered by transliteration.)

We fetch per state (server-side filter) with offset pagination and write the same
four CSVs the pipeline already parses, so downstream code is unchanged.

API key: read from $DATA_GOV_KEY; falls back to data.gov.in's public sample key,
which is heavily rate-limited — register a free key at https://data.gov.in/ and
set DATA_GOV_KEY for real runs.
"""

from __future__ import annotations

import csv
import datetime as dt
import os
import time
from pathlib import Path

import requests

# "Local Government Directory (LGD) - Villages with PIN Codes"
RESOURCE_ID = "f17a1608-5f10-4610-bb50-a63c80d83974"
API_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
# data.gov.in's documented public sample key (rate-limited; override via env).
SAMPLE_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
PAGE = 1000  # rows per request

KINDS = ("districts", "subdistricts", "villages", "pincode_villages")


def _api_key() -> str:
    return os.environ.get("DATA_GOV_KEY") or SAMPLE_KEY


def _get(session: requests.Session, params: dict, retries: int = 5) -> dict:
    """GET one page with retry/backoff — data.gov.in returns transient 5xx/429."""
    for attempt in range(retries):
        try:
            resp = session.get(API_URL, params=params, timeout=90)
            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"{resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError):
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


def fetch_state_records(state_code: int, session: requests.Session) -> list[dict]:
    """Return all village records for one state via offset pagination.

    The page size is whatever the key allows (a registered key returns up to
    `limit`; the public sample key caps at 10), so we advance the offset by the
    number of rows actually returned rather than by the requested limit."""
    key = _api_key()
    out: list[dict] = []
    offset = 0
    total = None
    while True:
        data = _get(
            session,
            {
                "api-key": key,
                "format": "json",
                "limit": PAGE,
                "offset": offset,
                "filters[stateCode]": state_code,
            },
        )
        recs = data.get("records") or []
        if total is None:
            total = int(data.get("total") or 0)
        out.extend(recs)
        if not recs or len(out) >= total:
            break
        offset += len(recs)
    if total and len(out) < total:
        raise RuntimeError(
            f"state {state_code}: got {len(out)} of {total} records — "
            f"set a registered DATA_GOV_KEY (the sample key caps pages at 10 rows)"
        )
    return out


def _write_csvs(records: list[dict], raw: Path, date: str) -> dict[str, Path]:
    """Derive the four LGD CSVs (districts/subdistricts/villages/pincode_villages)
    from the flat village records, with headers the pipeline's column detection
    already understands."""
    districts: dict[tuple, str] = {}
    subdistricts: dict[tuple, str] = {}
    villages: dict[int, dict] = {}  # by village code (dedupe multi-pincode rows)
    for r in records:
        sc, dc = r.get("stateCode"), r.get("districtCode")
        sd, vc = r.get("subdistrictCode"), r.get("villageCode")
        if dc is not None:
            districts[(sc, dc)] = r.get("districtNameEnglish", "")
        if sd is not None:
            subdistricts[(sc, dc, sd)] = r.get("subdistrictNameEnglish", "")
        if vc is not None and vc not in villages:
            villages[vc] = r

    paths: dict[str, Path] = {}

    def dump(kind: str, header: list[str], rows):
        p = raw / f"{kind}.{date}.csv"
        with open(p, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(header)
            w.writerows(rows)
        paths[kind] = p

    dump(
        "districts",
        ["State Code", "District Code", "District Name (In English)"],
        ([sc, dc, name] for (sc, dc), name in sorted(districts.items())),
    )
    dump(
        "subdistricts",
        ["State Code", "District Code", "Sub-District Code", "Sub-District Name"],
        ([sc, dc, sd, name] for (sc, dc, sd), name in sorted(subdistricts.items())),
    )
    dump(
        "villages",
        ["State Code", "Sub-District Code", "Village Code", "Village Name (In English)"],
        (
            [r.get("stateCode"), r.get("subdistrictCode"), vc, r.get("villageNameEnglish", "")]
            for vc, r in sorted(villages.items())
        ),
    )
    dump(
        "pincode_villages",
        ["State Code", "Village Code", "Pincode"],
        (
            [r.get("stateCode"), vc, r.get("pincode")]
            for vc, r in sorted(villages.items())
            if r.get("pincode")
        ),
    )
    return paths


def fetch_datagov(state_codes, raw: Path, offline: bool = False) -> dict[str, Path]:
    """Fetch the given states from data.gov.in and write the LGD CSVs into ``raw``.
    With ``offline=True`` reuse the most recent already-written CSVs instead."""
    raw.mkdir(parents=True, exist_ok=True)
    if offline:
        paths = {}
        for kind in KINDS:
            found = sorted(raw.glob(f"{kind}.*.csv"))
            if found:
                paths[kind] = found[-1]
            elif kind != "pincode_villages":
                raise RuntimeError(f"--offline but no {kind} CSV in {raw}")
        print(f"[offline] using {', '.join(p.name for p in paths.values())}")
        return paths

    date = dt.date.today().strftime("%d%b%Y")
    records: list[dict] = []
    with requests.Session() as s:
        for sc in state_codes:
            recs = fetch_state_records(sc, s)
            print(f"[data.gov.in] state {sc}: {len(recs)} village records")
            records.extend(recs)
    paths = _write_csvs(records, raw, date)
    print(f"[data.gov.in] wrote {', '.join(p.name for p in paths.values())}")
    return paths
