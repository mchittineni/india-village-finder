<!--
title: Rendering 68,000 Indian village names in six scripts (when the government only gives you English)
tags: i18n, machinelearning, india, javascript
audience: i18n / ML-adjacent devs (niche but memorable)
-->

# Rendering 68,000 Indian village names in six scripts (when the government only gives you English)

A village map for India that only shows English names fails the people it's
for. [Village Finder](https://mchittineni.github.io/india-village-finder/)
renders every one of its ~68,000 villages in Telugu, Kannada, Tamil, Hindi and
Urdu — and the pipeline behind that is more interesting than it sounds,
because the government feed we build from carries **no native-script names at
all**.

## A layered fallback, ordered by trust

Every village name resolves through four layers, best available wins:

1. **Authoritative** — the government's own in-script spelling, when a source
   publishes it. (Our current feed doesn't, but the slot stays first so wiring
   such a source back in automatically upgrades everything.)
2. **Human-verified seeds** — names harvested from OpenStreetMap's
   `name:te` / `name:kn` / `name:ta` tags, plus a hand-curated override file.
   Crowd-sourced, but humans wrote them.
3. **Neural transliteration** — [AI4Bharat's IndicXlit](https://ai4bharat.iitm.ac.in/),
   a trained English→Indic transliteration model, run **offline** in a weekly
   job. The output is committed as plain JSON — CI and the browser never load
   PyTorch.
4. **Rule engine** — a morpheme-aware transliterator in the browser as the
   final fallback. It renders common place-name suffixes (`-pur`, `-palli`,
   `-puram`, `-halli`) from canonical spellings instead of letter-by-letter,
   which is where naive transliteration goes wrong.

The English name is always kept on hover and used for search — native
rendering should add, never obscure.

## Measure it or it will rot

Transliteration quality is easy to hand-wave. We score both the neural model
and the rule engine against the official native names the government _does_
publish elsewhere (exact-match % + character accuracy), and CI enforces a
floor — a change that degrades name quality fails the build like any other
regression.

## The unglamorous hard part: churn

The government renumbers and drops villages in waves — one July refresh
changed ~1,600 across four states in a day. Any committed artifact keyed by
village code (neural names, coordinates) silently rots unless something owns
its lifecycle. Our rule: the daily pipeline **prunes** every such sidecar
against the day's valid codes, and the slower weekly/monthly jobs back-fill
genuinely new entries. Tests assert the invariant, so a renumbering wave
fails loudly instead of shipping orphaned names.

## Six-language UI is a discipline, not a feature

Beyond names, every UI string exists in all six languages (Urdu is RTL),
including domain terms where the _local_ word is the real one — a soil-type
panel that says "Vertisols" means nothing to a farmer who knows their land as
నల్లరేగడి (black cotton soil). The i18n dictionary treats those local terms as
first-class translations, not footnotes.

All of it — the fallback chain, the eval harness, the pruning rules — is open
source: <https://github.com/mchittineni/india-village-finder>
