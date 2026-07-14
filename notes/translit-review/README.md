# translit-review/: human verification queue for village names

This folder bridges the transliteration pipeline and a human reviewer. Each
note is one village where the **neural model (IndicXlit)** and the
**rule engine** disagree about the native-script name; exactly the cases
where a human decision is worth the time. Verified names are merged into
`scraper/translit_overrides.json`, the **highest-priority** name layer (it
beats both engines and survives every regeneration, unlike
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

The note's `scope` field picks how far the fix reaches:

- `scope: name` (the default): merged into `translit_overrides.json`, keyed
  by the English name: **every** village with that name in that language gets
  the spelling. Same spelling → same transliteration is the common case, so
  one verification can fix a dozen villages at once.
- `scope: code`: merged into `translit_overrides_by_code.json`, keyed by the
  LGD village code: the fix pins to **exactly this village**. Use it when the
  spelling must not propagate, e.g. a locally-used translated form of a
  descriptive name ("14 Mile Stone" → 14వ మైలు రాయి), or two same-named
  villages that genuinely spell it differently. Harvest also errors (rather
  than silently letting the last note win) if two name-scoped notes disagree
  about the same name; that's the signal to switch them to `scope: code`.

Statuses: `needs-review` → `verified` (you) → `merged` (harvest).
Use `status: rejected` for names you looked at and deliberately left to the
engines; generate won't recreate an existing note.

### When BOTH candidates are wrong

`verified_native` is free text; type the correct spelling from any source
(Google Maps' native label, the village's own signage/records, local
knowledge). Two cautions:

- **Transliterate, don't translate.** Google _Translate_ renders meaning:
  "Mile Stone" becomes మైలురాయి (the word for a milestone) instead of the
  place-name spelling మైల్ స్టోన్. Google _Maps_' native-language label, or how
  locals actually write the name, is the better reference. The script guard
  catches wrong-alphabet slips, but a fluent-looking mistranslation is exactly
  what only the human can catch.
- **Mind the scope.** A translated form is usually village-specific; set
  `scope: code` so it pins to that one village instead of renaming every
  same-named village in the language (the `scope: name` default is right for
  ordinary spelling fixes, where same name → same spelling).

## Reviewing fast in Obsidian

Open `notes/` as a vault, then:

- **Dashboard**: with the community **Dataview** plugin, this table is the
  live queue:

  ````
  ```dataview
  TABLE state, mandal, name_en, neural, rules
  FROM "translit-review"
  WHERE status = "needs-review"
  ```
  ````

- **Split panes**: queue table left, the note you're deciding right.
- **Typing Indic text**: the **Various Complements** community plugin set to
  read this folder auto-completes suffix spellings you've used before
  (`-palli` → పల్లి, `-halli` → ಹಳ್ಳಿ) as you type.
- **Skipping the terminal**: the **Obsidian Git** community plugin commits and
  pushes a finished review batch from inside the vault (it can't run scripts);
  pair it with the **Shell commands** plugin to put
  `python scraper/translit_review.py harvest` on a hotkey/ribbon button, so the
  whole verify → harvest → push loop happens without leaving Obsidian.

Everything is plain Markdown, so each verified name arrives as a reviewable
git diff; the audit trail of human decisions comes for free.
