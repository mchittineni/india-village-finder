# Cadastral (land-parcel) layer — data hosting

The Andhra Pradesh, Telangana and Karnataka cadastral layers render individual
land parcels (with survey numbers) from per-state **PMTiles** archives, streamed
to the browser via HTTP **range requests** — the client only downloads the tiles
for the current view (tens of KB), never the whole file.

- **Datasets** (each from [ramSeraph/indian_cadastrals](https://github.com/ramSeraph/indian_cadastrals), **CC0 1.0**):
  | State | Object | Size | Upstream source |
  |-------|--------|------|-----------------|
  | Andhra Pradesh | `APSAC_AP_Cadastrals.pmtiles` | ~848 MB | AP State Applications Centre (APSAC) |
  | Telangana | `TRACGIS_Bhunaksha_Cadastrals.pmtiles` | ~649 MB | TRACGIS / Telangana Bhunaksha |
  | Karnataka | `KGISMAPS_KN_Cadastrals.pmtiles` | ~1042 MB | Karnataka GIS (KGIS) |
- **Configured in:** `scraper/config.py` → `STATES[<code>]["cadastre"]` (each
  block sets `url`, `sourceLayer` and a per-source `fields` key map; propagated to
  each state's `web/config.js` as `VF_CONFIG.cadastre`).
- **Field schemas differ per source agency.** APSAC and TRACGIS tiles carry place
  names, so the app highlights a selected village's parcels **by name**; KGIS
  tiles carry only codes but include the **LGD village code**, so Karnataka
  highlights **by code** (`fields.villageCode`) and its popups show just the
  survey number. Each block's `fields` maps the source's tile keys onto the roles
  the app reads (`survey`, `village`/`villageCode`, `mandal`, `district`, `area`).

## Hosting: Cloudflare R2 (live)

The upstream release URLs serve range requests **but send no CORS headers**, so a
browser on the deployed site (`*.github.io`) is blocked from reading them. Each
file is therefore mirrored to a **Cloudflare R2** bucket (S3-compatible, zero
egress) that answers range requests **with CORS**, and the config URLs point at
the bucket's public `r2.dev` origin. The mirror runs in CI — see below.

## Mirror via CI (primary path)

`.github/workflows/mirror-cadastrals.yml` mirrors **all three states** from the
upstream releases into R2 (fits the "run heavy transfers in Actions, not on a
laptop" convention). It requires these repo **secrets**: `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

- **Matrix, per state.** Each state (`andhra-pradesh`, `telangana`, `karnataka`)
  is an independent matrix leg (`fail-fast: false`), so one state's outage never
  cancels the others. Manual dispatch can target one state via the **only_state**
  input or all of them.
- **Auto-tracking.** Runs **weekly** and on manual dispatch. Each leg reads the
  upstream release's `updated_at`/`size` from the GitHub API and compares them to
  what it last stored in the R2 object's metadata — if a state's cadastre hasn't
  changed it **skips that transfer** entirely. The cadastre is refreshed rarely,
  so most weekly legs are no-ops. Use the **force** dispatch input to re-mirror
  regardless (e.g. after recreating the bucket).
- **CORS is not set by CI.** CORS is a one-time, **bucket-level** setting;
  `PutBucketCors` needs an **Admin** R2 token, but the recurring transfer should
  use a least-privilege **Object Read & Write** token. So the workflow's CORS
  step is best-effort (`continue-on-error`) — set CORS once in the dashboard
  (below), and the object-scoped token warns instead of failing.
- **The config URL stays a reviewed edit.** The workflow does **not** rewrite
  `scraper/config.py`; pointing the app at the bucket is an explicit change.

### One-time bucket setup

1. **Create a bucket**, e.g. `village-finder-cadastrals`, and set the four secrets.
2. **Run the workflow** (Actions → mirror-cadastrals → Run workflow, `only_state:
   all`, `force: true` the first time) to upload all three PMTiles.
3. **Expose it publicly** — enable the bucket's **public r2.dev** URL (R2 →
   bucket → Settings → Public access), or attach a **custom domain**. This gives
   an origin like `https://pub-<hash>.r2.dev`.
4. **Set CORS once** — R2 → bucket → Settings → CORS Policy → paste:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
5. **Point the app at it** — set each `STATES[<code>]["cadastre"]["url"]` in
   `scraper/config.py` to `https://<origin>/<object>.pmtiles` and re-run the
   build (or regenerate `web/config.js`) so every config picks up the URL.
6. **Verify** each object honours ranges + CORS:
   ```bash
   curl -sIL -H "Origin: https://mchittineni.github.io" -H "Range: bytes=0-99" \
     https://<origin>/APSAC_AP_Cadastrals.pmtiles \
     | grep -iE "HTTP/|accept-ranges|content-range|access-control-allow-origin"
   ```
   Expect `206`, `accept-ranges: bytes`, a `content-range`, and
   `access-control-allow-origin`.

Why we still depend on ramSeraph here: the state GIS servers serve the **vector**
cadastre only behind a **login token** (APSAC's `REVENUE/cadastral_ap` /
`cadastral/Parcel` FeatureServers, and the KGIS/TRACGIS equivalents); the sole
anonymous endpoints are raster PNG tile caches with no survey numbers. So
ramSeraph's CC0 extractions are the only open source of the vectorised,
survey-numbered parcels, and this job keeps our mirror current with them.

## Local verification (no hosting needed)

To see the AP parcels render right now, serve the app and a local copy of the
PMTiles from the same origin (so CORS is a non-issue):

```bash
# 1. Download the PMTiles into the gitignored cache (once):
mkdir -p scraper/.cache/cadastrals
curl -L -o scraper/.cache/cadastrals/APSAC_AP_Cadastrals.pmtiles \
  https://github.com/ramSeraph/indian_cadastrals/releases/download/andhra-pradesh/APSAC_AP_Cadastrals.pmtiles

# 2. Start the range-capable dev server (repo root):
python scripts/serve.py

# 3. Open, using the ?cad= dev override to point at the local file:
#    http://localhost:8000/andhra_pradesh/web/index.html?cad=/scraper/.cache/cadastrals/APSAC_AP_Cadastrals.pmtiles
```

Toggle **Land parcels** (▦, top-right), zoom past level 14 into a village, and
click a plot to see its survey number. The same `?cad=` override works for the
Telangana (`TRACGIS_Bhunaksha_Cadastrals.pmtiles`) and Karnataka
(`KGISMAPS_KN_Cadastrals.pmtiles`) apps against their own local copies.

## Village → parcel index (precise per-village jump)

Only ~16% of villages carry a point coordinate in the LGD data, so to let the app
jump precisely to a village's parcels we precompute a bounding box per village from
the cadastral tiles: `scraper/build_parcels_index.py` scans the max-zoom tiles,
aggregates each village's parcels into a lat/lng box keyed by **LGD village code**,
and writes `<slug>/web/data/parcels_index.json`. Districts changed in AP's 2022
reorganisation, so the crosswalk matches on **(mandal, village)** names, not
district.

Regenerate (heavy — whole-state tile scan, run in CI):

```bash
pip install pmtiles mapbox-vector-tile
python scraper/build_parcels_index.py --slug andhra_pradesh \
  --pmtiles scraper/.cache/cadastrals/APSAC_AP_Cadastrals.pmtiles
```

Or run the **build-parcels-index** workflow (manual dispatch), which downloads the
PMTiles, rebuilds the index, and opens a PR with the refreshed file. Current AP
match rate is ~70% of cadastral villages; the rest fall back to a best-effort
name highlight at runtime.

**Telangana and Karnataka** do not ship a committed `parcels_index.json` yet, so
their precise-jump path runs entirely at runtime: the app highlights a selected
village's parcels (TG by name, KA by LGD village code — see `fields` in
`config.py`), brings the mandal into view and fits to the highlighted plots. A
per-state index can be generated later to make the jump instant; KA is
especially clean since its tiles carry the LGD village code directly.

## Optional: slim the tiles

The 848 MB size is a hosting concern only (clients fetch a few tiles per view).
If you want it smaller, re-tile with `tippecanoe` keeping just the fields used by
the app (`parcel_num`, `v_name`, `m_name`, `d_name`, `dmv_code`, `shape_area`) and
dropping low zooms — run that in CI, not locally.
