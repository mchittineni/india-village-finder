#!/usr/bin/env python3
"""
translit_review.py — the human-verification loop between the transliteration
engines and the Obsidian knowledge vault (notes/translit-review/).

Two subcommands:

  generate   Find villages where the NEURAL name (names_translit.json,
             IndicXlit) and the RULE engine (web_template/i18n.js via
             translit_cli.mjs) disagree — exactly where human review pays
             off — and write one review note per village into the vault,
             with both candidates in the frontmatter. Existing notes are
             never overwritten, and names already covered by human-verified
             seeds (translit_overrides.json / OSM) are skipped.

  harvest    Walk the vault, take every note a human marked
             `status: verified` (with `verified_native` filled in), validate
             the text is really in the state's script, and merge it into
             the overrides layer — the HIGHEST priority, which the pipeline
             prefers over both engines. Harvested notes are flipped to
             `status: merged` so the queue stays clean.

             The note's `scope` picks the destination:
               scope: name  (default) → translit_overrides.json, keyed by the
                            lowercased English name — the fix applies to every
                            village with that name in that language (same
                            spelling → same transliteration, the common case).
               scope: code  → translit_overrides_by_code.json, keyed by the
                            LGD village code — the fix pins to exactly THIS
                            village. Use it for spellings that must not
                            propagate (e.g. a locally-used translated form of
                            a descriptive name like "14 Mile Stone").

The overrides file is the correct destination (not names_translit.json):
the neural sidecar is regenerated weekly and pruned daily, so a fix written
there would be overwritten; overrides are permanent and win everywhere.

Review in Obsidian: open notes/ as a vault; a Dataview table over
`status = "needs-review"` makes the queue (see notes/translit-review/README).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from config import (
    OVERRIDES_BY_CODE_FILE,
    OVERRIDES_FILE,
    ROOT,
    STATES,
    load_code_overrides,
    load_name_seeds,
    resolve_codes,
)
from pipeline import transliterate_batch

VAULT = ROOT / "notes" / "translit-review"

# Unicode block per script, to catch verification typos (wrong keyboard /
# stray Latin) before they reach production names.
SCRIPT_RANGES = {
    "te": (0x0C00, 0x0C7F),
    "kn": (0x0C80, 0x0CFF),
    "ta": (0x0B80, 0x0BFF),
    "ml": (0x0D00, 0x0D7F),
    "hi": (0x0900, 0x097F),
    "ur": (0x0600, 0x06FF),
}


def in_script(s: str, lang: str) -> bool:
    """True when the string's letters are (mostly) in the language's block —
    spaces, digits and punctuation are ignored."""
    lo, hi = SCRIPT_RANGES[lang]
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return False
    ok = sum(1 for c in letters if lo <= ord(c) <= hi)
    return ok / len(letters) >= 0.8


# --------------------------------------------------------------------------- #
# minimal frontmatter (no YAML dependency — our fields are flat `key: value`)
# --------------------------------------------------------------------------- #
def parse_note(text: str) -> dict | None:
    """Parse the leading `--- … ---` frontmatter into a dict, or None."""
    m = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    meta: dict[str, str] = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"')
    return meta


def emit_note(meta: dict[str, str], body: str) -> str:
    lines = ["---"]
    for k, v in meta.items():
        v = str(v)
        lines.append(f'{k}: "{v}"' if (":" in v or v == "") else f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines) + "\n\n" + body


# --------------------------------------------------------------------------- #
# generate
# --------------------------------------------------------------------------- #
def generate(state_arg: str, limit: int, root: Path = ROOT) -> int:
    total = 0
    for code in resolve_codes(state_arg):
        st = STATES[code]
        slug, lang = st["slug"], st["lang"]
        web_data = root / slug / "web" / "data"
        villages = json.loads((web_data / "villages.json").read_text(encoding="utf-8"))
        regions = json.loads((web_data / "regions.json").read_text(encoding="utf-8"))
        neural = json.loads((web_data / "names_translit.json").read_text(encoding="utf-8"))
        seeds = load_name_seeds(lang)
        code_pins = load_code_overrides(lang)
        mandal_names = [m["n"] for m in regions["mandals"]]

        rows = [r for r in villages["rows"] if str(r[2]) in neural]
        rules = transliterate_batch(lang, sorted({r[0] for r in rows}))
        if not rules:
            print(f"[skip] {slug}: rule engine unavailable (node missing?)", file=sys.stderr)
            continue

        out_dir = root / "notes" / "translit-review" / slug
        written = 0
        for name, mi, vcode, *_ in sorted(rows, key=lambda r: r[0]):
            if written >= limit:
                break
            if name.strip().lower() in seeds or str(vcode) in code_pins:
                continue  # already human-verified via seeds or a per-village pin
            nn, rn = neural[str(vcode)], rules.get(name, "")
            if not nn or not rn or nn == rn:
                continue  # engines agree (or one is silent) — low review value
            path = out_dir / f"{vcode}.md"
            if path.exists():
                continue  # never clobber a note a human may have touched
            out_dir.mkdir(parents=True, exist_ok=True)
            meta = {
                "lgd_code": str(vcode),
                "state": st["name"],
                "mandal": mandal_names[mi] if 0 <= mi < len(mandal_names) else "",
                "name_en": name,
                "lang": lang,
                "neural": nn,
                "rules": rn,
                "scope": "name",
                "status": "needs-review",
                "verified_native": "",
            }
            body = (
                "Pick (or type) the correct native spelling into `verified_native` above\n"
                "and set `status: verified`. `scraper/translit_review.py harvest` merges\n"
                "it into the overrides — the highest-priority name layer.\n\n"
                "`scope: name` (default) applies the fix to EVERY village with this\n"
                "English name in this language; change to `scope: code` to pin it to\n"
                "just this village (right for translated/descriptive forms that don't\n"
                "generalise).\n\n"
                "### Context notes\n\n"
                "- neural (IndicXlit) and the rule engine disagree on this name\n"
            )
            path.write_text(emit_note(meta, body), encoding="utf-8")
            written += 1
        total += written
        print(f"[generate] {slug}: {written} review notes (limit {limit})")
    print(f"[generate] {total} total → {VAULT}")
    return 0


# --------------------------------------------------------------------------- #
# harvest
# --------------------------------------------------------------------------- #
def harvest(
    dry_run: bool,
    root: Path = ROOT,
    overrides_file: Path = OVERRIDES_FILE,
    by_code_file: Path = OVERRIDES_BY_CODE_FILE,
) -> int:
    vault = root / "notes" / "translit-review"
    overrides = json.loads(overrides_file.read_text(encoding="utf-8"))
    by_code = json.loads(by_code_file.read_text(encoding="utf-8"))
    by_name_n, by_code_n, bad = 0, 0, []
    for path in sorted(vault.rglob("*.md")):
        if path.name == "README.md":
            continue
        text = path.read_text(encoding="utf-8")
        meta = parse_note(text)
        if not meta or meta.get("status", "").lower() != "verified":
            continue
        lang, name_en, code, native = (
            meta.get("lang", ""),
            meta.get("name_en", ""),
            meta.get("lgd_code", ""),
            meta.get("verified_native", ""),
        )
        scope = (meta.get("scope") or "name").strip().lower()
        if scope not in ("name", "code"):
            bad.append(f"{path}: unknown scope {scope!r} (use name or code)")
            continue
        key = code if scope == "code" else name_en
        if not (lang in SCRIPT_RANGES and key and native):
            field = "lgd_code" if scope == "code" else "name_en"
            bad.append(f"{path}: verified but lang/{field}/verified_native incomplete")
            continue
        if not in_script(native, lang):
            bad.append(f"{path}: {native!r} is not in the {lang} script")
            continue
        if scope == "code":
            by_code.setdefault(lang, {})[code.strip()] = native
            by_code_n += 1
        else:
            en_key = name_en.strip().lower()
            cur = (overrides.get(lang) or {}).get(en_key)
            if cur and cur != native:
                bad.append(
                    f"{path}: {native!r} conflicts with existing {lang} override "
                    f"{cur!r} for {name_en!r} — if the villages genuinely differ, "
                    f"use scope: code"
                )
                continue
            overrides.setdefault(lang, {})[en_key] = native
            by_name_n += 1
        if not dry_run:
            path.write_text(text.replace("status: verified", "status: merged", 1), encoding="utf-8")

    for msg in bad:
        print(f"[error] {msg}", file=sys.stderr)
    if not dry_run:
        for dest_n, dest, dest_file in (
            (by_name_n, overrides, overrides_file),
            (by_code_n, by_code, by_code_file),
        ):
            if not dest_n:
                continue
            for lang in SCRIPT_RANGES:
                if lang in dest and isinstance(dest[lang], dict):
                    dest[lang] = dict(sorted(dest[lang].items()))
            dest_file.write_text(
                json.dumps(dest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
    print(
        f"[harvest] merged {by_name_n} by-name → {overrides_file.name}, "
        f"{by_code_n} by-code → {by_code_file.name}" + (" (dry run)" if dry_run else "")
    )
    if (by_name_n or by_code_n) and not dry_run:
        print("[harvest] re-run the pipeline (or wait for the daily refresh) to ship them")
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("generate", help="write review notes for engine disagreements")
    g.add_argument("--state", default="all", help="state alias/slug — default all")
    g.add_argument("--limit", type=int, default=50, help="max new notes per state")
    h = sub.add_parser("harvest", help="merge verified notes into translit_overrides.json")
    h.add_argument("--dry-run", action="store_true", help="report without writing")
    args = ap.parse_args()
    if args.cmd == "generate":
        return generate(args.state, args.limit)
    return harvest(args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
