<!--
title: What should a village map show a farmer? Prices, schemes, weather and soil — from sources that actually work
tags: civictech, agriculture, india, opendata
audience: civic-tech / agritech readers (good Medium material)
-->

# What should a village map show a farmer? Prices, schemes, weather and soil — from sources that actually work

[Village Finder](https://mchittineni.github.io/india-village-finder/) started
as a search-and-map tool for ~68,000 villages across Andhra Pradesh,
Telangana, Karnataka and Tamil Nadu. But once someone has found their village
on a map, the obvious question is: _what can this page do for them?_ For most
of rural India, the answer is farming. Here's what the village page shows now,
and — because this is the hard part — where each piece of data really comes
from.

## Today's mandi prices

Tap a village → the day's APMC market quotes for its district: commodity,
variety, min–max and modal price in ₹/quintal, grouped by market, searchable.
Source: the government's **Agmarknet** feed via the data.gov.in API,
snapshotted daily by CI. One wrinkle worth knowing: Agmarknet spells district
names its own way ("Chittor", "Dr.B.R.A.Konaseema"), so a small fuzzy matcher
bridges it to the administrative directory's spellings.

## Government schemes, in your language

The schemes panel lists every Central and state agriculture scheme a farmer
can apply for — PM-KISAN, crop insurance (PMFBY), Kisan Credit Card, plus the
state's own — each linking to its how-to-apply page on the national
**myScheme** platform. Scheme names come localized in all six UI languages
(English, Telugu, Hindi, Kannada, Tamil, Urdu) straight from the source, and
the list refreshes weekly. Honest caveat: myScheme's state-level coverage is
uneven — Tamil Nadu lists dozens of state agriculture schemes, Andhra Pradesh
currently near none — so the panel is only as complete as the national
catalog.

## A soil & fertilizer profile — with honest framing

Tap "Soil & fertilizer" and the village pin answers with:

> **Soil type**: Vertisols — black cotton soil · clay loam
> pH 6.9 (neutral) · organic carbon 1.9%
> Balanced N-P-K use guide (all-India): 4:2:1
> _Alkaline soil — zinc availability drops, so Zn-deficiency risk is high;
> confirm with a soil test before applying zinc sulphate._

The soil class and topsoil properties come from **ISRIC SoilGrids** (a 250 m
global model, CC-BY); the texture bucket, pH class and the nutrient note are
derived by standard agronomic rules. Two design choices matter here:

1. **Local names.** Farmers don't say "Vertisols" — they say నల్లరేగడి,
   काली रेगुर, ಎರೆ ಮಣ್ಣು, கரிசல். The profile maps the scientific class to the
   common name in each language.
2. **Honest limits.** Everything is labelled a _model estimate_, with a link
   to get a real Soil Health Card test. A model is a starting point, not a
   prescription — an app that pretends otherwise would do harm.

Fertilizer prices are shown as the government-notified reference (urea's
statutory MRP, NBS-subsidised DAP) so a farmer knows what they _should_ be
paying — with links to the official stock and soil-card portals for the rest.
Why links instead of live data? Because the live fertilizer-stock and
soil-test systems currently block automated access entirely — and shipping a
fragile scraper that fails silently is worse than an honest link.

## Weather, water, land

Rounding it out: a 7-day agromet forecast (Open-Meteo, keyless), a
groundwater-prospects overlay (ISRO's Bhuvan), and — for AP/TG/KA — the
actual cadastral survey plots (CC0 from the state GIS agencies), with a
one-tap path to the official land-records portal for a parcel's FMB sketch.

## The meta-lesson

Every feature above follows one rule: **use the official source when it's
open, say so when it isn't, and never dress up a model as a measurement.**
The whole project — code, data, and a decision log documenting every source
that was evaluated and rejected — is open:
<https://github.com/mchittineni/india-village-finder>
