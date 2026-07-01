#!/usr/bin/env python3
"""
changelog.py — produce a human-readable Markdown summary of how the village
data changed versus what is currently committed on this branch (HEAD).

Used by the update workflow to fill the body of the data-refresh pull request,
so a reviewer can see exactly what changed before approving a merge to main.

It compares, per state, the working-tree files against `git show HEAD:<file>`:
  * district / mandal / village counts (before -> after)
  * villages added, removed, and reclassified (by LGD village code)

Run:  python changelog.py            # prints Markdown to stdout
      python changelog.py --out f.md # also writes to f.md
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATES = [("Andhra Pradesh", "andhra_pradesh"), ("Telangana", "telangana")]
MAX_LIST = 40


def git_show(rel_path: str) -> str | None:
    try:
        out = subprocess.run(
            ["git", "show", f"HEAD:{rel_path}"],
            capture_output=True,
            text=True,
            check=True,
            cwd=ROOT,
        )
        return out.stdout
    except subprocess.CalledProcessError:
        return None  # file did not exist at HEAD (initial import)


def read_csv(text: str | None) -> dict[str, dict]:
    if not text:
        return {}
    rd = csv.DictReader(io.StringIO(text))
    out = {}
    for row in rd:
        out[row["Village Code"]] = {"v": row["Village"], "m": row["Mandal"], "d": row["District"]}
    return out


def counts(text: str | None) -> dict:
    if not text:
        return {}
    try:
        return json.loads(text).get("counts", {})
    except json.JSONDecodeError:
        return {}


def fmt(n) -> str:
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return "—"


def delta(a, b) -> str:
    try:
        d = int(b) - int(a)
        return "0" if d == 0 else (f"+{d:,}" if d > 0 else f"{d:,}")
    except (TypeError, ValueError):
        return "—"


def state_section(name: str, slug: str) -> tuple[str, bool]:
    csv_rel = f"{slug}/data/{slug}_villages.csv"
    meta_rel = f"{slug}/web/data/meta.json"
    new_csv_path = ROOT / csv_rel
    new = read_csv(new_csv_path.read_text(encoding="utf-8")) if new_csv_path.exists() else {}
    old = read_csv(git_show(csv_rel))
    new_c = (
        counts((ROOT / meta_rel).read_text(encoding="utf-8")) if (ROOT / meta_rel).exists() else {}
    )
    old_c = counts(git_show(meta_rel))

    initial = not old
    added = [c for c in new if c not in old]
    removed = [c for c in old if c not in new]
    changed = [c for c in new if c in old and new[c] != old[c]]
    changed_any = bool(added or removed or changed) or (new_c != old_c)

    lines = [f"### {name}", ""]
    lines += [
        "| Metric | Before | After | Δ |",
        "|---|--:|--:|--:|",
        f"| Districts | {fmt(old_c.get('districts'))} | {fmt(new_c.get('districts'))} | {delta(old_c.get('districts'), new_c.get('districts'))} |",
        f"| Mandals | {fmt(old_c.get('mandals'))} | {fmt(new_c.get('mandals'))} | {delta(old_c.get('mandals'), new_c.get('mandals'))} |",
        f"| Villages | {fmt(old_c.get('villages'))} | {fmt(new_c.get('villages'))} | {delta(old_c.get('villages'), new_c.get('villages'))} |",
        "",
    ]

    if initial:
        lines += [f"_Initial import: {fmt(len(new))} villages._", ""]
        return "\n".join(lines), True

    if not changed_any:
        lines += ["_No village-level changes._", ""]
        return "\n".join(lines), False

    lines += [
        f"**{len(added)} added · {len(removed)} removed · {len(changed)} reclassified/renamed**",
        "",
    ]

    def block(title, codes, src):
        if not codes:
            return []
        out = [f"<details><summary>{title} ({len(codes)})</summary>", ""]
        for c in sorted(codes, key=lambda x: src[x]["v"])[:MAX_LIST]:
            r = src[c]
            out.append(f"- {r['v']} — {r['m']}, {r['d']} (LGD {c})")
        if len(codes) > MAX_LIST:
            out.append(f"- …and {len(codes) - MAX_LIST} more")
        out += ["", "</details>", ""]
        return out

    lines += block("Added villages", added, new)
    lines += block("Removed villages", removed, old)
    if changed:
        out = ["<details><summary>Reclassified / renamed (" + str(len(changed)) + ")</summary>", ""]
        for c in sorted(changed, key=lambda x: new[x]["v"])[:MAX_LIST]:
            o, n = old[c], new[c]
            out.append(f"- LGD {c}: {o['v']} ({o['m']}, {o['d']}) → {n['v']} ({n['m']}, {n['d']})")
        if len(changed) > MAX_LIST:
            out.append(f"- …and {len(changed) - MAX_LIST} more")
        out += ["", "</details>", ""]
        lines += out

    return "\n".join(lines), True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()

    parts = [
        "## 📊 Data change summary",
        "",
        "Automated refresh from the Local Government Directory (LGD). "
        "Review the changes below before merging to `main`.",
        "",
    ]
    any_change = False
    for name, slug in STATES:
        section, changed = state_section(name, slug)
        parts.append(section)
        any_change = any_change or changed

    if not any_change:
        parts.append("> No data changes detected in this run.")
    parts += [
        "",
        "---",
        "*Generated by `scraper/changelog.py`. Source: "
        "[LGD](https://lgdirectory.gov.in) via the "
        "[data.gov.in](https://data.gov.in/) open-data API.*",
    ]

    md = "\n".join(parts)
    print(md)
    if args.out:
        Path(args.out).write_text(md, encoding="utf-8")


if __name__ == "__main__":
    main()
