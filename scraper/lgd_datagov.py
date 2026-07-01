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


def _get(session: requests.Session, params: dict, retries: int = 8) -> dict:
    """GET one page with retry/backoff — data.gov.in regularly returns transient
    5xx/429 and dropped connections. Back off exponentially (honouring any
    ``Retry-After`` header) so a flaky upstream doesn't fail the whole run."""
    delay = 3.0
    last: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session.get(API_URL, params=params, timeout=90)
            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            last = e
            if attempt == retries - 1:
                break
            wait = delay
            resp = getattr(e, "response", None)
            if resp is not None:
                try:
                    wait = max(wait, float(resp.headers.get("Retry-After", 0)))
                except (TypeError, ValueError):
                    pass
            print(f"  [retry] {e} — waiting {min(wait, 60.0):.0f}s "
                  f"(attempt {attempt + 1}/{retries})")
            time.sleep(min(wait, 60.0))
            delay = min(delay * 2, 60.0)
    assert last is not None
    raise last


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


class DataGovUnavailable(RuntimeError):
    """data.gov.in was unreachable after retries and no cached CSVs exist to reuse.

    Signals a *transient* upstream outage (as opposed to a bug), so a scheduled
    caller can treat it as a skip rather than a hard failure."""


def _reuse_csvs(raw: Path, why: str) -> dict[str, Path]:
    """Reuse the most recent already-written CSVs in ``raw`` — used by ``--offline``
    and as a fallback when the live API is unreachable but a prior fetch is cached."""
    paths: dict[str, Path] = {}
    for kind in KINDS:
        found = sorted(raw.glob(f"{kind}.*.csv"))
        if found:
            paths[kind] = found[-1]
        elif kind != "pincode_villages":
            raise RuntimeError(f"{why}: no cached {kind} CSV in {raw}")
    print(f"[{why}] using {', '.join(p.name for p in paths.values())}")
    return paths


def fetch_datagov(state_codes, raw: Path, offline: bool = False) -> dict[str, Path]:
    """Fetch the given states from data.gov.in and write the LGD CSVs into ``raw``.
    With ``offline=True`` reuse the most recent already-written CSVs instead.

    On a transient upstream failure, fall back to cached CSVs if any exist;
    otherwise raise :class:`DataGovUnavailable` so the caller can skip this run
    rather than crash."""
    raw.mkdir(parents=True, exist_ok=True)
    if offline:
        return _reuse_csvs(raw, "offline")

    date = dt.date.today().strftime("%d%b%Y")
    records: list[dict] = []
    try:
        with requests.Session() as s:
            for sc in state_codes:
                recs = fetch_state_records(sc, s)
                print(f"[data.gov.in] state {sc}: {len(recs)} village records")
                records.extend(recs)
    except requests.RequestException as e:
        try:
            paths = _reuse_csvs(raw, "data.gov.in unreachable, reusing cache")
        except RuntimeError:
            raise DataGovUnavailable(
                f"data.gov.in unreachable and no cached CSVs to fall back on: {e}"
            ) from e
        print(f"[data.gov.in] WARNING: live fetch failed ({e}); reused cached CSVs")
        return paths

    paths = _write_csvs(records, raw, date)
    print(f"[data.gov.in] wrote {', '.join(p.name for p in paths.values())}")
    return paths
