#!/usr/bin/env python3
"""
fetch_mandi_prices.py — pull today's mandi (APMC market) commodity prices from
the data.gov.in Agmarknet resource and write one compact JSON per state for the
web app's prices panel.

Source resource: "Current Daily Price of Various Commodities from Various
Markets (Mandi)" — a rolling snapshot refreshed by Agmarknet through the day.
Each record: state / district / market / commodity / variety / grade /
arrival_date + min/max/modal price in ₹ per quintal.

The output is intentionally NOT committed to main: prices churn every day, so
.github/workflows/update-mandi-prices.yml publishes the JSONs to the dedicated
`data/mandi-prices` branch, which the app fetches at runtime via
raw.githubusercontent.com (CORS-enabled). Rows ship as arrays (see `columns`)
to keep the payload small; TN alone is ~7k records on a busy day.

API key: same DATA_GOV_KEY as the LGD fetch (falls back to the public sample
key, which caps pages at 10 rows — fine for a smoke test only).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import requests

from config import STATES, resolve_codes
from lgd_datagov import USER_AGENT, _api_key, _get

RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"
API_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
PAGE = 1000

COLUMNS = [
    "district",
    "market",
    "commodity",
    "variety",
    "grade",
    "arrival_date",
    "min_price",
    "max_price",
    "modal_price",
]


def fetch_state_prices(state_name: str, session: requests.Session) -> list[list]:
    """Return today's price rows for one state (server-side filter), as arrays
    in COLUMNS order. Pagination advances by rows actually returned (the sample
    key caps pages at 10 rows)."""
    key = _api_key()
    rows: list[list] = []
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
                "filters[state]": state_name,
            },
            url=API_URL,
        )
        recs = data.get("records") or []
        if total is None:
            total = int(data.get("total") or 0)
        rows.extend([r.get(c) for c in COLUMNS] for r in recs)
        if not recs or len(rows) >= total:
            break
        offset += len(recs)
    return rows


def write_state_json(state: dict, rows: list[list], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{state['slug']}.json"
    payload = {
        "state": state["name"],
        "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "unit": "₹/quintal",
        "columns": COLUMNS,
        "rows": rows,
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("mandi_prices"),
        help="output directory for the per-state JSONs",
    )
    ap.add_argument("--state", default="all", help="state alias/slug (e.g. ap) — default all")
    args = ap.parse_args()

    try:
        states = [STATES[c] for c in resolve_codes(args.state)]
    except ValueError as e:
        ap.error(str(e))

    try:
        with requests.Session() as s:
            s.headers["User-Agent"] = USER_AGENT
            for st in states:
                rows = fetch_state_prices(st["name"], s)
                path = write_state_json(st, rows, args.out)
                print(f"[mandi] {st['name']}: {len(rows)} rows -> {path}")
    except requests.RequestException as e:
        # Same skip contract as the LGD fetch: scheduled callers treat exit 75
        # as "upstream temporarily down", not a bug.
        print(f"[skip] data.gov.in unreachable: {e}", file=sys.stderr)
        return 75
    return 0


if __name__ == "__main__":
    sys.exit(main())
