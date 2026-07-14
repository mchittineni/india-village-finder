#!/usr/bin/env python3
"""
fetch_farmer_schemes.py — pull the government schemes relevant to farmers for
each state from myScheme (myscheme.gov.in, Digital India / NeGD) and write one
compact JSON per state for the web app's schemes panel.

Source: the myScheme public search API (api.myscheme.gov.in/search/v6) — the
same endpoint the myscheme.gov.in frontend calls, authenticated by the public
client key embedded in that frontend (override via $MYSCHEME_API_KEY if it
rotates). Per state we take the "Agriculture,Rural & Environment" category for
the state's own schemes plus the Central (beneficiaryState "All") ones, and
fetch localized scheme names for every UI language the app ships (the API
serves en/hi/te/kn/ta/ur and more via ``lang``).

The output is intentionally NOT committed to main: like the mandi snapshot it
is regenerable upstream data, so .github/workflows/update-farmer-schemes.yml
publishes the JSONs weekly to the dedicated `data/farmer-schemes` branch, which
the app fetches at runtime via raw.githubusercontent.com (CORS-enabled).

Exit codes follow the shared skip contract: 75 (EX_TEMPFAIL) when myScheme is
temporarily unreachable (keep the previous snapshot), 1 when the API key is
rejected (needs a code/secret fix, so the workflow should go red).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

import requests

from config import STATES, resolve_codes
from lgd_datagov import USER_AGENT

API_URL = "https://api.myscheme.gov.in/search/v6/schemes"
# Public client key shipped inside the myscheme.gov.in frontend bundle (the
# API also requires the site's Origin/Referer). Not a secret — but it can
# rotate with a frontend release, hence the env override.
PUBLIC_KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
CATEGORY = "Agriculture,Rural & Environment"
# Every UI language of the app (web_template/i18n.js). Scheme names ship in all
# of them; the longer briefs only in English + the state's own language, to
# keep the per-state payload small.
LANGS = ("en", "te", "hi", "kn", "ta", "ml", "ur")
PAGE = 50
MAX_SCHEMES = 1000  # sanity cap — a state+central agri list is well under this
PAUSE = 0.25  # politeness gap between requests, seconds


def _api_key() -> str:
    return os.environ.get("MYSCHEME_API_KEY") or PUBLIC_KEY


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": USER_AGENT,
            "x-api-key": _api_key(),
            # The API gate checks for the site's own Origin/Referer.
            "Origin": "https://www.myscheme.gov.in",
            "Referer": "https://www.myscheme.gov.in/",
            "Accept": "application/json",
        }
    )
    return s


def _get(session: requests.Session, params: dict, retries: int = 4) -> dict:
    """GET one search page with retry/backoff. 401/403 mean the client key was
    rejected (rotated upstream) — that is a hard error, not an outage, so it
    raises RuntimeError immediately instead of retrying."""
    delay = 3.0
    last: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session.get(API_URL, params=params, timeout=60)
            if resp.status_code in (401, 403):
                raise RuntimeError(
                    f"myScheme API key rejected (HTTP {resp.status_code}) — "
                    "the frontend key rotated; set MYSCHEME_API_KEY or update PUBLIC_KEY"
                )
            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            last = e
            if attempt == retries - 1:
                break
            print(f"[retry] {e} — waiting {delay:.0f}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    assert last is not None
    raise last


def _query(state_name: str) -> str:
    """The search filter: the state's own schemes + Central ("All") ones, in
    the agriculture category."""
    return json.dumps(
        [
            {"identifier": "beneficiaryState", "value": state_name},
            {"identifier": "beneficiaryState", "value": "All"},
            {"identifier": "schemeCategory", "value": CATEGORY},
        ]
    )


def fetch_lang_pages(session: requests.Session, state_name: str, lang: str) -> list[dict]:
    """Return every scheme's `fields` dict for one state+language, paginated."""
    fields: list[dict] = []
    offset = 0
    total = None
    while True:
        data = _get(
            session,
            {
                "lang": lang,
                "q": _query(state_name),
                "keyword": "",
                "sort": "",
                "from": offset,
                "size": PAGE,
            },
        )
        payload = (data.get("data") or {}) if isinstance(data, dict) else {}
        items = ((payload.get("hits") or {}).get("items")) or []
        if total is None:
            total = int(((payload.get("summary") or {}).get("total")) or 0)
        fields.extend(it.get("fields") or {} for it in items)
        offset += len(items)
        if not items or offset >= min(total, MAX_SCHEMES):
            break
        time.sleep(PAUSE)
    return fields


def build_state_schemes(session: requests.Session, state: dict) -> list[dict]:
    """Assemble the merged, multilingual scheme list for one state. English
    drives the canonical list/order; other languages contribute localized
    names (and, for the state's own language, the brief)."""
    native = state.get("lang")
    schemes: dict[str, dict] = {}
    order: list[str] = []
    for lang in LANGS:
        for f in fetch_lang_pages(session, state["name"], lang):
            slug = f.get("slug") or ""
            if not slug:
                continue
            name = (f.get("schemeName") or "").strip()
            brief = (f.get("briefDescription") or "").strip()
            if lang == "en":
                if slug not in schemes:
                    order.append(slug)
                schemes[slug] = {
                    "slug": slug,
                    "level": f.get("level") or "",
                    "ministry": f.get("nodalMinistryName") or "",
                    "tags": (f.get("tags") or [])[:6],
                    "name": {"en": name},
                    "brief": {"en": brief},
                }
            elif slug in schemes:
                if name:
                    schemes[slug]["name"][lang] = name
                if brief and lang == native:
                    schemes[slug]["brief"][lang] = brief
        time.sleep(PAUSE)
    return [schemes[s] for s in order]


def write_state_json(state: dict, schemes: list[dict], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{state['slug']}.json"
    payload = {
        "state": state["name"],
        "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "myScheme (myscheme.gov.in)",
        "langs": list(LANGS),
        "schemes": schemes,
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("farmer_schemes"),
        help="output directory for the per-state JSONs",
    )
    ap.add_argument("--state", default="all", help="state alias/slug (e.g. ap) — default all")
    args = ap.parse_args()

    try:
        states = [STATES[c] for c in resolve_codes(args.state)]
    except ValueError as e:
        ap.error(str(e))

    try:
        with _session() as s:
            for st in states:
                schemes = build_state_schemes(s, st)
                path = write_state_json(st, schemes, args.out)
                print(f"[schemes] {st['name']}: {len(schemes)} schemes -> {path}")
    except requests.RequestException as e:
        # Same skip contract as the LGD/mandi fetches: exit 75 = upstream
        # temporarily down, keep the previous snapshot.
        print(f"[skip] myScheme unreachable: {e}", file=sys.stderr)
        return 75
    except RuntimeError as e:
        print(f"[error] {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
