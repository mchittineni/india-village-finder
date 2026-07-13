<!--
title: A self-updating open-data site with zero servers: GitHub Actions, Pages, and branches as a CDN
tags: github, devops, opensource, architecture
audience: OSS maintainers / devops readers
-->

# A self-updating open-data site with zero servers: GitHub Actions, Pages, and branches as a CDN

[Village Finder](https://mchittineni.github.io/india-village-finder/) serves
interactive maps of ~68,000 Indian villages, refreshes its own data daily, and
publishes live market prices — with **no backend, no database, and a hosting
bill of ₹0**. Here's the architecture, including the one trick I haven't seen
written up much: using git branches as a free, CORS-enabled data CDN.

## The stack

- **GitHub Pages** — static hosting for the maps (vanilla JS + Leaflet, no
  build step).
- **GitHub Actions** — every pipeline: daily data refresh, boundary
  processing, releases, deploys.
- **GitHub Releases** — versioned dataset downloads (CSV/JSON/GeoJSON).
- **Cloudflare R2** — the one exception: ~GB-scale cadastral vector tiles
  need HTTP range requests + CORS at zero egress.

## Two kinds of data, two pipelines

The core insight that made CI sane: **not all generated data deserves the
same process.**

**1. The dataset of record → reviewed pull requests.** The village data
itself refreshes daily through a real PR: CI validates it (~100 tests:
referential integrity, count ranges, cross-checks against the live upstream
portal), a changelog bot writes what changed, and merging cuts a release and
deploys. The commit history is an auditable log of what the government
changed. Consecutive runs update the _same_ PR in place, so there's never a
pile of stale robot PRs.

**2. Regenerable artifacts → data branches.** Daily market prices, weekly
scheme snapshots, monthly boundary tiles — reviewing machine output that
regenerates tomorrow is rubber-stamping. These publish straight to dedicated
branches:

```
work="$(mktemp -d)" && cp out/*.json "$work" && cd "$work"
git init -q -b data/mandi-prices
git add . && git commit -q -m "data: mandi prices $(date -u +%FT%RZ)"
git push --force "https://x-access-token:${TOKEN}@github.com/${REPO}.git" data/mandi-prices
```

Force-pushed as a **single flat commit** every run — the branch never grows,
no PR, no history bloat.

## Branches as a CDN

The payoff: `raw.githubusercontent.com` serves any branch file with
`Access-Control-Allow-Origin: *`. So the app just fetches

```
https://raw.githubusercontent.com/<repo>/refs/heads/data/mandi-prices/<state>.json
```

at runtime. Daily prices update the moment the branch is pushed — **no
redeploy** — and the "database" costs nothing. For artifacts the site must
serve same-origin (PMTiles needs range requests), a tiny composite action
overlays those branches into the Pages artifact and release zips at build
time instead:

```yaml
- git fetch -q --depth 1 origin "data/boundary-tiles" && git checkout -q FETCH_HEAD -- .
```

Absent branches are skipped, so forks and first runs just work.

## Surviving flaky upstreams

Government APIs have bad days, and a nightly job that goes red on every
upstream outage trains you to ignore alerts. Fetchers here exit **75**
(`EX_TEMPFAIL`) when the source is unreachable after retries; a shared
composite treats that as a clean skip — keep yesterday's snapshot, note it in
the step summary, stay green. Anything else fails loud. That one convention
separates "the government is down" from "I broke something" at a glance.

## Small things that mattered

- **Composite actions** for the repeated steps (toolchain setup, the skip
  contract, branch publish/overlay) — each workflow is just its unique logic.
- **SHA-pin third-party actions**; pass inputs via `env:`, never interpolated
  into `run:`.
- `git add` pathspecs are not shell globs: `*/web/data` matches nothing,
  `*/web/data/**` matches everything. This one silently ate our data commits
  for a week while the workflow stayed green.
- `git diff --quiet` can't see untracked first-run outputs — gate on
  `git status --porcelain` instead.

Full source, workflows and an architecture decision log live in the repo:
<https://github.com/mchittineni/india-village-finder>
