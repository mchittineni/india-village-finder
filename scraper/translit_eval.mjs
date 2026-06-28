#!/usr/bin/env node
/* =====================================================================
   translit_eval.mjs — measure transliteration fidelity.

   LGD publishes some village names in their own script (shipped as each state's
   web/data/names.json). Those are perfect, in-domain gold pairs: English name →
   official native spelling. This tool runs the web app's transliteration engine
   (web_template/i18n.js) on the English name and scores it against the official
   one, per state:

     exact   — share of names reproduced character-for-character
     charAcc — mean character accuracy (1 − normalised Levenshtein distance)

   It is the objective yardstick for the rule engine: change i18n.js, re-run, and
   see whether quality moved. With --check it exits non-zero below a floor, so CI
   catches a regression.

   Usage:  node scraper/translit_eval.mjs          # report
           node scraper/translit_eval.mjs --check   # report + enforce floor
   ===================================================================== */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
globalThis.window = {};
await import(join(HERE, "web_template", "i18n.js"));
const I = globalThis.window.VF_I18N;

// (slug, language the state's native names are written in)
const STATES = [
  ["andhra_pradesh", "te"],
  ["telangana", "te"],
  ["karnataka", "kn"],
  ["tamil_nadu", "ta"]
];
// Overall floors, set a few points below current so a routine LGD data refresh
// doesn't trip CI but a real engine regression does.
const FLOOR = { charAcc: 66.0, exact: 3.0 };

function lev(a, b) {
  const m = a.length,
    n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[m][n];
}
// Parentheticals in LGD names are translated (e.g. "(South)" → "(தெற்கு)"), not
// transliterable, so we compare the core name.
const clean = (s) =>
  (s || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

let TN = 0,
  TE = 0,
  TACC = 0;
const rows = [];
for (const [slug, lang] of STATES) {
  let names, vrows;
  try {
    names = JSON.parse(readFileSync(join(ROOT, slug, "web", "data", "names.json")));
    vrows = JSON.parse(readFileSync(join(ROOT, slug, "web", "data", "villages.json"))).rows;
  } catch {
    continue;
  }
  const byCode = new Map(vrows.map((r) => [String(r[2]), r[0]]));
  let n = 0,
    exact = 0,
    acc = 0;
  for (const [code, native] of Object.entries(names)) {
    const en = byCode.get(code);
    if (!en || en.includes("(")) continue;
    const gold = clean(native);
    const got = clean(I.translit(lang, en));
    if (!gold || !got) continue;
    n++;
    if (got === gold) exact++;
    acc += 1 - lev(got, gold) / Math.max(gold.length, got.length);
  }
  if (!n) continue;
  rows.push({ slug, lang, n, exact: (100 * exact) / n, charAcc: (100 * acc) / n });
  TN += n;
  TE += exact;
  TACC += acc;
}

const pad = (s, w) => String(s).padEnd(w);
console.log(`${pad("state", 16)}${pad("lang", 5)}${pad("pairs", 8)}${pad("exact", 9)}charAcc`);
for (const r of rows)
  console.log(
    `${pad(r.slug, 16)}${pad(r.lang, 5)}${pad(r.n, 8)}${pad(r.exact.toFixed(1) + "%", 9)}${r.charAcc.toFixed(1)}%`
  );
const oExact = TN ? (100 * TE) / TN : 0,
  oAcc = TN ? (100 * TACC) / TN : 0;
console.log(
  `${pad("OVERALL", 16)}${pad("", 5)}${pad(TN, 8)}${pad(oExact.toFixed(1) + "%", 9)}${oAcc.toFixed(1)}%`
);

if (process.argv.includes("--check")) {
  if (!TN) {
    console.error("FAIL: no gold pairs found (names.json missing?)");
    process.exit(1);
  }
  if (oAcc < FLOOR.charAcc || oExact < FLOOR.exact) {
    console.error(
      `FAIL: below floor (charAcc ${oAcc.toFixed(1)}% < ${FLOOR.charAcc}% or exact ${oExact.toFixed(1)}% < ${FLOOR.exact}%)`
    );
    process.exit(1);
  }
  console.log(
    `OK: charAcc ${oAcc.toFixed(1)}% ≥ ${FLOOR.charAcc}%, exact ${oExact.toFixed(1)}% ≥ ${FLOOR.exact}%`
  );
}
