#!/usr/bin/env node
/* translit_cli.mjs — batch transliteration bridge for the Python pipeline.

   Reads {"lang":"te","names":["Foo","Bar",...]} as JSON on stdin and writes a
   JSON array of the names transliterated into that language's script, using the
   web app's engine (web_template/i18n.js) so there is ONE transliteration
   implementation shared by the UI and the data exports. */
import { readFileSync } from "fs";

globalThis.window = {};
await import(new URL("./web_template/i18n.js", import.meta.url));
const I = globalThis.window.VF_I18N;

const { lang, names } = JSON.parse(readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify((names || []).map((n) => I.translit(lang, n))));
