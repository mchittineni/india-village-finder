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


def note(status="verified", native="కొండపల్లి", lang="te", name_en="Kondapalli"):
    return m.emit_note(
        {
            "lgd_code": "584792",
            "state": "Andhra Pradesh",
            "mandal": "Ibrahimpatnam",
            "name_en": name_en,
            "lang": lang,
            "neural": "కొండపల్లి",
            "rules": "కొండపలి",
            "status": status,
            "verified_native": native,
        },
        "### Context notes\n",
    )


def _vault(tmp_path, text):
    d = tmp_path / "notes" / "translit-review" / "andhra_pradesh"
    d.mkdir(parents=True)
    (d / "584792.md").write_text(text, encoding="utf-8")
    ov = tmp_path / "translit_overrides.json"
    ov.write_text(json.dumps({"_comment": "x", "te": {}, "kn": {}, "ta": {}}), encoding="utf-8")
    return d / "584792.md", ov


# --- frontmatter round-trip ---------------------------------------------------
def test_parse_note_roundtrip():
    meta = m.parse_note(note())
    assert meta["lgd_code"] == "584792"
    assert meta["verified_native"] == "కొండపల్లి"
    assert meta["status"] == "verified"
    assert m.parse_note("no frontmatter here") is None


# --- harvest --------------------------------------------------------------------
def test_harvest_merges_verified_into_overrides(tmp_path):
    path, ov = _vault(tmp_path, note())
    assert m.harvest(dry_run=False, root=tmp_path, overrides_file=ov) == 0
    merged = json.loads(ov.read_text(encoding="utf-8"))
    assert merged["te"]["kondapalli"] == "కొండపల్లి"  # lowercased english key
    assert "status: merged" in path.read_text(encoding="utf-8")  # queue stays clean


def test_harvest_ignores_needs_review_and_dry_run_writes_nothing(tmp_path):
    path, ov = _vault(tmp_path, note(status="needs-review"))
    assert m.harvest(dry_run=False, root=tmp_path, overrides_file=ov) == 0
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}

    path.write_text(note(), encoding="utf-8")
    assert m.harvest(dry_run=True, root=tmp_path, overrides_file=ov) == 0
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}  # untouched
    assert "status: verified" in path.read_text(encoding="utf-8")


def test_harvest_rejects_wrong_script(tmp_path):
    _, ov = _vault(tmp_path, note(native="Kondapalli"))  # Latin, not Telugu
    assert m.harvest(dry_run=False, root=tmp_path, overrides_file=ov) == 1
    assert json.loads(ov.read_text(encoding="utf-8"))["te"] == {}


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
            assert m.generate("ap", limit=10, root=tmp_path) == 0
    out = tmp_path / "notes" / "translit-review" / "andhra_pradesh"
    files = sorted(p.name for p in out.glob("*.md"))
    assert files == ["2.md"]  # only the genuine disagreement
    meta = m.parse_note((out / "2.md").read_text(encoding="utf-8"))
    assert meta["neural"] == "నిజం" and meta["rules"] == "వేరే"
    assert meta["status"] == "needs-review"

    # a second run never clobbers the existing note
    (out / "2.md").write_text("HUMAN EDIT", encoding="utf-8")
    with mock.patch.object(m, "transliterate_batch", return_value=rules):
        with mock.patch.object(m, "load_name_seeds", return_value={}):
            m.generate("ap", limit=10, root=tmp_path)
    assert (out / "2.md").read_text(encoding="utf-8") == "HUMAN EDIT"
