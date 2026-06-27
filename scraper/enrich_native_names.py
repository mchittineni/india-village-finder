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
first use. We do NOT want that in the pipeline, in CI, or in the browser. So this
runs on demand on a workstation and its (small JSON) output is COMMITTED — exactly
like build_boundaries.py and enrich_coords.py. The map, the CSV build and CI then
read a plain committed file and never touch PyTorch.

Install (separate from the normal pipeline deps)
------------------------------------------------
    ./.venv/bin/pip install -r scraper/requirements-translit.txt

Run
---
    python scraper/enrich_native_names.py                # all states -> names_translit.json
    python scraper/enrich_native_names.py --state ka     # one state (ap|tg|ka|tn)
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
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent          # scraper/
ROOT = HERE.parent                              # Village Finder/
CACHE_FILE = HERE / ".cache" / "indicxlit_cache.json"

# slug -> language script (mirrors pipeline.STATES). IndicXlit supports te/kn/ta.
STATES = {
    "andhra_pradesh": "te", "telangana": "te",
    "karnataka": "kn", "tamil_nadu": "ta",
}
ALIAS = {"ap": "andhra_pradesh", "andhra": "andhra_pradesh",
         "tg": "telangana", "ts": "telangana",
         "ka": "karnataka", "kar": "karnataka",
         "tn": "tamil_nadu", "tamilnadu": "tamil_nadu", "tamil": "tamil_nadu"}

# Unicode block per script — used to keep only genuine native-script output.
SCRIPT_RANGE = {
    "te": (0x0C00, 0x0C7F), "kn": (0x0C80, 0x0CFF),
    "ta": (0x0B80, 0x0BFF), "hi": (0x0900, 0x097F),
}


def in_script(s: str, lang: str) -> bool:
    lo, hi = SCRIPT_RANGE.get(lang, (0, 0))
    return any(lo <= ord(c) <= hi for c in s) if s else False


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


def _xlit_name(engine, lang: str, name: str) -> str:
    """Transliterate one (possibly multi-word) name. IndicXlit's translit_word works on
    a single token, so we transliterate each whitespace token and rejoin; tokens with
    no ASCII letter (e.g. a stray "(Urban)") pass through unchanged."""
    parts = []
    for tok in name.split():
        if not any("a" <= c.lower() <= "z" for c in tok):
            parts.append(tok)
            continue
        try:
            out = engine.translit_word(tok, topk=1)
            cand = out.get(lang) or []
            parts.append(cand[0] if cand else tok)
        except Exception:
            parts.append(tok)
    return " ".join(parts)


def transliterate(lang: str, names, beam: int, cache: dict) -> dict:
    """Return {english_name: native}. Only names absent from the cache hit the model;
    the cache is persisted as we go so a long run is resumable."""
    uniq = sorted({n.strip() for n in names if n.strip()})
    missing = [n for n in uniq if f"{lang}:{n.lower()}" not in cache]
    if missing:
        engine = get_engine(lang, beam)
        for i, name in enumerate(missing, 1):
            cache[f"{lang}:{name.lower()}"] = _xlit_name(engine, lang, name)
            if i % 500 == 0:
                print(f"    {i}/{len(missing)} ...", flush=True)
                save_cache(cache)
        save_cache(cache)
    return {n: cache.get(f"{lang}:{n.lower()}", "") for n in uniq}


# --------------------------------------------------------------------------- #
# generate: web/data/names_translit.json (villages WITHOUT an authoritative name)
# --------------------------------------------------------------------------- #
def build_state(slug: str, lang: str, beam: int, cache: dict) -> None:
    web_data = ROOT / slug / "web" / "data"
    villages = json.loads((web_data / "villages.json").read_text(encoding="utf-8"))["rows"]
    names_path = web_data / "names.json"
    authoritative = json.loads(names_path.read_text(encoding="utf-8")) if names_path.exists() else {}

    todo = [(str(r[2]), r[0]) for r in villages if str(r[2]) not in authoritative]
    mapping = transliterate(lang, [en for _, en in todo], beam, cache)

    out = {}
    for code, en in todo:
        nat = mapping.get(en.strip(), "")
        if nat and in_script(nat, lang):
            out[code] = nat

    (web_data / "names_translit.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    covered = len(authoritative) + len(out)
    print(f"[{slug}] neural {len(out)}/{len(todo)} -> names_translit.json "
          f"(+{len(authoritative)} authoritative = {covered}/{len(villages)} villages)")


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
    by_code = {str(r[2]): r[0]
               for r in json.loads((web_data / "villages.json").read_text(encoding="utf-8"))["rows"]}
    pairs = [(by_code[c], native) for c, native in gold.items()
             if c in by_code and "(" not in by_code[c]]
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
    return {"slug": slug, "lang": lang, "n": n,
            "exact": 100 * exact / n, "charAcc": 100 * acc / n}


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(
        description="Neural (IndicXlit) native village names — generate or evaluate")
    ap.add_argument("--state", default="all",
                    help="all | ap | tg | ka | tn  (default: all)")
    ap.add_argument("--beam", type=int, default=4, help="IndicXlit beam width (default 4)")
    ap.add_argument("--eval", action="store_true",
                    help="score the model against authoritative LGD names; write nothing")
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
        print("\n" + pad("state", 16) + pad("lang", 5) + pad("pairs", 8)
              + pad("exact", 9) + "charAcc")
        for r in rows:
            exact = "%.1f%%" % r["exact"]
            print(pad(r["slug"], 16) + pad(r["lang"], 5) + pad(r["n"], 8)
                  + pad(exact, 9) + ("%.1f%%" % r["charAcc"]))
        if TN:
            o_exact = "%.1f%%" % (100 * TE / TN)
            print(pad("OVERALL", 16) + pad("", 5) + pad(TN, 8)
                  + pad(o_exact, 9) + ("%.1f%%" % (100 * TACC / TN)))
        print("\nCompare with the rule engine: node scraper/translit_eval.mjs")
        return

    for slug in slugs:
        build_state(slug, STATES[slug], args.beam, cache)


if __name__ == "__main__":
    main()
