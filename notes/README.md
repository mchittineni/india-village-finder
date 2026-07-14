# notes/: project knowledge vault

This folder is an **[Obsidian](https://obsidian.md)-compatible vault** holding the
project's institutional knowledge: where each dataset really comes from (and what
was tried and rejected), how the pipeline and CI fit together, and the decision
log with the _why_ behind non-obvious choices.

## Using it

- **In Obsidian**: _Open folder as vault_ → select this `notes/` directory.
  Obsidian will create a local `.obsidian/` config folder; it is git-ignored,
  so your workspace/theme never lands in the repo.
- **On GitHub**: every note is plain Markdown with YAML frontmatter and renders
  fine in the file browser; `[[wikilinks]]` are Obsidian-only sugar (start from
  [Home](Home.md) if you're reading on GitHub).

## Conventions

- One fact-cluster per note; link related notes with `[[wikilinks]]`.
- `data-sources/`: one dossier per upstream source: endpoints, auth quirks,
  failure modes, verification dates. **Update the note when a source changes.**
- `decisions/`: dated, append-only decision records (what, why, alternatives
  rejected). Never rewrite history; add a new note that supersedes.
- `architecture/`: living maps of the pipeline, web app, CI and data branches.
- `reference/`: curated numbers that need periodic manual refresh (e.g.
  notified fertilizer rates), each with its update cadence.
- Frontmatter `tags` are the only metadata; keep them coarse
  (`source`, `decision`, `architecture`, `reference`).

Nothing here is loaded by the app or the pipeline; it's documentation for
humans (and coding agents) working on the repo.
