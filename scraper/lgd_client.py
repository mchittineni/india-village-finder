"""
lgd_client.py
=============
A small, dependency-light client for the Local Government Directory (LGD)
DWR (Direct Web Remoting) endpoints used by the public "View Village" page at
https://lgdirectory.gov.in/globalviewvillageforcitizen.do

LGD exposes its State -> District -> Sub-District (Mandal) -> Village hierarchy
through DWR services. This module wraps the three calls we need:

    getDistrictList(stateCode)            -> districts in a state
    getSubDistrictList(districtCode)      -> sub-districts (mandals) in a district
    getVillageListbySubDistrictCode(sdc)  -> villages in a sub-district

Notes / gotchas discovered while reverse-engineering the endpoint:
  * Every call MUST send `instanceId=0` (a number). Without it the server
    returns a generic "bad request" HTML page or a SecurityException.
  * `scriptSessionId` must be present and non-empty for some services.
  * Overloaded Java methods (same name, multiple signatures) cannot be called
    by name, so we only use single-signature methods.
  * A live JSESSIONID cookie (fetched from the citizen page) is required.

This client is intentionally polite: it reuses one session, sets a real
User-Agent, and the caller (fetch.py) adds rate limiting + retries.
"""

from __future__ import annotations

import re
import time
import json
from typing import Any

import requests

BASE = "https://lgdirectory.gov.in"
CITIZEN_PAGE = f"{BASE}/globalviewvillageforcitizen.do"
DWR_CALL = f"{BASE}/dwr/call/plaincall/{{service}}.{{method}}.dwr"

# LGD numeric state codes
STATE_CODES = {
    "Andhra Pradesh": 28,
    "Telangana": 36,
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
)


class LGDError(RuntimeError):
    pass


class LGDClient:
    def __init__(self, request_timeout: int = 30):
        self.s = requests.Session()
        self.s.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-IN,en;q=0.9",
            }
        )
        self.timeout = request_timeout
        self._script_session = "lgdscrape0"
        self._warm()

    def _warm(self) -> None:
        """Hit the citizen page once to obtain a JSESSIONID cookie."""
        r = self.s.get(CITIZEN_PAGE, timeout=self.timeout)
        r.raise_for_status()

    # -- low level -----------------------------------------------------------
    def _dwr(self, service: str, method: str, param0: int) -> list[dict[str, Any]]:
        body = (
            "callCount=1\n"
            f"page=/globalviewvillageforcitizen.do\n"
            "httpSessionId=\n"
            f"scriptSessionId={self._script_session}\n"
            "instanceId=0\n"
            f"c0-scriptName={service}\n"
            f"c0-methodName={method}\n"
            "c0-id=0\n"
            f"c0-param0=number:{int(param0)}\n"
            "batchId=0\n"
        )
        url = DWR_CALL.format(service=service, method=method)
        r = self.s.post(
            url,
            data=body.encode("utf-8"),
            headers={
                "Content-Type": "text/plain",
                "Referer": CITIZEN_PAGE,
                "Origin": BASE,
                "X-Requested-With": "XMLHttpRequest",
            },
            timeout=self.timeout,
        )
        r.raise_for_status()
        text = r.text
        if "handleBatchException" in text or "BadRequest" in text or "badrequest" in text.lower():
            msg = re.search(r"message:'([^']*)'", text)
            raise LGDError(
                f"{service}.{method}({param0}) failed: "
                f"{msg.group(1) if msg else 'unknown DWR error'}"
            )
        return _parse_dwr_objects(text)

    # -- high level ----------------------------------------------------------
    def districts(self, state_code: int) -> list[dict[str, Any]]:
        return self._dwr("lgdDwrDistrictService", "getDistrictList", state_code)

    def sub_districts(self, district_code: int) -> list[dict[str, Any]]:
        return self._dwr("lgdDwrSubDistrictService", "getSubDistrictList", district_code)

    def villages(self, sub_district_code: int) -> list[dict[str, Any]]:
        # getVillageList(subDistrictCode) is the single-signature method that the
        # public page uses; the *bySubDistrictCode variants are overloaded and
        # cannot be invoked by name over DWR.
        return self._dwr("lgdDwrVillageService", "getVillageList", sub_district_code)


# --------------------------------------------------------------------------
# DWR response parsing
# --------------------------------------------------------------------------
# A DWR plaincall reply looks like:
#   //#DWR-REPLY
#   //#DWR-START#
#   (function(){ ...
#   dwr.engine.remote.handleCallback("0","0",[{districtCode:745,...},{...}]);
#   })();
# We extract the JS array literal passed to handleCallback and convert the
# unquoted-key JS object notation into JSON.

_CALLBACK_RE = re.compile(r"handleCallback\(\s*\"[^\"]*\"\s*,\s*\"[^\"]*\"\s*,\s*", re.S)


def _parse_dwr_objects(text: str) -> list[dict[str, Any]]:
    m = _CALLBACK_RE.search(text)
    if not m:
        # No callback => empty result (some sub-districts have no villages yet)
        return []
    # The array literal starts right after the matched prefix.
    start = m.end()
    arr = _extract_balanced(text, start, "[", "]")
    if arr is None:
        return []
    return _jsobj_to_python(arr)


def _extract_balanced(s: str, start: int, open_ch: str, close_ch: str) -> str | None:
    if start >= len(s) or s[start] != open_ch:
        return None
    depth = 0
    in_str = False
    quote = ""
    esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                in_str = False
            continue
        if ch in ("'", '"'):
            in_str = True
            quote = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    return None


def _jsobj_to_python(js: str) -> list[dict[str, Any]]:
    """Convert a JS array-of-objects literal (unquoted keys, single quotes,
    possible `null`) into Python data. We avoid eval by normalising to JSON."""
    # Replace JS Date constructors:  new Date(1649023200000) -> 1649023200000
    out = re.sub(r"new Date\((\d+)\)", r"\1", js)
    out = re.sub(r"new Date\(\s*\)", "null", out)
    # Quote unquoted object keys:  {districtCode:745}  ->  {"districtCode":745}
    out = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', out)

    # Convert single-quoted string values to double-quoted (escape inner ")
    def _sq(match: re.Match) -> str:
        inner = match.group(1).replace('"', '\\"')
        return '"' + inner + '"'

    out = re.sub(r"'((?:[^'\\]|\\.)*)'", _sq, out)
    # DWR references (e.g. _0:{...}) are rare here; strip trailing commas
    out = re.sub(r",\s*([}\]])", r"\1", out)
    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        raise LGDError(f"Could not parse DWR payload: {e}\n---\n{out[:400]}")


if __name__ == "__main__":
    # quick smoke test
    c = LGDClient()
    ds = c.districts(STATE_CODES["Andhra Pradesh"])
    print(f"AP districts: {len(ds)} (sample: {ds[0] if ds else None})")
