"""
Unit tests for the release → blog-post builder (scraper/blog_post.py).

The risky logic: extracting exactly one version's CHANGELOG section (including
the last section in the file), deriving the title headline, and the publish
contracts — missing credentials skip cleanly (exit 0, so the workflow works
before secrets exist), drafts by default, API failure exits 1. Network is
mocked throughout.
"""

import sys
from pathlib import Path
from unittest import mock

SCRAPER = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRAPER))

import blog_post as m  # noqa: E402

SAMPLE = """\
# Changelog

## [Unreleased]

## [1.3.0] — 2026-07-13

### Added

- **Farmer schemes panel** — schemes for farmers.
- **Farm-inputs reference** — fertilizer prices.

## [1.2.12] — 2026-07-13

### Fixed

- **Stale coords** — pruned.
"""


# --- section extraction -------------------------------------------------------
def test_changelog_section_extracts_only_that_version():
    body = m.changelog_section("1.3.0", SAMPLE)
    assert "Farmer schemes panel" in body
    assert "Stale coords" not in body and "Unreleased" not in body


def test_changelog_section_handles_last_section_and_missing():
    assert "pruned" in m.changelog_section("1.2.12", SAMPLE)
    assert m.changelog_section("9.9.9", SAMPLE) is None
    assert m.changelog_section("Unreleased", "## [Unreleased]\n\n## [1.0.0]\nx\n") is None


def test_build_post_title_and_wrapping():
    title, md = m.build_post("v1.3.0", m.changelog_section("1.3.0", SAMPLE))
    assert title == "Village Finder v1.3.0 — Farmer schemes panel"
    assert md.startswith(m.INTRO) and md.rstrip().endswith(m.OUTRO.rstrip())


def test_headline_falls_back_without_bold():
    assert m.headline("just a plain data refresh") == "data refresh"


# --- publish contracts ----------------------------------------------------------
def test_devto_skips_cleanly_without_key(monkeypatch):
    monkeypatch.delenv("DEVTO_API_KEY", raising=False)
    with mock.patch.object(m.requests, "post") as post:
        assert m.post_devto("t", "b", "v1.3.0", publish=False) == 0
        post.assert_not_called()


def test_devto_posts_draft_with_canonical(monkeypatch):
    monkeypatch.setenv("DEVTO_API_KEY", "k")
    resp = mock.Mock(status_code=201)
    resp.json.return_value = {"url": "https://dev.to/x/post"}
    with mock.patch.object(m.requests, "post", return_value=resp) as post:
        assert m.post_devto("Title", "Body", "v1.3.0", publish=False) == 0
        article = post.call_args.kwargs["json"]["article"]
        assert article["published"] is False  # drafts by default
        assert article["canonical_url"].endswith("/releases/tag/v1.3.0")
        assert post.call_args.kwargs["headers"]["api-key"] == "k"


def test_devto_api_failure_exits_nonzero(monkeypatch):
    monkeypatch.setenv("DEVTO_API_KEY", "k")
    resp = mock.Mock(status_code=422, text="nope")
    with mock.patch.object(m.requests, "post", return_value=resp):
        assert m.post_devto("t", "b", "v1.3.0", publish=True) == 1


def test_medium_skips_cleanly_without_token(monkeypatch):
    monkeypatch.delenv("MEDIUM_TOKEN", raising=False)
    with mock.patch.object(m.requests, "get") as get:
        assert m.post_medium("t", "b", "v1.3.0", publish=False) == 0
        get.assert_not_called()
