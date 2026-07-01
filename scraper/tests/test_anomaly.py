"""
Data anomaly guardrails.

The daily pipeline rebuilds each state's data from data.gov.in. If an upstream
glitch silently drops or corrupts records, the structural tests in test_data.py
would still pass (the smaller dataset is internally consistent). These tests
compare the freshly built counts against what is committed at git HEAD and fail
if a headline count moved by more than a sane threshold — so a refresh PR that
loses, say, 15% of Telangana's villages is flagged for human review instead of
merging quietly.

When the working tree matches HEAD (normal CI on committed data, or a run with no
data change) the delta is zero and every test is a no-op. On the very first import
of a state (no HEAD version yet) the check is skipped.
"""

import json
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
STATE_SLUGS = ["andhra_pradesh", "telangana", "karnataka", "tamil_nadu"]
COUNT_KEYS = ["districts", "mandals", "villages"]

# Allowed shrink before we flag it. A real LGD reorg can move counts, but a drop
# past this is far more likely to be upstream corruption — worth a human look.
MAX_DROP = 0.10


def _head_counts(rel_path: str) -> dict | None:
    """counts{} from the committed (HEAD) meta.json, or None if it didn't exist."""
    try:
        out = subprocess.run(
            ["git", "show", f"HEAD:{rel_path}"],
            capture_output=True,
            text=True,
            check=True,
            cwd=ROOT,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    try:
        return json.loads(out.stdout).get("counts", {})
    except json.JSONDecodeError:
        return None


@pytest.mark.parametrize("slug", STATE_SLUGS)
def test_counts_not_collapsed_vs_head(slug):
    rel = f"{slug}/web/data/meta.json"
    cur_path = ROOT / rel
    if not cur_path.exists():
        pytest.skip(f"{slug}: no built meta.json")
    prev = _head_counts(rel)
    if not prev:
        pytest.skip(f"{slug}: no committed baseline at HEAD (initial import?)")
    cur = json.loads(cur_path.read_text(encoding="utf-8")).get("counts", {})

    for key in COUNT_KEYS:
        old, new = prev.get(key), cur.get(key)
        if not isinstance(old, int) or old <= 0 or not isinstance(new, int):
            continue
        floor = int(old * (1 - MAX_DROP))
        assert new >= floor, (
            f"{slug}: {key} dropped from {old:,} to {new:,} "
            f"(> {int(MAX_DROP * 100)}% below the committed baseline) — "
            f"likely an upstream data problem; review before merging."
        )
