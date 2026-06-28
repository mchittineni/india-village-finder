# Documentation

API reference documentation for the whole project, generated from in-code doc comments.

- **Web app (JavaScript)** — [JSDoc](https://jsdoc.app/) reads the TSDoc-style `/** … */`
  comments in `scraper/web_template/*.js` and renders a browsable reference (modules,
  functions, and the data-shape `@typedef`s).
- **Data pipeline (Python)** — [pdoc](https://pdoc.dev/) renders the module docstrings of
  the `scraper/*.py` scripts.

Both outputs are written under `docs/api/` (git-ignored — they're build artifacts) and
are also built in CI by [`.github/workflows/docs.yml`](../.github/workflows/docs.yml),
which uploads the rendered site as a downloadable artifact on every run.

## Build it locally

Prerequisites: Node.js (for JSDoc) and the Python dev environment (for pdoc).

```bash
# one-time
npm install                                  # JSDoc + docdash theme + Prettier
./scraper/.venv/bin/pip install -r scraper/requirements-dev.txt   # pdoc + black + pytest

# the Python step calls `python3 -m pdoc`, so make sure pdoc is on your python3
# (activate the venv, or install pdoc globally). CI installs it on the runner.
source scraper/.venv/bin/activate

# generate both references into docs/api/{js,python}
npm run docs            # = docs:js + docs:py
npm run docs:js         # JavaScript only  -> docs/api/js
npm run docs:py         # Python only      -> docs/api/python
npm run docs:clean      # remove docs/api
```

Open `docs/api/js/index.html` or `docs/api/python/index.html` in a browser.

## Formatting

The project is formatted by [Prettier](https://prettier.io/) (JS, JSON, CSS, HTML,
Markdown, YAML) and [Black](https://black.readthedocs.io/) (Python). Generated data
(`*/web/data/`, `*/data/`) is excluded — see `.prettierignore`.

```bash
npm run format          # Prettier (write) + Black over the repo
npm run format:check    # verify formatting without writing (suitable for CI)
```

## How docs stay accurate

The reference is generated from the source, so it can't drift: document a function by
editing the `/** … */` block above it (JS) or the docstring (Python), then re-run
`npm run docs`. The data-shape typedefs in `scraper/web_template/app.js` mirror the JSON
files in each `<state>/web/data/` directory.
