<!-- Thanks for contributing! Please fill this in so reviewers can move fast. -->

## What does this PR do?

<!-- A short summary of the change and the motivation. -->

Closes #<!-- issue number, if any -->

## Type of change

- [ ] 🐛 Bug fix
- [ ] ✨ Feature / enhancement
- [ ] 🗂️ Data / pipeline change
- [ ] 📝 Documentation
- [ ] 🧹 Refactor / chore

## Checklist

- [ ] I ran the tests locally: `cd scraper && ./.venv/bin/python -m pytest tests -v` and they pass
- [ ] Formatting passes: `npm run format:check` (Prettier + Black)
- [ ] UI changes were made in **`scraper/web_template/`** (not the generated `*/web/` copies)
- [ ] New UI strings are in **all seven** languages in `i18n.js`, and new controls meet the
      accessibility floor (≥44 px tap target, visible focus, translated `aria-label`)
- [ ] I regenerated outputs if needed (`python scraper/pipeline.py --offline --no-verify`)
- [ ] Docs updated where relevant (README / folder READMEs)
- [ ] My changes follow the project's data licence (GODL-India) and code licence (MIT)

## Screenshots / notes (for UI changes)

<!-- Drop before/after screenshots or a short description here. -->
