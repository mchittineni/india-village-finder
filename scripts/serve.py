#!/usr/bin/env python3
"""Local dev static server with HTTP Range + CORS support.

The cadastral (land-parcel) layer streams a PMTiles archive via HTTP *range*
requests. Python's stock ``http.server`` ignores ``Range`` and returns the whole
file, which breaks PMTiles. This server honours ``Range`` (206 Partial Content)
and adds permissive CORS, so you can serve the app and a locally-downloaded
PMTiles from the same origin and see AP parcels render without any hosting.

Usage
-----
    python scripts/serve.py                # serve repo root on :8000
    python scripts/serve.py --port 8080

Then (after downloading the PMTiles — see docs/cadastral-hosting.md) open:

    http://localhost:8000/andhra_pradesh/web/index.html?cad=/scraper/.cache/cadastrals/APSAC_AP_Cadastrals.pmtiles

Click the "Land parcels" toggle (top-right) and zoom past level 14 into an AP
village; click any plot to see its survey number. The ``?cad=`` query param is a
dev override that points the parcel layer at this local file.
"""

from __future__ import annotations

import argparse
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class RangeHandler(SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler + single-range support + CORS."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".pmtiles": "application/octet-stream",
        ".geojson": "application/geo+json",
    }

    def end_headers(self):
        # Mirror the CORS + range exposure a production tile host must provide.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):  # noqa: N802 (http.server naming)
        self.send_response(204)
        self.end_headers()

    def do_GET(self):  # noqa: N802
        rng = self.headers.get("Range")
        path = self.translate_path(self.path.split("?", 1)[0])
        if not rng or not os.path.isfile(path):
            return super().do_GET()

        m = RANGE_RE.match(rng.strip())
        if not m:
            self.send_error(400, "Invalid Range header")
            return

        size = os.path.getsize(path)
        start_s, end_s = m.group(1), m.group(2)
        if start_s == "":  # suffix range: last N bytes
            length = int(end_s or 0)
            start, end = max(0, size - length), size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1

        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return

        end = min(end, size - 1)
        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()

        with open(path, "rb") as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                chunk = fh.read(min(1 << 16, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


def main() -> None:
    ap = argparse.ArgumentParser(description="Dev static server with Range + CORS")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--dir", default=".", help="directory to serve (default: repo root)")
    args = ap.parse_args()
    os.chdir(args.dir)
    with ThreadingHTTPServer(("127.0.0.1", args.port), RangeHandler) as httpd:
        print(f"serving {os.getcwd()} at http://localhost:{args.port}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
