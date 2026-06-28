# Contributing

Thanks for your interest in improving **Village Finder**! 🇮🇳🗺️

There are two kinds of contributions, and they work a little differently.

## 1. Report a data problem (no coding needed)

The village / mandal / district / pincode data comes from the **Local Government
Directory (LGD)**. If something is wrong or missing:

- Open a **[Data correction issue](../../issues/new?template=data_correction.yml)** — tell us
  the state, district, mandal, village, and what's wrong vs. what it should be.
- For errors in the _source_ records, please also report them to
  [lgdirectory.gov.in](https://lgdirectory.gov.in) so they're fixed upstream for everyone.

We don't hand-edit data files (they're regenerated automatically) — instead we fix the
mapping logic or flag the upstream record.

## 2. Contribute code

```bash
git clone https://github.com/mchittineni/india-village-finder
cd india-village-finder/scraper
python3 -m venv .venv
./.venv/bin/pip install -r requirements-dev.txt
./.venv/bin/python -m pytest tests -v      # make sure tests pass
```

- The map UI lives in **`scraper/web_template/`** (single source of truth) — never edit
  `*/web/*.js|css|html` directly; they're generated copies. Run
  `python scraper/pipeline.py --offline --no-verify` to regenerate them.
- The data pipeline is in **`scraper/`** — see [`scraper/README.md`](scraper/README.md).
- Preview locally: `python3 -m http.server 8777` from the repo root, then open
  `http://localhost:8777/`.

### Pull requests

1. Branch off `main` (`feat/…`, `fix/…`, `docs/…`).
2. Use clear, imperative commit messages with a type prefix — `feat:`, `fix:`,
   `docs:`, `ci:`, `chore:`.
3. Keep changes focused; update docs/tests as needed.
4. Make sure the **`data-validation`** check passes.
5. Open a PR using the template. PRs are **auto-labelled** by the paths they touch.
   A maintainer (and/or GitHub Copilot) reviews before merge — `main` is protected,
   so everything lands via a reviewed PR.

### Good places to start

Look for [`good first issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
and [`help wanted`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) labels.
Ideas: adding a new state, improving village coordinate coverage, accessibility, or a public API.

## Code of conduct

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).
