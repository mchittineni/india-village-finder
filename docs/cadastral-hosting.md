# Cadastral (land-parcel) layer — data hosting

The Andhra Pradesh cadastral layer renders individual land parcels (with survey
numbers) from a single **PMTiles** archive, streamed to the browser via HTTP
**range requests** — the client only downloads the tiles for the current view
(tens of KB), never the whole file.

- **Dataset:** `APSAC_AP_Cadastrals.pmtiles` (~848 MB, ~4.08M plots)
- **Source:** [ramSeraph/indian_cadastrals](https://github.com/ramSeraph/indian_cadastrals)
  → `andhra-pradesh` release. Origin: AP State Applications Centre (APSAC). **CC0 1.0.**
- **Configured in:** `scraper/pipeline.py` → `STATES[28]["cadastre"]["url"]`
  (propagated to each state's `web/config.js` as `VF_CONFIG.cadastre.url`).

## Why the URL must move off the GitHub release

The upstream release URL serves range requests **but sends no CORS headers**, so
a browser on the deployed site (`*.github.io`) is blocked from reading it. The
committed URL is a **prototype placeholder**. Before launch, mirror the file to a
range-request + CORS enabled host and swap the URL. Cloudflare R2 is recommended
(S3-compatible API, zero egress fees).

## Option A — Cloudflare R2 (recommended, manual)

1. **Create a bucket**, e.g. `village-finder-cadastrals`.
2. **Upload the PMTiles** (R2 is S3-compatible; point the AWS CLI at your R2 endpoint):
   ```bash
   export AWS_ACCESS_KEY_ID=<r2-access-key>
   export AWS_SECRET_ACCESS_KEY=<r2-secret-key>
   ENDPOINT=https://<account-id>.r2.cloudflarestorage.com

   curl -L -o APSAC_AP_Cadastrals.pmtiles \
     https://github.com/ramSeraph/indian_cadastrals/releases/download/andhra-pradesh/APSAC_AP_Cadastrals.pmtiles

   aws s3 cp APSAC_AP_Cadastrals.pmtiles s3://village-finder-cadastrals/ \
     --endpoint-url "$ENDPOINT" --checksum-algorithm CRC32
   ```
3. **Expose it publicly** — enable the bucket's **public r2.dev** URL, or (better)
   attach a **custom domain** (e.g. `tiles.example.com`) via the R2 dashboard.
4. **Set CORS** on the bucket so the browser may issue range reads:
   ```json
   [
     {
       "AllowedOrigins": ["https://mchittineni.github.io", "http://localhost:8000"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
   Apply with:
   ```bash
   aws s3api put-bucket-cors --bucket village-finder-cadastrals \
     --endpoint-url "$ENDPOINT" --cors-configuration file://r2-cors.json
   ```
5. **Point the app at it** — set the URL in `scraper/pipeline.py`
   (`STATES[28]["cadastre"]["url"]`) to the public/custom-domain URL and
   re-run the build so every `web/config.js` regenerates.
6. **Verify** the host honours ranges + CORS:
   ```bash
   curl -sIL -H "Origin: https://mchittineni.github.io" -H "Range: bytes=0-99" \
     https://<your-host>/APSAC_AP_Cadastrals.pmtiles \
     | grep -iE "HTTP/|accept-ranges|content-range|access-control-allow-origin"
   ```
   Expect `206`, `accept-ranges: bytes`, a `content-range`, and
   `access-control-allow-origin`.

## Option B — CI mirror job

`.github/workflows/mirror-cadastrals.yml` automates steps 2–4 on manual dispatch
(fits the "run heavy transfers in Actions, not on a laptop" convention). It
requires these repo **secrets**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. After it runs once, update the config URL
(step 5 above) to the bucket's public/custom-domain URL. The workflow does **not**
edit the URL for you — that stays an explicit, reviewed change.

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

Toggle **Land parcels** (▦, top-right), zoom past level 14 into an AP village,
and click a plot to see its survey number.

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

## Optional: slim the tiles

The 848 MB size is a hosting concern only (clients fetch a few tiles per view).
If you want it smaller, re-tile with `tippecanoe` keeping just the fields used by
the app (`parcel_num`, `v_name`, `m_name`, `d_name`, `dmv_code`, `shape_area`) and
dropping low zooms — run that in CI, not locally.
