"""
Data-validity tests for the Andhra Pradesh + Telangana village datasets.

These run in CI on every pull request (and on push to main) to verify both the
existing committed data and the newly built data in a refresh PR. A failure
blocks the merge.

For each state we check the per-state web payload:
    <state>/web/data/regions.json     districts + mandals (+ counts) for the map
    <state>/web/data/villages.json    columnar village list
    <state>/web/data/meta.json        provenance + counts
    <state>/web/data/districts.geojson, mandals.geojson  map polygons
    <state>/data/<state>_villages.csv flat export
"""
import csv
import io
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent

# (slug, expected LGD state code, display name, sane village range)
STATES = [
    ("andhra_pradesh", 28, "Andhra Pradesh", (10_000, 30_000)),
    ("telangana", 36, "Telangana", (5_000, 20_000)),
    ("karnataka", 29, "Karnataka", (20_000, 45_000)),
    ("tamil_nadu", 33, "Tamil Nadu", (10_000, 25_000)),
]
# AP/Telangana/Karnataka/Tamil Nadu lie roughly within this lon/lat box (generous
# margin). Karnataka reaches the west coast (~74 E) and Tamil Nadu reaches
# Kanyakumari (~8 N), so the box is wider/taller than AP/TG alone.
BBOX = (74.0, 7.5, 86.5, 20.5)  # min_lon, min_lat, max_lon, max_lat
GEO_COVERAGE_MIN = 0.80  # >=80% of regions should have a matching polygon


def load(slug, name):
    return json.loads((ROOT / slug / "web" / "data" / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module", params=STATES, ids=[s[0] for s in STATES])
def state(request):
    slug, code, name, vrange = request.param
    return {
        "slug": slug, "code": code, "name": name, "vrange": vrange,
        "regions": load(slug, "regions.json"),
        "villages": load(slug, "villages.json"),
        "meta": load(slug, "meta.json"),
    }


# --------------------------------------------------------------------------- #
# regions.json
# --------------------------------------------------------------------------- #
def test_regions_header(state):
    r = state["regions"]
    assert r["state"] == state["name"]
    assert r["state_code"] == state["code"]
    assert r["districts"] and r["mandals"]


def test_district_indices_and_codes_unique(state):
    ds = state["regions"]["districts"]
    assert [d["i"] for d in ds] == list(range(len(ds))), "district indices must be 0..n-1 in order"
    codes = [d["c"] for d in ds]
    assert len(set(codes)) == len(codes), "duplicate district codes"
    assert all(d["n"].strip() for d in ds), "empty district name"


def test_mandal_indices_codes_and_parents(state):
    r = state["regions"]
    ms = r["mandals"]
    n_d = len(r["districts"])
    assert [m["i"] for m in ms] == list(range(len(ms))), "mandal indices must be 0..n-1 in order"
    codes = [m["c"] for m in ms]
    assert len(set(codes)) == len(codes), "duplicate mandal codes"
    assert all(0 <= m["d"] < n_d for m in ms), "mandal points to invalid district index"
    assert all(m["n"].strip() for m in ms), "empty mandal name"


def test_counts_are_internally_consistent(state):
    r = state["regions"]
    n_villages = len(state["villages"]["rows"])
    assert sum(d["vc"] for d in r["districts"]) == n_villages
    assert sum(m["vc"] for m in r["mandals"]) == n_villages
    # each district's count equals the sum of its mandals' counts
    by_d = {}
    for m in r["mandals"]:
        by_d[m["d"]] = by_d.get(m["d"], 0) + m["vc"]
    for d in r["districts"]:
        assert by_d.get(d["i"], 0) == d["vc"], f"district {d['n']} count mismatch"


# --------------------------------------------------------------------------- #
# villages.json
# --------------------------------------------------------------------------- #
def test_village_rows_structure(state):
    v = state["villages"]
    assert v["columns"] == ["name", "mandal", "code", "cat", "pin"]
    n_m = len(state["regions"]["mandals"])
    codes = set()
    for row in v["rows"]:
        assert len(row) == 5
        name, mi, code, cat, pin = row
        assert isinstance(name, str) and name.strip()
        assert 0 <= mi < n_m, "village references invalid mandal index"
        assert cat in (0, 1)
        assert pin == "" or (isinstance(pin, str) and pin.isdigit() and len(pin) == 6), \
            f"bad pincode {pin!r}"
        codes.add(code)
    assert len(codes) == len(v["rows"]), "duplicate village codes"


def test_pincode_coverage(state):
    v = state["villages"]
    with_pin = sum(1 for r in v["rows"] if r[4])
    frac = with_pin / len(v["rows"])
    assert frac >= 0.95, f"only {frac:.1%} of villages have a pincode"
    assert state["meta"]["counts"].get("with_pincode") == with_pin


def test_coords_valid(state):
    """coords.json (precise village coordinates) is optional, but if present it must
    be well-formed and inside the AP/TG bounding box, keyed by real village codes."""
    path = ROOT / state["slug"] / "web" / "data" / "coords.json"
    if not path.exists():
        return
    coords = json.loads(path.read_text(encoding="utf-8"))
    village_codes = {str(r[2]) for r in state["villages"]["rows"]}
    min_lon, min_lat, max_lon, max_lat = BBOX
    for code, ll in coords.items():
        assert code in village_codes, f"coords for unknown village {code}"
        assert isinstance(ll, list) and len(ll) == 2
        lat, lng = ll
        assert min_lat <= lat <= max_lat and min_lon <= lng <= max_lon, \
            f"coord {ll} outside AP/TG bbox"
    if "with_coords" in state["meta"]["counts"]:
        assert state["meta"]["counts"]["with_coords"] == len(coords)


def test_village_count_in_range(state):
    lo, hi = state["vrange"]
    n = len(state["villages"]["rows"])
    assert lo <= n <= hi, f"{state['slug']} has {n} villages, outside sane range {state['vrange']}"


# --------------------------------------------------------------------------- #
# meta.json
# --------------------------------------------------------------------------- #
def test_meta_matches_regions(state):
    m = state["meta"]
    r = state["regions"]
    assert m["state_code"] == state["code"]
    assert m["counts"]["districts"] == len(r["districts"])
    assert m["counts"]["mandals"] == len(r["mandals"])
    assert m["counts"]["villages"] == len(state["villages"]["rows"])
    assert m.get("source_date")


def test_meta_verification_present(state):
    """If the live LGD cross-check ran, it must not have failed."""
    v = state["meta"].get("verification", {})
    # ok == False means a real mismatch; None means it couldn't run (network) — allowed.
    assert v.get("ok") in (True, None), f"live LGD verification failed: {v.get('checks')}"


# --------------------------------------------------------------------------- #
# CSV export
# --------------------------------------------------------------------------- #
def test_csv_matches_villages(state):
    path = ROOT / state["slug"] / "data" / f"{state['slug']}_villages.csv"
    rows = list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8"))))
    assert len(rows) == len(state["villages"]["rows"]), "CSV row count != villages.json"
    expected_cols = {"State", "District", "District Code", "Mandal", "Mandal Code",
                     "Village", "Village (Native)", "Native Source", "Village Code",
                     "Category", "Status"}
    assert expected_cols.issubset(rows[0].keys())
    assert all(r["State"] == state["name"] for r in rows)
    csv_codes = {int(r["Village Code"]) for r in rows}
    json_codes = {row[2] for row in state["villages"]["rows"]}
    assert csv_codes == json_codes, "village codes differ between CSV and JSON"


def test_csv_native_names_populated(state):
    """Every village should carry a native-script name (authoritative or
    transliterated), tagged with its source."""
    path = ROOT / state["slug"] / "data" / f"{state['slug']}_villages.csv"
    rows = list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8"))))
    filled = sum(1 for r in rows if r["Village (Native)"].strip())
    assert filled / len(rows) >= 0.95, f"{state['slug']}: only {filled}/{len(rows)} native names"
    assert all(r["Native Source"] in ("LGD", "transliterated", "") for r in rows)
    # a native name must declare its source, and vice versa
    assert all(bool(r["Village (Native)"].strip()) == bool(r["Native Source"].strip())
               for r in rows)


# --------------------------------------------------------------------------- #
# GeoJSON boundaries
# --------------------------------------------------------------------------- #
def _geo(slug, name):
    return json.loads((ROOT / slug / "web" / "data" / name).read_text(encoding="utf-8"))


def _coords_in_bbox(geom):
    min_lon, min_lat, max_lon, max_lat = BBOX

    def walk(c):
        if isinstance(c[0], (int, float)):
            lon, lat = c[0], c[1]
            return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat
        return all(walk(x) for x in c)

    return walk(geom["coordinates"])


def test_district_geojson_valid_and_joins(state):
    gj = _geo(state["slug"], "districts.geojson")
    assert gj["type"] == "FeatureCollection" and gj["features"]
    region_codes = {d["c"] for d in state["regions"]["districts"]}
    poly_codes = set()
    for f in gj["features"]:
        p = f["properties"]
        assert isinstance(p.get("c"), int) and p["c"] > 0 and p.get("n"), "missing/invalid polygon code"
        assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")
        assert _coords_in_bbox(f["geometry"]), "district polygon outside AP/TG bbox"
        poly_codes.add(p["c"])
    # most districts should have a polygon ...
    coverage = len(poly_codes & region_codes) / len(region_codes)
    assert coverage >= GEO_COVERAGE_MIN, f"only {coverage:.0%} of districts have polygons"
    # ... and almost every polygon should map to a current district (a few may be
    # legitimately stale after a reorganisation, but not a wholesale mismatch).
    joinable = len(poly_codes & region_codes) / len(poly_codes)
    assert joinable >= 0.90, f"only {joinable:.0%} of district polygons join to current data"


def test_mandal_geojson_valid_and_joins(state):
    gj = _geo(state["slug"], "mandals.geojson")
    assert gj["type"] == "FeatureCollection" and gj["features"]
    region_codes = {m["c"] for m in state["regions"]["mandals"]}
    district_codes = {d["c"] for d in state["regions"]["districts"]}
    poly_codes = set()
    for f in gj["features"]:
        p = f["properties"]
        assert isinstance(p.get("c"), int) and p["c"] > 0 and p.get("n"), "missing/invalid polygon code"
        assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")
        poly_codes.add(p["c"])
    coverage = len(poly_codes & region_codes) / len(region_codes)
    assert coverage >= GEO_COVERAGE_MIN, f"only {coverage:.0%} of mandals have polygons"
    joinable = len(poly_codes & region_codes) / len(poly_codes)
    assert joinable >= 0.90, f"only {joinable:.0%} of mandal polygons join to current data"


# --------------------------------------------------------------------------- #
# cross-state invariant
# --------------------------------------------------------------------------- #
def test_village_codes_disjoint_across_states():
    """LGD village codes are globally unique, so no two states may overlap."""
    import itertools
    codes = {slug: {row[2] for row in load(slug, "villages.json")["rows"]}
             for slug, *_ in STATES}
    for a, b in itertools.combinations(codes, 2):
        assert codes[a].isdisjoint(codes[b]), f"village codes overlap between {a} and {b}"
