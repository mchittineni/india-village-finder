"""
Tests for human-verified native-name seeds (config.load_name_seeds) and their use
in the neural transliterator (enrich_native_names.transliterate): seeds win over
the model, and when every name is seeded the model never loads.
"""

import sys
from pathlib import Path

SCRAPER = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRAPER))

import config  # noqa: E402
import enrich_native_names as enn  # noqa: E402


def test_load_name_seeds_override_beats_osm(tmp_path, monkeypatch):
    (tmp_path / "osm.json").write_text(
        '{"te": {"Anantapur": "OSM_TE", "Guntur": "OSM_G"}}', encoding="utf-8"
    )
    (tmp_path / "ov.json").write_text('{"te": {"anantapur": "OVERRIDE_TE"}}', encoding="utf-8")
    monkeypatch.setattr(config, "OSM_NAMES_FILE", tmp_path / "osm.json")
    monkeypatch.setattr(config, "OVERRIDES_FILE", tmp_path / "ov.json")

    seeds = config.load_name_seeds("te")
    assert seeds["anantapur"] == "OVERRIDE_TE"  # manual override wins
    assert seeds["guntur"] == "OSM_G"  # OSM fills the rest
    assert config.load_name_seeds("kn") == {}  # missing lang → empty


def test_missing_seed_files_are_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "OSM_NAMES_FILE", tmp_path / "nope.json")
    monkeypatch.setattr(config, "OVERRIDES_FILE", tmp_path / "nope2.json")
    assert config.load_name_seeds("te") == {}


def test_transliterate_uses_seeds_and_skips_model(monkeypatch):
    monkeypatch.setattr(enn, "load_name_seeds", lambda lang: {"anantapur": "సీడ్"})

    def _boom(*a, **k):
        raise AssertionError("model must not load when the name is seeded")

    monkeypatch.setattr(enn, "get_engine", _boom)
    out = enn.transliterate("te", ["Anantapur"], beam=4, cache={})
    assert out == {"Anantapur": "సీడ్"}


def test_transliterate_falls_back_to_cache_for_unseeded(monkeypatch):
    monkeypatch.setattr(enn, "load_name_seeds", lambda lang: {})

    def _boom(*a, **k):
        raise AssertionError("model must not load when the name is cached")

    monkeypatch.setattr(enn, "get_engine", _boom)
    out = enn.transliterate("te", ["Guntur"], beam=4, cache={"te:guntur": "గుంటూరు"})
    assert out == {"Guntur": "గుంటూరు"}
