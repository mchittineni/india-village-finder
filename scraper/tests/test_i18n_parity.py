"""
Guard the i18n dictionary against language drift (scraper/web_template/i18n.js).

Every language block must carry exactly the English key set: a key added to
`en` but forgotten in another language silently falls back to English in the
UI (t() falls back), which is how three languages shipped without the parcels
strings for months. Parsing is line-based on the file's stable, prettier-
enforced indentation — no JS runtime needed.
"""

import re
from pathlib import Path

I18N = Path(__file__).resolve().parent.parent / "web_template" / "i18n.js"

# The engine renders these languages; the DICT should cover the same set + en.
LANGS = ("en", "te", "hi", "kn", "ur", "ta", "ml")


def dict_blocks() -> dict[str, set[str]]:
    blocks: dict[str, set[str]] = {}
    cur = None
    for line in I18N.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^    (" + "|".join(LANGS) + r"): \{$", line)
        if m:
            cur = m.group(1)
            blocks[cur] = set()
            continue
        if cur:
            k = re.match(r"^      ([a-z_0-9]+):", line)
            if k:
                blocks[cur].add(k.group(1))
            if line in ("    }", "    },"):
                cur = None
    return blocks


def test_every_language_has_every_key():
    blocks = dict_blocks()
    assert set(blocks) == set(LANGS), f"expected DICT blocks for {LANGS}, found {sorted(blocks)}"
    en = blocks["en"]
    assert len(en) > 100, "en block parsed suspiciously small — parser drift?"
    for lang in LANGS:
        missing = sorted(en - blocks[lang])
        extra = sorted(blocks[lang] - en)
        assert not missing, f"{lang} is missing {len(missing)} keys: {missing[:10]}"
        assert not extra, f"{lang} has keys en lacks (typo?): {extra[:10]}"


def test_placeholders_match_english():
    """A translation must keep the same {placeholders} as the English string,
    else t() renders a literal {n}/{name} to the user."""
    src = I18N.read_text(encoding="utf-8")
    ph = re.compile(r"\{(\w+)\}")
    values: dict[str, dict[str, str]] = {}
    cur = None
    for line in src.splitlines():
        m = re.match(r"^    (" + "|".join(LANGS) + r"): \{$", line)
        if m:
            cur = m.group(1)
            values[cur] = {}
            continue
        if cur:
            k = re.match(r'^      ([a-z_0-9]+):\s*"(.*)",?$', line)
            if k:
                values[cur][k.group(1)] = k.group(2)
            if line in ("    }", "    },"):
                cur = None
    en = values["en"]
    for lang in LANGS[1:]:
        for key, s in values[lang].items():
            if key in en:
                assert set(ph.findall(s)) == set(
                    ph.findall(en[key])
                ), f"{lang}.{key}: placeholders {ph.findall(s)} != en's {ph.findall(en[key])}"
