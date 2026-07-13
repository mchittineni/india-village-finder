"""
Unit tests for the vault review loop (scraper/translit_review.py).

The risky logic: the frontmatter round-trip, harvest's merge target and its
script validation (a verified name typed in the wrong script must fail the
run, not reach production), never clobbering existing notes, and selecting
only genuine neural-vs-rules disagreements. Filesystem is a tmp tree; the
node bridge is stubbed.
"""

import json
import sys
from pathlib import Path
from unittest import mock

SCRAPER = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRAPER))

import translit_review as m  # noqa: E402


def note(
    status="verified",
    native="కొండపల్లి",
    lang="te",
    name_en="Kondapalli",
    scope=None,
    code="584792",
):
    meta = {
        "lgd_code": code,
        "state": "Andhra Pradesh",
        "mandal": "Ibrahimpatnam",
        "name_en": name_en,
        "lang": lang,
        "neural": "కొండపల్లి",
        "rules": "కొండపలి",
        "status": status,
        "verified_native": native,
    }
    if scope is not None:  # scope=None mimics pre-scope notes (default: name)
        meta["scope"] = scope
    return m.emit_note(meta, "### Context notes\n")


def _vault(tmp_path, text, fname="584792.md"):
    d = tmp_path / "notes" / "translit-review" / "andhra_pradesh"
    d.mkdir(parents=True, exist_ok=True)
    (d / fname).write_text(text, encoding="utf-8")
    empty = json.dumps({"_comment": "x", "te": {}, "kn": {}, "ta": {}})
    ov = tmp_path / "translit_overrides.json"
    bc = tmp_path / "translit_overrides_by_code.json"
    for f in (ov, bc):
        if not f.exists():
            f.write_text(empty, encoding="utf-8")
    return d / fname, ov, bc


def _harvest(tmp_path, dry_run=False):
    ov = tmp_path / "translit_overrides.json"
    bc = tmp_path / "translit_overrides_by_code.json"
    return m.harvest(dry_run=dry_run, root=tmp_path, overrides_file=ov, by_code_file=bc)


# --- frontmatter round-trip ---------------------------------------------------
def test_parse_note_roundtrip():
    meta = m.parse_note(note())
    assert meta["lgd_code"] == "584792"
    assert meta["verified_native"] == "కొండపల్లి"
    assert meta["status"] == "verified"
    assert m.parse_note("no frontmatter here") is None


# --- harvest --------------------------------------------------------------------
def test_harvest_merges_verified_into_overrides(tmp_path):
    path, ov, bc = _vault(tmp_path, note())
    assert _harvest(tmp_path) == 0
    merged = json.loads(ov.read_text(encoding="utf-8"))
    assert merged["te"]["kondapalli"] == "కొండపల్లి"  # lowercased english key
    assert json.loads(bc.read_text(encoding="utf-8"))["te"] == {}  # name scope only
    assert "status: merged" in path.read_text(encoding="utf-8")  # queue stays clean


def test_harvest_ignores_needs_review_and_dry_run_writes_nothing(tmp_path):
    path, ov, _ = _vault(tmp_path, note(status="needs-review"))
    assert _harvest(tmp_path) == 0
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}

    path.write_text(note(), encoding="utf-8")
    assert _harvest(tmp_path, dry_run=True) == 0
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}  # untouched
    assert "status: verified" in path.read_text(encoding="utf-8")


def test_harvest_rejects_wrong_script(tmp_path):
    _, ov, _ = _vault(tmp_path, note(native="Kondapalli"))  # Latin, not Telugu
    assert _harvest(tmp_path) == 1
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}


def test_harvest_code_scope_pins_single_village(tmp_path):
    path, ov, bc = _vault(tmp_path, note(scope="code", native="14వ మైలు రాయి"))
    assert _harvest(tmp_path) == 0
    assert json.loads(bc.read_text(encoding="utf-8"))["te"]["584792"] == "14వ మైలు రాయి"
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}  # name layer untouched
    assert "status: merged" in path.read_text(encoding="utf-8")


def test_harvest_rejects_unknown_scope(tmp_path):
    _, ov, bc = _vault(tmp_path, note(scope="village"))
    assert _harvest(tmp_path) == 1
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}
    assert json.loads(bc.read_text(encoding="utf-8"))["te"] == {}


def test_harvest_flags_same_name_conflicts(tmp_path):
    _vault(tmp_path, note(native="కొండపల్లి", code="1"), fname="1.md")
    _vault(tmp_path, note(native="కొండపల్లె", code="2"), fname="2.md")  # same name, differs
    assert _harvest(tmp_path) == 1  # second note must error, not silently win


# --- generate --------------------------------------------------------------------
def _state_tree(tmp_path):
    web = tmp_path / "andhra_pradesh" / "web" / "data"
    web.mkdir(parents=True)
    (web / "villages.json").write_text(
        json.dumps(
            {
                "columns": ["name", "mandal", "code", "cat", "pin"],
                "rows": [
                    ["Agree", 0, 1, 0, ""],
                    ["Differ", 0, 2, 0, ""],
                    ["Seeded", 0, 3, 0, ""],
                ],
            }
        ),
        encoding="utf-8",
    )
    (web / "regions.json").write_text(json.dumps({"mandals": [{"n": "M1"}]}), encoding="utf-8")
    (web / "names_translit.json").write_text(
        json.dumps({"1": "same", "2": "నిజం", "3": "seeded"}), encoding="utf-8"
    )
    return web


def test_generate_writes_only_disagreements(tmp_path):
    _state_tree(tmp_path)
    rules = {"Agree": "same", "Differ": "వేరే", "Seeded": "x"}
    with mock.patch.object(m, "transliterate_batch", return_value=rules):
        with mock.patch.object(m, "load_name_seeds", return_value={"seeded": "సీడ్"}):
            with mock.patch.object(m, "load_code_overrides", return_value={}):
                assert m.generate("ap", limit=10, root=tmp_path) == 0
    out = tmp_path / "notes" / "translit-review" / "andhra_pradesh"
    files = sorted(p.name for p in out.glob("*.md"))
    assert files == ["2.md"]  # only the genuine disagreement
    meta = m.parse_note((out / "2.md").read_text(encoding="utf-8"))
    assert meta["neural"] == "నిజం" and meta["rules"] == "వేరే"
    assert meta["status"] == "needs-review"
    assert meta["scope"] == "name"  # default scope, editable per note

    # a second run never clobbers the existing note
    (out / "2.md").write_text("HUMAN EDIT", encoding="utf-8")
    with mock.patch.object(m, "transliterate_batch", return_value=rules):
        with mock.patch.object(m, "load_name_seeds", return_value={}):
            with mock.patch.object(m, "load_code_overrides", return_value={}):
                m.generate("ap", limit=10, root=tmp_path)
    assert (out / "2.md").read_text(encoding="utf-8") == "HUMAN EDIT"


def test_generate_skips_code_pinned_villages(tmp_path):
    _state_tree(tmp_path)
    rules = {"Agree": "same", "Differ": "వేరే", "Seeded": "x"}
    with mock.patch.object(m, "transliterate_batch", return_value=rules):
        with mock.patch.object(m, "load_name_seeds", return_value={"seeded": "సీడ్"}):
            with mock.patch.object(m, "load_code_overrides", return_value={"2": "పిన్"}):
                assert m.generate("ap", limit=10, root=tmp_path) == 0
    out = tmp_path / "notes" / "translit-review" / "andhra_pradesh"
    files = list(out.glob("*.md")) if out.exists() else []
    assert files == []  # the only disagreement (village 2) is pinned → no note
