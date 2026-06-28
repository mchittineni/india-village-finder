#!/usr/bin/env python3
"""
release_notes.py — write `release_notes.md` for a data release and print
`source_date=<date>` (consumed by the release workflow via $GITHUB_OUTPUT).

Discovers every state automatically (any `*/web/data/meta.json`), so adding a new
state needs no change here. The release version, if any, is read from the
VF_VERSION environment variable.

Run from the repository root:  python scraper/release_notes.py
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    metas = []
    for p in sorted(ROOT.glob("*/web/data/meta.json")):
        slug = p.parents[2].name  # <slug>/web/data/meta.json
        metas.append((slug, json.loads(p.read_text(encoding="utf-8"))))
    if not metas:
        raise SystemExit("no */web/data/meta.json found")

    version = os.environ.get("VF_VERSION", "").strip()
    source_date = metas[0][1].get("source_date", "")
    title = (
        f"## 🗺️ Village data {version} — {source_date}"
        if version
        else f"## 🗺️ Village data — {source_date}"
    )

    names = [m["state"] for _, m in metas]
    header = "| | " + " | ".join(names) + " |"
    align = "|---|" + "--:|" * len(names)

    def row(label, key):
        return "| " + label + " | " + " | ".join(f"{m['counts'][key]:,}" for _, m in metas) + " |"

    artifacts = ["| File | Contents |", "|---|---|"]
    for slug, m in metas:
        artifacts.append(
            f"| `{slug}_villages.csv` | {m['state']} — flat village list (one row per village, with LGD codes) |"
        )
    for slug, m in metas:
        artifacts.append(
            f"| `{slug}_data.zip` | {m['state']} — full dataset (regions/villages/meta JSON + boundary GeoJSON + CSV) |"
        )
    artifacts.append("| `village_data_all.zip` | everything, all states |")

    notes = "\n".join(
        [
            title,
            "",
            f"Datasets sourced from the **Local Government Directory (LGD)** dump dated **{source_date}**.",
            "",
            header,
            align,
            row("Districts", "districts"),
            row("Mandals", "mandals"),
            row("Villages", "villages"),
            "",
            "### Artifacts",
            *artifacts,
            "",
            "**Live site:** https://mchittineni.github.io/india-village-finder/",
            "",
            "---",
            "Data © Government of India, used under **GODL-India** — see `DATA_LICENSE.md` for the",
            "required attribution. Verify anything official against https://lgdirectory.gov.in.",
        ]
    )
    (ROOT / "release_notes.md").write_text(notes, encoding="utf-8")
    print(f"source_date={source_date}")


if __name__ == "__main__":
    main()
