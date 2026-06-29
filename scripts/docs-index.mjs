/**
 * Write docs/api/index.html — a small landing page that links the two generated
 * API references (JSDoc for the web app, pdoc for the Python pipeline).
 *
 * Run as part of `npm run docs` (after docs:js and docs:py have produced
 * docs/api/js and docs/api/python). Dependency-free; reads package.json only to
 * keep the app/repo links in sync with the manifest.
 */
import fs from "fs";
import path from "path";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const appUrl = pkg.homepage || "/";
const repoUrl = (pkg.repository?.url || "").replace(/\.git$/, "").replace(/^git\+/, "");

const outDir = "docs/api";
fs.mkdirSync(outDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Village Finder — API reference</title>
    <style>
      :root {
        --ink: #0f172a;
        --ink2: #475569;
        --line: #e6e8ec;
        --accent: #1f6feb;
        --bg: #f8fafc;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      .wrap {
        max-width: 760px;
        margin: 0 auto;
        padding: 64px 24px 48px;
      }
      h1 {
        margin: 0 0 4px;
        font-size: 30px;
        letter-spacing: -0.02em;
      }
      .sub {
        margin: 0 0 36px;
        color: var(--ink2);
      }
      .cards {
        display: grid;
        gap: 16px;
        grid-template-columns: 1fr 1fr;
      }
      @media (max-width: 560px) {
        .cards {
          grid-template-columns: 1fr;
        }
      }
      a.card {
        display: block;
        padding: 22px 22px 20px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 14px;
        text-decoration: none;
        color: inherit;
        transition:
          border-color 0.15s,
          transform 0.15s;
      }
      a.card:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      a.card h2 {
        margin: 0 0 6px;
        font-size: 18px;
      }
      a.card p {
        margin: 0;
        color: var(--ink2);
        font-size: 14px;
      }
      .foot {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
        color: var(--ink2);
        font-size: 14px;
      }
      .foot a {
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Village Finder — API reference</h1>
      <p class="sub">
        Generated from in-code documentation. Version ${pkg.version || ""}.
      </p>
      <div class="cards">
        <a class="card" href="./js/">
          <h2>Web app · JavaScript</h2>
          <p>Map, drill-down, search, transliteration and the data-shape contracts (JSDoc).</p>
        </a>
        <a class="card" href="./python/">
          <h2>Data pipeline · Python</h2>
          <p>The scraper modules that build each state's data from LGD open data (pdoc).</p>
        </a>
      </div>
      <p class="foot">
        <a href="${appUrl}">← Back to the app</a>${repoUrl ? ` &nbsp;·&nbsp; <a href="${repoUrl}">Source on GitHub</a>` : ""}
      </p>
    </main>
  </body>
</html>
`;

const outFile = path.join(outDir, "index.html");
fs.writeFileSync(outFile, html);
console.log("wrote", outFile);
