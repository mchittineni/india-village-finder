<!--
title: Scraping Indian government open data in 2026: what actually works
tags: opendata, python, india, debugging
audience: developers who consume government APIs (strongest dev.to material)
-->

# Scraping Indian government open data in 2026: what actually works

I maintain [an open-source map](https://github.com/mchittineni/india-village-finder)
of ~68,000 Indian villages that rebuilds itself daily from government sources.
That means my CI talks to Indian government infrastructure every single day —
and over time you accumulate war stories. Here are the ones that would have
saved me days if someone else had written them down.

## 1. The WAF that hates python-requests

One week, every scheduled refresh started failing with `HTTP 502` after eight
retries — while the same URLs worked fine in a browser. Rate limit? IP block?
Maintenance window? I built (and later reverted) a fix based on the
time-of-day theory before doing the experiment I should have started with:

```
same host, same URL:
  curl UA            → 200
  python-requests UA → 502
```

The WAF in front of `api.data.gov.in` fingerprints the **User-Agent** and
answers 502 — not 403, _502_ — to python-requests/urllib3 defaults. The fix
was one line: identify yourself honestly.

```python
session.headers["User-Agent"] = "my-project/1.0 (+https://github.com/me/my-project)"
```

**Lesson:** when a government API errors only from scripts, A/B the User-Agent
from the same host _first_. And note the failure mode: a WAF that lies with
502s sends you chasing "transient upstream errors" that are neither transient
nor upstream.

## 2. Treat outages as a scheduled-job contract, not an exception

Government infrastructure has bad days. If your nightly job goes red every
time, alerts become noise and real bugs hide. I use the old Unix
`EX_TEMPFAIL` convention: fetchers exit **75** when the upstream is
unreachable after retries, and the workflow treats that as a clean _skip_ —
keep yesterday's snapshot, write a step-summary note, stay green. Any other
non-zero exit is a real failure and stays red. One composite action implements
the contract for every pipeline.

## 3. The API that exists but isn't documented (myScheme)

India's national scheme directory, [myScheme](https://www.myscheme.gov.in/),
has no public API — officially. But the frontend is a Next.js app calling
`api.myscheme.gov.in/search/v6/schemes` with a public client key embedded in
its JS bundle. Three findings:

- The key alone gets you `401 Unauthorized` — you also need the site's
  `Origin` and `Referer` headers.
- `lang=te|hi|kn|ta|ur` returns **localized scheme names** — a gift for a
  multilingual app.
- Frontend keys rotate with releases. My fetcher exits differently for
  "upstream down" (skip, keep last snapshot) vs "key rejected" (hard fail —
  a human needs to update it). Design for the rotation on day one.

## 4. Know when to walk away

Not everything can be integrated, and the professional move is documenting
_why_ with evidence, so you (or your successor) don't re-litigate dead ends:

- **CGWB / India-WRIS** (groundwater): the whole stack was down for weeks —
  timeouts even from Indian nodes, 502s, one NXDOMAIN.
- **urvarak.nic.in** (fertilizer stock): resets TCP connections to anything
  that isn't a browser. Dashboard only, no API.
- **Soil Health Card portal**: WAF 403s non-browser clients; undocumented
  React-app internals.
- Their data.gov.in dataset pages all say "Request API" — static parliamentary
  answers, no live resource.

For each, I found an alternative that _is_ open: Bhuvan's WMS for groundwater
prospects, ISRIC SoilGrids' point API for soil, and curated notified prices
for fertilizer (they're government-fixed — a table beats a scraper).

## 5. Names never match across systems

The market-price feed spells districts "Chittor" and "Dr.B.R.A.Konaseema";
the administrative directory says "Chittoor" and "Dr. B.R. Ambedkar
Konaseema". No shared codes. A small fuzzy matcher (normalized exact →
common-prefix + shared-token scoring with a threshold) fixed 100% of my
cases — but budget for this _between government systems_, not just between
government and user input.

---

The result of all this plumbing: a map where a farmer can see their village,
today's mandi prices, applicable schemes and a soil profile — in their own
language. Source, data and the full decision log (including everything that
_didn't_ work) are open:
<https://github.com/mchittineni/india-village-finder>
