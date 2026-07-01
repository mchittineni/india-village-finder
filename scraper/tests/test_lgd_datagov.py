"""
Unit tests for the data.gov.in LGD fetcher (scraper/lgd_datagov.py) and the
pipeline's handling of a transient upstream outage.

data.gov.in is flaky (transient 5xx), so the retry/backoff, offset pagination,
cached-CSV fallback and DataGovUnavailable skip are the logic most likely to
break silently. These tests mock the network entirely (no live calls) and stub
sleep so they run instantly.
"""

import csv
import sys
from pathlib import Path
from unittest import mock

import pytest

SCRAPER = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRAPER))

import lgd_datagov as m  # noqa: E402
import requests  # noqa: E402


class FakeResp:
    def __init__(self, status=200, payload=None, headers=None):
        self.status_code = status
        self._payload = payload or {}
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}", response=self)

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _no_sleep():
    with mock.patch.object(m.time, "sleep", lambda *_: None):
        yield


def _rec(vc, pin="500001"):
    return {
        "stateCode": 28,
        "districtCode": 1,
        "subdistrictCode": 2,
        "villageCode": vc,
        "villageNameEnglish": f"V{vc}",
        "districtNameEnglish": "D",
        "subdistrictNameEnglish": "S",
        "pincode": pin,
    }


# --- _get retry/backoff -----------------------------------------------------
def test_get_retries_then_succeeds():
    ok = FakeResp(200, {"records": [_rec(1)], "total": 1})
    session = mock.MagicMock()
    session.get.side_effect = [FakeResp(502), FakeResp(503), ok]
    data = m._get(session, {"x": 1})
    assert data["total"] == 1
    assert session.get.call_count == 3


def test_get_exhausts_retries_and_raises():
    session = mock.MagicMock()
    session.get.side_effect = lambda *a, **k: FakeResp(502)
    with pytest.raises(requests.HTTPError):
        m._get(session, {"x": 1}, retries=3)
    assert session.get.call_count == 3


# --- offset pagination ------------------------------------------------------
def test_fetch_state_records_paginates_by_returned_count():
    # total 25, server returns pages of 10, 10, 5 (advance by len(recs), not PAGE)
    pages = [
        FakeResp(200, {"records": [_rec(i) for i in range(10)], "total": 25}),
        FakeResp(200, {"records": [_rec(i) for i in range(10, 20)], "total": 25}),
        FakeResp(200, {"records": [_rec(i) for i in range(20, 25)], "total": 25}),
    ]
    session = mock.MagicMock()
    session.get.side_effect = pages
    out = m.fetch_state_records(28, session)
    assert len(out) == 25
    assert session.get.call_count == 3


def test_fetch_state_records_incomplete_raises():
    # total says 25 but the feed dries up at 10 -> surface an error (need real key)
    session = mock.MagicMock()
    session.get.side_effect = [
        FakeResp(200, {"records": [_rec(i) for i in range(10)], "total": 25}),
        FakeResp(200, {"records": [], "total": 25}),
    ]
    with pytest.raises(RuntimeError, match="of 25"):
        m.fetch_state_records(28, session)


# --- _write_csvs ------------------------------------------------------------
def test_write_csvs_headers_and_village_dedup(tmp_path):
    records = [_rec(1), _rec(1, pin="500002"), _rec(2, pin="")]  # dup vc=1, blank pin
    paths = m._write_csvs(records, tmp_path, "01Jan2026")
    assert set(paths) == {"districts", "subdistricts", "villages", "pincode_villages"}

    vills = list(csv.DictReader(paths["villages"].open(encoding="utf-8")))
    assert [r["Village Code"] for r in vills] == ["1", "2"]  # deduped by code

    dists = list(csv.DictReader(paths["districts"].open(encoding="utf-8")))
    assert dists[0]["District Name (In English)"] == "D"

    pins = list(csv.DictReader(paths["pincode_villages"].open(encoding="utf-8")))
    assert [r["Village Code"] for r in pins] == ["1"]  # only the one with a pincode


# --- fetch_datagov offline + outage handling --------------------------------
def _seed_csvs(raw):
    (raw / "districts.01Jan2026.csv").write_text(
        "State Code,District Code,District Name (In English)\n28,1,D\n"
    )
    (raw / "subdistricts.01Jan2026.csv").write_text(
        "State Code,District Code,Sub-District Code,Sub-District Name\n28,1,2,S\n"
    )
    (raw / "villages.01Jan2026.csv").write_text(
        "State Code,Sub-District Code,Village Code,Village Name (In English)\n28,2,9,V9\n"
    )


def test_fetch_datagov_offline_reuses_cached_csvs(tmp_path):
    _seed_csvs(tmp_path)
    paths = m.fetch_datagov([28], tmp_path, offline=True)
    assert paths["villages"].name == "villages.01Jan2026.csv"


def test_fetch_datagov_falls_back_to_cache_on_outage(tmp_path):
    _seed_csvs(tmp_path)

    class DownSession:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            return FakeResp(502)

    with mock.patch.object(m.requests, "Session", lambda: DownSession()):
        paths = m.fetch_datagov([28], tmp_path)
    assert paths["villages"].name == "villages.01Jan2026.csv"


def test_fetch_datagov_unavailable_when_no_cache(tmp_path):
    class DownSession:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            return FakeResp(502)

    with mock.patch.object(m.requests, "Session", lambda: DownSession()):
        with pytest.raises(m.DataGovUnavailable):
            m.fetch_datagov([28], tmp_path)


# --- pipeline skips (exit 75) on a transient outage -------------------------
def test_pipeline_exits_75_on_datagov_unavailable(monkeypatch):
    import pipeline

    monkeypatch.setattr(sys, "argv", ["pipeline.py", "--no-verify"])
    monkeypatch.setattr(
        pipeline,
        "fetch_datagov",
        mock.Mock(side_effect=m.DataGovUnavailable("simulated outage")),
    )
    with pytest.raises(SystemExit) as ei:
        pipeline.main()
    assert ei.value.code == 75
