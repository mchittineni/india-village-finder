<!--
title: I mapped all 68,000 villages of four Indian states — with live market prices, government schemes and soil data
tags: opensource, gis, india, webdev
audience: general dev readers (dev.to front page material)
-->

# I mapped all 68,000 villages of four Indian states — with live market prices, government schemes and soil data

If you've ever tried to find an Indian village online, you know the drill:
government portals with ten dropdowns, session timeouts, and names spelled
three different ways. India's **Local Government Directory (LGD)** actually
contains every village in the country, beautifully coded — but there's no map,
no search, and no way a farmer in Anantapur is going to use it.

So I built **[Village Finder](https://mchittineni.github.io/india-village-finder/)**:
an open-source, multilingual map of every village in **Andhra Pradesh,
Telangana, Karnataka and Tamil Nadu** — about **68,000 villages** across 130
districts — that keeps itself up to date.

## What it does

- **Visual drill-down** — districts shaded by village count → mandals/taluks →
  villages, with instant search across everything (including by pincode).
- **Six languages** — English, Telugu, Kannada, Tamil, Hindi, Urdu (RTL).
  Every village shows a native-script name, produced by a neural
  transliteration model where the government data doesn't provide one.
- **Land parcels** — actual cadastral survey plots for AP/Telangana/Karnataka
  (CC0 data from the state GIS agencies), streamed as vector tiles. Tap a
  parcel, copy its identifiers, jump to the official land-records portal.
- **Live mandi prices** — the day's APMC market quotes for the village's
  district, from the government's Agmarknet feed, refreshed daily.
- **Government schemes** — every Central + state agriculture scheme a farmer
  can apply for, with names in all six languages, refreshed weekly from the
  national myScheme platform.
- **Weather, soil & groundwater** — a 7-day agromet forecast, a per-village
  soil profile (type, pH, organic carbon + fertilizer guidance), and
  groundwater-prospect map overlays.

## The interesting constraint: no servers

The whole thing runs on **GitHub alone** — Pages for hosting, Actions for the
data pipelines, and a trick I'll write about separately: git branches as a
free, CORS-enabled CDN for daily data snapshots. The daily refresh opens a
reviewed pull request, CI validates the data (94+ tests), and merging deploys.
The commit history doubles as an auditable changelog of what the government
changed — which is more interesting than you'd think: one July refresh
renumbered ~1,600 villages in a single day.

## The data is yours too

Everything is open: the code is MIT, the datasets are GODL-India/CC0/CC-BY and
downloadable as CSV/JSON/GeoJSON from
[GitHub Releases](https://github.com/mchittineni/india-village-finder/releases) —
one row per village, with LGD codes, pincodes and native names.

**Try it:** <https://mchittineni.github.io/india-village-finder/>
**Source:** <https://github.com/mchittineni/india-village-finder>

If you work on civic tech, agritech, logistics, or just like maps — issues and
PRs are very welcome.
