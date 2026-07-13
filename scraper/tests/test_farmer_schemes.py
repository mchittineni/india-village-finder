"""
Unit tests for the myScheme farmer-schemes fetcher
(scraper/fetch_farmer_schemes.py).

The fetcher's risky logic is the multi-language merge (English drives the
canonical list; other languages only contribute names, and briefs only for the
state's own language), the offset pagination, and the two failure contracts:
network trouble -> exit 75 (skip, keep last snapshot) vs a rejected API key
-> hard error (the public frontend key rotated; the workflow must go red).
These tests mock the network entirely and stub sleep so they run instantly.
"""

import sys
from pathlib import Path
from unittest import mock

import pytest

SCRAPER = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRAPER))

import fetch_farmer_schemes as m  # noqa: E402
import requests  # noqa: E402


class FakeResp:
    def __init__(self, status=200, payload=None):
        self.status_code = status
        self._payload = payload or {}
        self.headers = {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}", response=self)

    def json(self):
        return self._payload


def _page(items, total):
    return {
        "status": "Success",
        "data": {"summary": {"total": total}, "hits": {"items": items}},
    }


def _hit(slug, name, level="Central", brief="", tags=(), ministry=""):
    return {
        "fields": {
            "slug": slug,
            "schemeName": name,
            "briefDescription": brief,
            "level": level,
            "nodalMinistryName": ministry,
            "tags": list(tags),
        }
    }


class PagedSession:
    """Serves canned pages keyed by (lang, from); records every request."""

    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append(params)
        key = (params["lang"], params["from"])
        return FakeResp(200, self.pages[key])


@pytest.fixture(autouse=True)
def _no_sleep():
    with mock.patch.object(m.time, "sleep", lambda *_: None):
        yield


# --- multi-language merge ---------------------------------------------------
def test_build_state_schemes_merges_languages():
    state = {"name": "Andhra Pradesh", "slug": "andhra_pradesh", "lang": "te"}
    pages = {
        ("en", 0): _page(
            [
                _hit(
                    "pm-kisan",
                    "PM-KISAN",
                    brief="Income support.",
                    tags=list("abcdefgh"),  # 8 tags -> capped at 6
                    ministry="MoA&FW",
                ),
                _hit("rythu", "Rythu Scheme", level="State", brief="State aid."),
            ],
            2,
        )
    }
    for lang in m.LANGS[1:]:
        pages[(lang, 0)] = _page(
            [
                _hit("pm-kisan", f"PM-KISAN [{lang}]", brief=f"brief [{lang}]"),
                # a slug the English list doesn't know must be ignored
                _hit("ghost", f"Ghost [{lang}]"),
            ],
            2,
        )

    schemes = m.build_state_schemes(PagedSession(pages), state)

    assert [s["slug"] for s in schemes] == ["pm-kisan", "rythu"]  # en order
    pk = schemes[0]
    assert pk["level"] == "Central" and pk["ministry"] == "MoA&FW"
    assert len(pk["tags"]) == 6
    assert pk["name"]["en"] == "PM-KISAN"
    for lang in m.LANGS[1:]:
        assert pk["name"][lang] == f"PM-KISAN [{lang}]"
    # briefs ship only in English + the state's own language
    assert set(pk["brief"]) == {"en", "te"}
    assert pk["brief"]["te"] == "brief [te]"


# --- pagination ---------------------------------------------------------------
def test_fetch_lang_pages_paginates_by_offset():
    a = [_hit(f"s{i}", f"S{i}") for i in range(m.PAGE)]
    b = [_hit("last", "Last")]
    session = PagedSession({("en", 0): _page(a, m.PAGE + 1), ("en", m.PAGE): _page(b, m.PAGE + 1)})
    fields = m.fetch_lang_pages(session, "Andhra Pradesh", "en")
    assert len(fields) == m.PAGE + 1
    assert fields[-1]["slug"] == "last"
    assert [c["from"] for c in session.calls] == [0, m.PAGE]


# --- failure contracts --------------------------------------------------------
def test_get_rejected_key_raises_immediately():
    session = mock.Mock()
    session.get.return_value = FakeResp(401)
    with pytest.raises(RuntimeError, match="key rejected"):
        m._get(session, {"lang": "en", "from": 0})
    assert session.get.call_count == 1  # no pointless retries on auth errors


def test_get_retries_transient_5xx_then_succeeds():
    session = mock.Mock()
    session.get.side_effect = [FakeResp(502), FakeResp(200, _page([], 0))]
    data = m._get(session, {"lang": "en", "from": 0})
    assert data["status"] == "Success"
    assert session.get.call_count == 2


def test_main_exits_75_when_unreachable(tmp_path):
    session = mock.Mock()
    session.get.side_effect = requests.ConnectionError("down")
    session.__enter__ = lambda s: s
    session.__exit__ = lambda s, *a: False
    argv = ["fetch_farmer_schemes.py", "--out", str(tmp_path), "--state", "ap"]
    with mock.patch.object(m, "_session", return_value=session):
        with mock.patch.object(sys, "argv", argv):
            assert m.main() == 75


def test_main_exits_1_on_rejected_key(tmp_path):
    session = mock.Mock()
    session.get.return_value = FakeResp(403)
    session.__enter__ = lambda s: s
    session.__exit__ = lambda s, *a: False
    argv = ["fetch_farmer_schemes.py", "--out", str(tmp_path), "--state", "ap"]
    with mock.patch.object(m, "_session", return_value=session):
        with mock.patch.object(sys, "argv", argv):
            assert m.main() == 1
