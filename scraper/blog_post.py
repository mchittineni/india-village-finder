#!/usr/bin/env python3
"""
blog_post.py — turn a release into a ready-to-publish blog post, and
(optionally) push it to dev.to and Medium so project updates reach readers
beyond GitHub.

Body priority: the CHANGELOG section for the version (features, with the why)
when one exists, else the release notes passed via --notes-file (the automated
data releases don't get CHANGELOG sections). Either way the post is wrapped in
an evergreen intro/outro about the project, and its canonical URL points at
the GitHub release so cross-posting never competes with the repo for search
ranking.

Publishing targets (both optional; the Markdown file is always written):
  --devto    POST to the dev.to (Forem) API. Needs $DEVTO_API_KEY
             (dev.to → Settings → Extensions → API keys). Posts are created
             as DRAFTS unless --publish is given, so nothing auto-generated
             goes live unreviewed.
  --medium   POST to the legacy Medium API. Medium stopped issuing new
             integration tokens on 2025-01-01 but pre-existing tokens keep
             working — set $MEDIUM_TOKEN if you have one. Without one, use
             Medium's "Import a story" with the dev.to URL instead (their
             importer sets the canonical link for you).

A requested target whose credential is missing is skipped with a warning
(exit 0) so the workflow works before any secrets are configured; an actual
API failure exits 1.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import requests

REPO = "mchittineni/india-village-finder"
SITE = "https://mchittineni.github.io/india-village-finder/"
CHANGELOG = Path(__file__).resolve().parent.parent / "CHANGELOG.md"
DEVTO_API = "https://dev.to/api/articles"
MEDIUM_API = "https://api.medium.com/v1"
USER_AGENT = f"india-village-finder/1.0 (+https://github.com/{REPO})"
TAGS = ["opensource", "gis", "india", "opendata"]  # dev.to allows max 4
SERIES = "Village Finder updates"

INTRO = f"""\
[**Village Finder**]({SITE}) is an open-source, multilingual map of every
village in Andhra Pradesh, Telangana, Karnataka, Tamil Nadu and Kerala — ~68,000
villages from the Government of India's Local Government Directory, with
live mandi (market) prices, farmer schemes, land parcels, weather and soil
data on top. The data refreshes itself through reviewed CI pipelines.

Here's what changed in this release.
"""

OUTRO = f"""\
---

**Try it / read more**

- Live map: {SITE}
- Source & data downloads: https://github.com/{REPO}
- Every dataset is open (GODL-India / CC0 / CC BY); the code is MIT.

Issues and contributions welcome — the repo has a
[contributing guide](https://github.com/{REPO}/blob/main/CONTRIBUTING.md).
"""


def changelog_section(version: str, text: str) -> str | None:
    """Return the body of the `## [version]` section, or None if absent."""
    m = re.search(
        rf"^## \[{re.escape(version)}\][^\n]*\n(.*?)(?=^## \[|\Z)",
        text,
        re.M | re.S,
    )
    body = m.group(1).strip() if m else None
    return body or None


def headline(body: str) -> str:
    """First bold feature name in the body ("**Farmer schemes panel** — …"),
    else a generic label — used in the post title."""
    m = re.search(r"\*\*([^*]+)\*\*", body)
    return m.group(1).strip() if m else "data refresh"


def build_post(version: str, body: str) -> tuple[str, str]:
    """Assemble (title, markdown) for one release."""
    title = f"Village Finder {version} — {headline(body)}"
    md = f"{INTRO}\n{body.strip()}\n\n{OUTRO}"
    return title, md


def release_url(version: str) -> str:
    return f"https://github.com/{REPO}/releases/tag/{version}"


def post_devto(title: str, md: str, version: str, publish: bool) -> int:
    key = os.environ.get("DEVTO_API_KEY")
    if not key:
        print("[skip] dev.to: DEVTO_API_KEY not set", file=sys.stderr)
        return 0
    resp = requests.post(
        DEVTO_API,
        headers={"api-key": key, "User-Agent": USER_AGENT},
        json={
            "article": {
                "title": title,
                "body_markdown": md,
                "published": publish,
                "series": SERIES,
                "tags": TAGS,
                "canonical_url": release_url(version),
            }
        },
        timeout=60,
    )
    if resp.status_code not in (200, 201):
        print(f"[error] dev.to HTTP {resp.status_code}: {resp.text[:300]}", file=sys.stderr)
        return 1
    url = resp.json().get("url", "")
    state = "published" if publish else "draft (publish it from your dev.to dashboard)"
    print(f"[devto] {state}: {url}")
    return 0


def post_medium(title: str, md: str, version: str, publish: bool) -> int:
    token = os.environ.get("MEDIUM_TOKEN")
    if not token:
        print(
            "[skip] Medium: MEDIUM_TOKEN not set. Medium stopped issuing new API "
            "tokens (2025-01) — if you don't have a legacy token, use Medium's "
            "'Import a story' with the dev.to URL instead.",
            file=sys.stderr,
        )
        return 0
    headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    me = requests.get(f"{MEDIUM_API}/me", headers=headers, timeout=60)
    if me.status_code != 200:
        print(f"[error] Medium /me HTTP {me.status_code}: {me.text[:300]}", file=sys.stderr)
        return 1
    user_id = me.json()["data"]["id"]
    resp = requests.post(
        f"{MEDIUM_API}/users/{user_id}/posts",
        headers=headers,
        json={
            "title": title,
            "contentFormat": "markdown",
            "content": f"# {title}\n\n{md}",
            "canonicalUrl": release_url(version),
            "tags": TAGS[:5],
            "publishStatus": "public" if publish else "draft",
            "notifyFollowers": False,
        },
        timeout=60,
    )
    if resp.status_code not in (200, 201):
        print(f"[error] Medium HTTP {resp.status_code}: {resp.text[:300]}", file=sys.stderr)
        return 1
    print(f"[medium] {'published' if publish else 'draft'}: {resp.json()['data'].get('url', '')}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tag", required=True, help="release tag, e.g. v1.3.0")
    ap.add_argument(
        "--notes-file",
        type=Path,
        help="release-notes Markdown fallback for versions without a CHANGELOG section",
    )
    ap.add_argument("--out", type=Path, default=Path("blog_post.md"), help="output Markdown file")
    ap.add_argument("--devto", action="store_true", help="create the post on dev.to")
    ap.add_argument(
        "--medium", action="store_true", help="create the post on Medium (legacy token)"
    )
    ap.add_argument(
        "--publish",
        action="store_true",
        help="publish immediately instead of creating drafts",
    )
    args = ap.parse_args()

    version = args.tag.lstrip("v")
    body = changelog_section(version, CHANGELOG.read_text(encoding="utf-8"))
    if body is None and args.notes_file and args.notes_file.exists():
        body = args.notes_file.read_text(encoding="utf-8").strip()
    if not body:
        print(f"[error] no CHANGELOG section or notes for {args.tag}", file=sys.stderr)
        return 1

    title, md = build_post(args.tag, body)
    args.out.write_text(f"# {title}\n\n{md}", encoding="utf-8")
    print(f"[post] {title} -> {args.out}")

    rc = 0
    if args.devto:
        rc = max(rc, post_devto(title, md, args.tag, args.publish))
    if args.medium:
        rc = max(rc, post_medium(title, md, args.tag, args.publish))
    return rc


if __name__ == "__main__":
    sys.exit(main())
