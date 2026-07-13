# translit-review/ — human verification queue for village names

This folder bridges the transliteration pipeline and a human reviewer. Each
note is one village where the **neural model (IndicXlit)** and the
**rule engine** disagree about the native-script name — exactly the cases
where a human decision is worth the time. Verified names are merged into
`scraper/translit_overrides.json`, the **highest-priority** name layer (it
beats both engines and survives every regeneration — unlike
`names_translit.json`, which is rebuilt weekly and pruned daily).

## The loop

```
python scraper/translit_review.py generate --state ap --limit 50   # fill the queue
# … review in Obsidian (see below) …
python scraper/translit_review.py harvest                          # merge verified names
# commit + PR: the pipeline ships them on the next refresh
```

For each note: put the correct spelling in `verified_native` (copy `neural`
or `rules` if one of them is right), set `status: verified`, done. Harvest
validates the text is really in the state's script (a Latin-keyboard slip
fails the run instead of reaching production) and flips merged notes to
`status: merged`.

Statuses: `needs-review` → `verified` (you) → `merged` (harvest).
Use `status: rejected` for names you looked at and deliberately left to the
engines — generate won't recreate an existing note.

## Reviewing fast in Obsidian

Open `notes/` as a vault, then:

- **Dashboard** — with the community **Dataview** plugin, this table is the
  live queue:

  ````
  ```dataview
  TABLE state, mandal, name_en, neural, rules
  FROM "translit-review"
  WHERE status = "needs-review"
  ```
  ````

- **Split panes** — queue table left, the note you're deciding right.
- **Typing Indic text** — the **Various Complements** community plugin set to
  read this folder auto-completes suffix spellings you've used before
  (`-palli` → పల్లి, `-halli` → ಹಳ್ಳಿ) as you type.

Everything is plain Markdown, so each verified name arrives as a reviewable
git diff — the audit trail of human decisions comes for free.
