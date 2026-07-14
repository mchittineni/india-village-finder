---
tags: [source]
verified: 2026-07-13
---

# LGD via data.gov.in (dataset of record)

- Resource: **"Local Government Directory (LGD) – Villages with PIN Codes"**,
  id `f17a1608-5f10-4610-bb50-a63c80d83974`, `api.data.gov.in/resource/…`.
- Auth: `$DATA_GOV_KEY` (free registered key, repo secret). The public sample
  key caps pages at 10 rows smoke tests only.
- **WAF trap**: the NIC/Citrix WAF answers **HTTP 502** to python-requests'
  default User-Agent while browsers pass. We send a project UA. Full story:
  [[2026-07-10-datagov-user-agent]].
- Server-side filter per state (`filters[stateCode]`), offset pagination that
  advances by rows actually returned.
- The feed does **not** carry the local-script name column → authoritative
  `names.json` is filled from OSM/override seeds; the neural path covers the
  rest ([[pipeline]]).
- Outage behavior: retry w/ backoff → cached CSVs → exit 75 skip.
- Every build cross-checks district/mandal counts against the **live**
  lgdirectory.gov.in and stores the verdict in `meta.json`.

LGD renumbers/drops villages in waves (13Jul2026: ~1,600 net changes across
the four states) this is why sidecar pruning exists
([[2026-07-13-sidecar-pruning]]).
