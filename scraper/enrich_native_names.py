#!/usr/bin/env python3
"""
enrich_native_names.py — best-effort NEURAL native village names.

LGD publishes only some village names in the state's own script; those are shipped
as the authoritative web/data/names.json (Telangana ~99%, but Andhra Pradesh ~2%,
Tamil Nadu ~8%, Karnataka ~0.2%). For every village WITHOUT an authoritative name,
this fills the gap with AI4Bharat IndicXlit — a trained English→Indic transliteration
model that is markedly more accurate than the rule-based UI engine
(web_template/i18n.js). The result is written to web/data/names_translit.json
(villageCode -> native) and shipped to the map and the CSV as a clearly-approximate
fallback. The authoritative names.json is NEVER modified.

Why a SEPARATE, occasional script (not part of pipeline.py)
-----------------------------------------------------------
IndicXlit depends on PyTorch + fairseq (multi-GB) and downloads model weights on
first use. We do NOT want that in the pipeline's CI path or in the browser. So this
runs on demand — normally via the regenerate-native-names.yml workflow (one runner
per state, model + name caches persisted between runs), or on a workstation — and
its (small JSON) output is COMMITTED, exactly like build_boundaries.py and
enrich_coords.py. The map, the CSV build and CI then read a plain committed file
and never touch PyTorch.

Install (separate from the normal pipeline deps)
------------------------------------------------
    ./.venv/bin/pip install -r scraper/requirements-translit.txt

Run
---
    python scraper/enrich_native_names.py                # all states -> names_translit.json
    python scraper/enrich_native_names.py --state ka     # one state (ap|tg|ka|tn|kl)
    python scraper/enrich_native_names.py --regions      # district/mandal/state -> regions_native.json
    python scraper/enrich_native_names.py --eval         # score vs LGD gold, write nothing

`--eval` is the HONEST, non-circular quality metric: it transliterates the villages
that DO have an authoritative LGD name and scores the model against that independent
gold (the generated file covers the disjoint set that has no gold, so it cannot be
scored against itself). Compare it to the rule engine via
`node scraper/translit_eval.mjs`.

A persistent cache (scraper/.cache/indicxlit_cache.json, git-ignored) makes reruns
incremental: only never-seen names hit the model.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from config import ALIAS as _CODE_ALIAS  # shared per-state registry
from config import (
    LANG_BY_SLUG,
    SLUG_BY_CODE,
    load_code_overrides,
    load_name_seeds,
)

HERE = Path(__file__).resolve().parent  # scraper/
ROOT = HERE.parent  # Village Finder/
# Cache location; override with $INDICXLIT_CACHE so several state runs can execute
# in parallel without clobbering one shared file (e.g. one cache per language).
CACHE_FILE = Path(os.environ.get("INDICXLIT_CACHE", str(HERE / ".cache" / "indicxlit_cache.json")))

# slug -> language script, and alias -> slug, both from the shared registry
# (scraper/config.py). IndicXlit supports te/kn/ta/ml.
STATES = LANG_BY_SLUG
ALIAS = {alias: SLUG_BY_CODE[code] for alias, code in _CODE_ALIAS.items()}

# Curated state names in their own script (prominent, so not left to the model).
STATE_NATIVE = {
    "andhra_pradesh": "ఆంధ్రప్రదేశ్",
    "telangana": "తెలంగాణ",
    "karnataka": "ಕರ್ನಾಟಕ",
    "tamil_nadu": "தமிழ்நாடு",
    "kerala": "കേരളം",
}

# Unicode block per script — used to keep only genuine native-script output.
SCRIPT_RANGE = {
    "te": (0x0C00, 0x0C7F),
    "kn": (0x0C80, 0x0CFF),
    "ta": (0x0B80, 0x0BFF),
    "ml": (0x0D00, 0x0D7F),
    "hi": (0x0900, 0x097F),
}

# Common single-letter prefixes in Indian village names (e.g. "A.Kothapalle" -> "ఎ.కొత్తపల్లె").
# IndicXlit's internal word-splitter frequently mangles single-letter initials or leaks
# them as Latin; mapping them explicitly ensures high accuracy and prevents data corruption.
INITIAL_PREFIXES = {
    "te": {
        "A": "ఎ", "B": "బి", "C": "సి", "D": "డి", "E": "ఇ", "G": "జి", "H": "హెచ్",
        "J": "జె", "K": "కె", "L": "ఎల్", "M": "ఎం", "N": "ఎన్", "P": "పి", "R": "ఆర్",
        "S": "ఎస్", "T": "టి", "V": "వి", "Y": "వై"
    },
    "kn": {
        "A": "ಎ", "B": "ಬಿ", "C": "ಸಿ", "D": "ಡಿ", "E": "ಇ", "G": "ಜಿ", "H": "ಹೆಚ್",
        "J": "ಜೆ", "K": "ಕೆ", "L": "ಎಲ್", "M": "ಎಂ", "N": "ಎನ್", "P": "ಪಿ", "R": "ಆರ್",
        "S": "ಎಸ್", "T": "ಟಿ", "V": "ವಿ", "Y": "ವೈ"
    },
    "ta": {
        "A": "அ", "B": "பி", "C": "சி", "D": "டி", "E": "இ", "G": "ஜி",
        "K": "கே", "M": "எம்", "N": "என்", "P": "பி", "R": "ஆர்", "S": "எஸ்",
        "T": "டி", "V": "வி"
    },
    "ml": {
        "A": "എ", "B": "ബി", "C": "സി", "D": "ഡി", "E": "ഇ", "G": "ജി",
        "K": "കെ", "M": "എം", "N": "എൻ", "P": "പി", "R": "ആർ", "S": "എസ്",
        "T": "ടി", "V": "വി"
    },
}


def in_script(s: str, lang: str) -> bool:
    lo, hi = SCRIPT_RANGE.get(lang, (0, 0))
    if not lo or not s:
        return False
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return False
    has_target = any(lo <= ord(c) <= hi for c in letters)
    has_latin = any(("A" <= c <= "Z" or "a" <= c <= "z") for c in letters)
    return has_target and not has_latin


# --------------------------------------------------------------------------- #
# persistent cache
# --------------------------------------------------------------------------- #
def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


# --------------------------------------------------------------------------- #
# IndicXlit engine
# --------------------------------------------------------------------------- #
_ENGINES: dict = {}


def get_engine(lang: str, beam: int):
    """Construct (and memoise) an IndicXlit engine. Fails LOUDLY: this is an explicit,
    on-demand tool, so an install/model problem must stop the run — never silently
    yield empty names (which would quietly degrade the committed dataset)."""
    key = (lang, beam)
    if key not in _ENGINES:
        try:
            from ai4bharat.transliteration import XlitEngine
        except ImportError as e:
            raise SystemExit(
                "ai4bharat-transliteration is not installed.\n"
                "  ./.venv/bin/pip install -r scraper/requirements-translit.txt\n"
                f"  (import error: {e})"
            )
        print(f"[model] loading IndicXlit for '{lang}' (beam={beam}) ...", flush=True)
        _ENGINES[key] = XlitEngine(lang, beam_width=beam, rescore=True)
    return _ENGINES[key]


def _clean_native(s: str) -> str:
    # IndicXlit appends a presentational ZWNJ/ZWJ after a trailing halant
    # (e.g. రాంపూర్‌); LGD's stored spellings don't, so drop the joiners.
    return s.replace("‌", "").replace("‍", "")


def _xlit_name(engine, lang: str, name: str) -> str:
    """Transliterate a name segment-by-segment. We split on every run of non-letters
    (space, '.', '-', digits) and transliterate each letter-run on its own, preserving
    the separators. Dotted single-letter initials use canonical native letters."""
    out = []
    lang_prefixes = INITIAL_PREFIXES.get(lang, {})
    for seg in re.split(r"([^A-Za-z]+)", name):
        if seg and re.search(r"[A-Za-z]", seg):
            if len(seg) == 1 and seg.upper() in lang_prefixes:
                out.append(lang_prefixes[seg.upper()])
                continue
            try:
                cand = engine.translit_word(seg, topk=1).get(lang) or []
                out.append(_clean_native(cand[0]) if cand else seg)
            except Exception:
                out.append(seg)
        else:
            out.append(seg)
    return "".join(out)


def transliterate(lang: str, names, beam: int, cache: dict) -> dict:
    """Return {english_name: native}. Human-verified seeds (manual overrides + OSM
    name:<lang> tags) win outright; only names with neither a seed nor a cache entry
    hit the model. The cache is persisted as we go so a long run is resumable.
    When every name is seeded, the heavy IndicXlit model never loads."""
    uniq = sorted({n.strip() for n in names if n.strip()})
    seeds = load_name_seeds(lang)
    missing = [n for n in uniq if n.lower() not in seeds and f"{lang}:{n.lower()}" not in cache]
    if missing:
        engine = get_engine(lang, beam)
        for i, name in enumerate(missing, 1):
            cache[f"{lang}:{name.lower()}"] = _xlit_name(engine, lang, name)
            if i % 500 == 0:
                print(f"    {i}/{len(missing)} ...", flush=True)
                save_cache(cache)
        save_cache(cache)
    return {n: (seeds.get(n.lower()) or cache.get(f"{lang}:{n.lower()}", "")) for n in uniq}


def dump_compact_dict_json(path: Path, d: dict) -> None:
    """Format dictionary sidecars with 1 key-value per line for clean atomic diffs."""
    if not d:
        path.write_text("{}\n", encoding="utf-8")
        return
    items = sorted(d.items(), key=lambda kv: (int(kv[0]) if kv[0].isdigit() else kv[0]))
    lines = ["{"]
    for i, (k, v) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        k_str = json.dumps(k, ensure_ascii=False)
        v_str = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
        lines.append(f"  {k_str}:{v_str}{comma}")
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------- #
# generate: web/data/names_translit.json (villages WITHOUT an authoritative name)
# --------------------------------------------------------------------------- #
def build_state(slug: str, lang: str, beam: int, cache: dict) -> None:
    state_dir = ROOT / slug
    web_data = state_dir / "web" / "data"
    villages = json.loads((web_data / "villages.json").read_text(encoding="utf-8"))["rows"]
    names_path = web_data / "names.json"
    authoritative = (
        json.loads(names_path.read_text(encoding="utf-8")) if names_path.exists() else {}
    )
    code_pins = load_code_overrides(lang)
    seeds = load_name_seeds(lang)

    # Master store ensures verified transliterations are never lost across refreshes
    nt_path = web_data / "names_translit.json"
    nt_master_path = state_dir / "data" / "names_translit_master.json"
    prev_neural = {}
    if nt_master_path.exists():
        try:
            prev_neural.update(json.loads(nt_master_path.read_text(encoding="utf-8")))
        except Exception:
            pass
    if nt_path.exists():
        try:
            prev_neural.update(json.loads(nt_path.read_text(encoding="utf-8")))
        except Exception:
            pass

    out = {}
    todo = []
    for r in villages:
        code, en = str(r[2]), r[0]
        if code in authoritative:
            continue
        # 1. Per-village code overrides (verified review notes)
        if code in code_pins and in_script(code_pins[code], lang):
            out[code] = code_pins[code]
        # 2. Name-keyed seeds (manual overrides + OSM)
        elif en.strip().lower() in seeds and in_script(seeds[en.strip().lower()], lang):
            out[code] = seeds[en.strip().lower()]
        # 3. Preserved master/existing transliteration
        elif code in prev_neural and in_script(prev_neural[code], lang):
            out[code] = prev_neural[code]
        else:
            todo.append((code, en))

    if todo:
        mapping = transliterate(lang, [en for _, en in todo], beam, cache)
        for code, en in todo:
            nat = mapping.get(en.strip(), "")
            if nat and in_script(nat, lang):
                out[code] = nat
            elif code in prev_neural:
                out[code] = prev_neural[code]  # Fall back to previous instead of losing translation

    # Persist both master archive and web sidecar
    master_all = {**prev_neural, **out}
    dump_compact_dict_json(nt_master_path, master_all)
    dump_compact_dict_json(nt_path, out)

    covered = len(authoritative) + len(out)
    print(
        f"[{slug}] neural {len(out)}/{len(villages)} -> names_translit.json "
        f"(+{len(authoritative)} authoritative = {covered}/{len(villages)} villages)"
    )


# --------------------------------------------------------------------------- #
# generate: web/data/regions_native.json (district + mandal names, + state name)
# --------------------------------------------------------------------------- #
def _engine_or_none(lang: str, beam: int):
    """The region set is small and partly covered by village names, so the model is
    optional here: return an engine if IndicXlit is installed, else None (the caller
    then ships only the names it could resolve from existing data)."""
    try:
        import ai4bharat.transliteration  # noqa: F401
    except Exception:
        return None
    try:
        return get_engine(lang, beam)
    except SystemExit:
        return None


def _norm(s: str) -> str:
    return " ".join((s or "").split()).strip().lower()


def build_regions(slug: str, lang: str, beam: int) -> None:
    """Native names for districts + sub-districts (+ the state name). LGD has no
    local-script column for these, so each name is resolved as: a same-named village's
    native name (authoritative or neural, already committed) → IndicXlit if available
    → omitted (the app then falls back to the rule engine for that one)."""
    web_data = ROOT / slug / "web" / "data"
    reg = json.loads((web_data / "regions.json").read_text(encoding="utf-8"))
    villages = json.loads((web_data / "villages.json").read_text(encoding="utf-8"))["rows"]
    auth = _load_json(web_data / "names.json")
    neural = _load_json(web_data / "names_translit.json")

    v_native = {}  # normalised english village name -> native
    for r in villages:
        nat = auth.get(str(r[2])) or neural.get(str(r[2]))
        if nat:
            v_native.setdefault(_norm(r[0]), nat)

    seeds = load_name_seeds(lang)
    existing_rn = _load_json(web_data / "regions_native.json")

    out = {"state": STATE_NATIVE.get(slug, ""), "districts": {}, "mandals": {}}
    todo = []  # (tier, code, english) needing the model
    for tier in ("districts", "mandals"):
        for r in reg[tier]:
            code, en = str(r["c"]), r["n"]
            nat = (
                (existing_rn.get(tier) or {}).get(code)
                or seeds.get(_norm(en))
                or v_native.get(_norm(en))
            )
            if nat and in_script(nat, lang):
                out[tier][code] = nat
            else:
                todo.append((tier, code, en))

    engine = _engine_or_none(lang, beam) if todo else None
    if engine:
        for tier, code, en in todo:
            nat = _xlit_name(engine, lang, en)
            if in_script(nat, lang):
                out[tier][code] = nat

    (web_data / "regions_native.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    total = len(reg["districts"]) + len(reg["mandals"])
    have = len(out["districts"]) + len(out["mandals"])
    print(
        f"[{slug}] regions_native {have}/{total} regions + state "
        f"({'model' if engine else 'from village data & seeds only'})"
    )


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


# --------------------------------------------------------------------------- #
# eval: score the model against the authoritative LGD names (independent gold)
# --------------------------------------------------------------------------- #
def _lev(a: str, b: str) -> int:
    m, n = len(a), len(b)
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        cur = [i] + [0] * n
        for j in range(1, n + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
        prev = cur
    return prev[n]


# LGD parentheticals are translated ("(South)" -> native), not transliterable, so the
# eval compares the core name — same rule as translit_eval.mjs.
def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\(.*?\)", "", s or "")).strip()


def evaluate(slug: str, lang: str, beam: int, cache: dict):
    web_data = ROOT / slug / "web" / "data"
    names_path = web_data / "names.json"
    if not names_path.exists():
        return None
    gold = json.loads(names_path.read_text(encoding="utf-8"))
    if not gold:
        return None
    by_code = {
        str(r[2]): r[0]
        for r in json.loads((web_data / "villages.json").read_text(encoding="utf-8"))["rows"]
    }
    pairs = [
        (by_code[c], native) for c, native in gold.items() if c in by_code and "(" not in by_code[c]
    ]
    mapping = transliterate(lang, [en for en, _ in pairs], beam, cache)

    n = exact = 0
    acc = 0.0
    for en, native in pairs:
        g = _clean(native)
        got = _clean(mapping.get(en.strip(), ""))
        if not g or not got:
            continue
        n += 1
        if got == g:
            exact += 1
        acc += 1 - _lev(got, g) / max(len(g), len(got))
    if not n:
        return None
    return {"slug": slug, "lang": lang, "n": n, "exact": 100 * exact / n, "charAcc": 100 * acc / n}


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(
        description="Neural (IndicXlit) native village names — generate or evaluate"
    )
    ap.add_argument("--state", default="all", help="all | ap | tg | ka | tn | kl  (default: all)")
    ap.add_argument("--beam", type=int, default=4, help="IndicXlit beam width (default 4)")
    ap.add_argument(
        "--eval",
        action="store_true",
        help="score the model against authoritative LGD names; write nothing",
    )
    ap.add_argument(
        "--regions",
        action="store_true",
        help="generate regions_native.json (district/mandal/state names) instead",
    )
    args = ap.parse_args()

    if args.state in ("all", "both"):
        slugs = list(STATES)
    else:
        slug = ALIAS.get(args.state, args.state)
        if slug not in STATES:
            raise SystemExit(f"unknown --state {args.state!r}")
        slugs = [slug]

    cache = load_cache()

    if args.eval:
        rows = []
        TN = TE = 0
        TACC = 0.0
        for slug in slugs:
            r = evaluate(slug, STATES[slug], args.beam, cache)
            if r:
                rows.append(r)
                TN += r["n"]
                TE += r["exact"] * r["n"] / 100
                TACC += r["charAcc"] * r["n"] / 100

        def pad(s, w):
            return str(s).ljust(w)

        print(
            "\n" + pad("state", 16) + pad("lang", 5) + pad("pairs", 8) + pad("exact", 9) + "charAcc"
        )
        for r in rows:
            exact = "%.1f%%" % r["exact"]
            print(
                pad(r["slug"], 16)
                + pad(r["lang"], 5)
                + pad(r["n"], 8)
                + pad(exact, 9)
                + ("%.1f%%" % r["charAcc"])
            )
        if TN:
            o_exact = "%.1f%%" % (100 * TE / TN)
            print(
                pad("OVERALL", 16)
                + pad("", 5)
                + pad(TN, 8)
                + pad(o_exact, 9)
                + ("%.1f%%" % (100 * TACC / TN))
            )
        print("\nCompare with the rule engine: node scraper/translit_eval.mjs")
        return

    if args.regions:
        for slug in slugs:
            build_regions(slug, STATES[slug], args.beam)
        return

    for slug in slugs:
        build_state(slug, STATES[slug], args.beam, cache)


if __name__ == "__main__":
    main()
