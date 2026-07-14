/** =====================================================================
   AP, Telangana, Karnataka, Tamil Nadu & Kerala Village Finder — i18n
   Exposes window.VF_I18N:
     LANGS              [{code, name, dir}, ...]
     t(lang, key, p)    translate a UI string ({n}-style placeholders)
     translit(lang, s)  best-effort transliteration of a Roman place name
                        into Telugu / Devanagari / Kannada / Tamil / Malayalam /
                        Urdu script
     dirOf(lang)        "ltr" | "rtl"

   Sub-district tier: AP/Telangana call it a "Mandal", Karnataka, Tamil Nadu &
   Kerala a "Taluk". Both term families are provided; the app picks one via
   config.division.

   NOTE ON TRANSLITERATION
   The official LGD open data only carries *English* place names, so the
   native-script names below are produced by a rule-based phonetic engine.
   They are approximate (especially for Urdu, which omits short vowels) and
   are always shown alongside the canonical English name (hover / search).

   @module web/i18n
   @file UI-string dictionary plus a rule-based Roman→Indic/Urdu place-name
   transliteration engine, exposed as `window.VF_I18N`.
   ===================================================================== */
/**
 * @typedef {Object} Lang  A selectable UI language.
 * @property {string} code  Language code (en | te | kn | ta | ml | hi | ur).
 * @property {string} name  Endonym shown in the picker.
 * @property {("ltr"|"rtl")} dir  Text direction.
 */
window.VF_I18N = (function () {
  "use strict";

  // ---------------------------------------------------------------- UI text
  var DICT = {
    en: {
      village_finder: "Village Finder",
      search_ph: "Search any village, mandal or district…",
      all_districts: "All districts",
      districts: "Districts",
      mandals: "Mandals",
      villages: "Villages",
      district: "District",
      mandal: "Mandal",
      village: "Village",
      district_word: "district",
      mandal_word: "mandal",
      taluks: "Taluks",
      taluk: "Taluk",
      taluk_word: "taluk",
      n_taluks: "{n} taluks",
      villages_per_taluk: "Villages per taluk",
      taluk_note: "Shown at taluk level — exact village coordinates aren’t in the open data.",
      az: "A → Z",
      rural: "Rural",
      urban: "Urban",
      results: "Results",
      matches: "{n} matches",
      no_match: "No village, mandal or district matches “{q}”.",
      no_villages: "No villages listed for this area.",
      villages_per_district: "Villages per district",
      villages_per_mandal: "Villages per mandal",
      villages_per_area: "Villages per area",
      updated: "Updated",
      n_villages: "{n} villages",
      n_mandals: "{n} mandals",
      loading_data: "Loading data…",
      loading_map: "Loading map…",
      data_lgd: "Data: LGD",
      mirror: "Mirror",
      report_issue: "Report an issue",
      source: "Source",
      home: "Home — all states",
      language: "Language",
      hide_panel: "Hide panel",
      show_panel: "Show panel",
      clear: "Clear",
      currently_viewing: "Currently viewing {state}",
      approx_note: "Approximate location (matched via GeoNames).",
      mandal_note: "Shown at mandal level — exact village coordinates aren’t in the open data.",
      boundary_missing: "Map boundary not yet published for {name} (a new district).",
      loc_missing: "Location of {name} isn’t on the map yet.",
      pin_label: "PIN",
      lgd_label: "LGD",
      parcels_toggle: "Land parcels",
      parcels_zoom_hint: "Zoom in to see land parcels.",
      show_parcels: "Show land parcels",
      parcels_none: "No land parcels found for {name}.",
      cadastre_loc_note: "Location from land-parcel records.",
      pl_search_ph: "Search survey no…",
      n_parcels: "{n} parcels",
      pl_empty: "No matching survey numbers.",
      parcel_title: "Land parcel",
      survey_no: "Survey no.",
      parcel_area: "Area: {n} m²",
      coordinates: "Coordinates:",
      open_in_maps: "Open in Maps",
      copy_coords: "Copy",
      coords_copied: "Coordinates copied",
      cad_snapshot_note: "Cadastral snapshot — not live land records.",
      nb_find: "Find nearby services",
      nb_loading: "Finding nearby services…",
      nb_none: "Nothing mapped within {km} km.",
      nb_err: "Couldn’t load — tap to retry.",
      nb_src: "via OpenStreetMap",
      nb_health: "Hospitals & clinics",
      nb_government: "Government offices",
      nb_civic: "Police & civic",
      km: "{n} km",
      t_hospital: "Hospital",
      t_clinic: "Clinic",
      t_police: "Police",
      t_post_office: "Post office",
      t_fire_station: "Fire station",
      t_townhall: "Town hall",
      t_courthouse: "Court",
      t_government: "Govt. office",
      wx_btn: "Weather & forecast",
      wx_loading: "Loading weather…",
      wx_err: "Couldn’t load — tap to retry.",
      wx_humidity: "Humidity {n}%",
      wx_wind: "Wind {n} km/h",
      wx_mm: "{n} mm",
      wx_clear: "Clear",
      wx_cloudy: "Partly cloudy",
      wx_overcast: "Overcast",
      wx_fog: "Fog",
      wx_drizzle: "Drizzle",
      wx_rain: "Rain",
      wx_storm: "Thunderstorm",
      wx_src: "Weather: Open-Meteo",
      mandi_btn: "Mandi prices",
      mandi_title: "Mandi prices",
      mandi_sub: "{district} district · ₹/quintal",
      mandi_loading: "Loading prices…",
      mandi_err: "Couldn’t load prices — tap to retry.",
      mandi_empty: "No matching commodities.",
      mandi_none_district: "No mandi reported prices in {district} today.",
      mandi_search_ph: "Search commodity…",
      mandi_updated: "Updated {date} · Agmarknet via data.gov.in",
      fmb_btn: "Sub-survey / FMB sketch",
      fmb_copied: "Survey details copied — pick the village on {portal} and paste them.",
      ov_gw: "Groundwater prospects",
      ov_soil: "Soil type (SoilGrids)",
      sch_btn: "Govt schemes",
      sch_title: "Schemes for farmers",
      sch_sub: "{n} schemes",
      sch_loading: "Loading schemes…",
      sch_err: "Couldn’t load schemes — tap to retry.",
      sch_empty: "No matching schemes.",
      sch_search_ph: "Search schemes…",
      sch_central: "Central schemes",
      sch_state: "State schemes",
      sch_updated: "Updated {date} · myScheme (myscheme.gov.in)",
      farm_title: "Farm inputs",
      farm_note:
        "Urea MRP is government-fixed; DAP and other P&K fertilizer prices include the NBS subsidy. Check availability with your local dealer.",
      farm_stock_link: "Fertilizer stock (iFMS)",
      farm_shc_link: "Soil Health Card",
      soil_btn: "Soil & fertilizer",
      soil_loading: "Reading soil profile…",
      soil_err: "Couldn’t load soil data — tap to retry.",
      soil_lbl_type: "Soil type",
      soil_lbl_oc: "organic carbon",
      soil_npk: "Balanced N-P-K use guide (all-India): 4:2:1",
      soil_note_alk:
        "Alkaline soil — zinc availability drops, so zinc (Zn) deficiency risk is high; confirm with a soil test before applying zinc sulphate.",
      soil_note_acid:
        "Acidic soil — phosphorus gets fixed and less available; liming can help. Confirm with a soil test.",
      soil_note_sandy:
        "Sandy soil — nitrogen and potash leach quickly; apply fertilizer in split doses.",
      soil_note_ok: "No specific risk flagged — follow your Soil Health Card recommendation.",
      soil_verify: "model estimate — confirm with a Soil Health Card test",
      soil_ph_acidic: "acidic",
      soil_ph_neutral: "neutral",
      soil_ph_alkaline: "alkaline",
      soil_tex_clay: "clayey",
      soil_tex_clayloam: "clay loam",
      soil_tex_loam: "loam",
      soil_tex_sandyloam: "sandy loam",
      soil_tex_sandy: "sandy",
      soil_grp_black: "black cotton soil",
      soil_grp_red: "red soil",
      soil_grp_alluvial: "alluvial soil",
      soil_grp_sandy: "sandy soil",
      soil_grp_calc: "calcareous soil",
      soil_grp_shallow: "shallow / gravelly soil"
    },
    te: {
      village_finder: "గ్రామ శోధన",
      search_ph: "ఏదైనా గ్రామం, మండలం లేదా జిల్లాను శోధించండి…",
      all_districts: "అన్ని జిల్లాలు",
      districts: "జిల్లాలు",
      mandals: "మండలాలు",
      villages: "గ్రామాలు",
      district: "జిల్లా",
      mandal: "మండలం",
      village: "గ్రామం",
      district_word: "జిల్లా",
      mandal_word: "మండలం",
      taluks: "తాలూకాలు",
      taluk: "తాలూకా",
      taluk_word: "తాలూకా",
      n_taluks: "{n} తాలూకాలు",
      villages_per_taluk: "తాలూకాకి గ్రామాలు",
      taluk_note: "తాలూకా స్థాయిలో చూపబడింది — ఖచ్చితమైన గ్రామ నిర్దేశాంకాలు ఓపెన్ డేటాలో లేవు.",
      az: "A → Z",
      rural: "గ్రామీణ",
      urban: "పట్టణ",
      results: "ఫలితాలు",
      matches: "{n} ఫలితాలు",
      no_match: "“{q}”కి సరిపోలే గ్రామం, మండలం లేదా జిల్లా లేదు.",
      no_villages: "ఈ ప్రాంతానికి గ్రామాలు జాబితా చేయబడలేదు.",
      villages_per_district: "జిల్లాకి గ్రామాలు",
      villages_per_mandal: "మండలానికి గ్రామాలు",
      villages_per_area: "ప్రాంతానికి గ్రామాలు",
      updated: "నవీకరించబడింది",
      n_villages: "{n} గ్రామాలు",
      n_mandals: "{n} మండలాలు",
      loading_data: "డేటా లోడ్ అవుతోంది…",
      loading_map: "మ్యాప్ లోడ్ అవుతోంది…",
      data_lgd: "డేటా: LGD",
      mirror: "మిర్రర్",
      report_issue: "సమస్యను నివేదించండి",
      source: "సోర్స్",
      home: "హోమ్ — అన్ని రాష్ట్రాలు",
      language: "భాష",
      hide_panel: "ప్యానెల్ దాచు",
      show_panel: "ప్యానెల్ చూపించు",
      clear: "క్లియర్",
      currently_viewing: "ప్రస్తుతం {state} చూస్తున్నారు",
      approx_note: "సుమారు స్థానం (GeoNames ద్వారా సరిపోల్చబడింది).",
      mandal_note: "మండల స్థాయిలో చూపబడింది — ఖచ్చితమైన గ్రామ నిర్దేశాంకాలు ఓపెన్ డేటాలో లేవు.",
      boundary_missing: "{name} కోసం మ్యాప్ సరిహద్దు ఇంకా ప్రచురించబడలేదు (కొత్త జిల్లా).",
      loc_missing: "{name} స్థానం ఇంకా మ్యాప్‌లో లేదు.",
      pin_label: "పిన్",
      lgd_label: "LGD",
      parcels_toggle: "భూ కమతాలు",
      parcels_zoom_hint: "భూ కమతాలను చూడటానికి జూమ్ చేయండి.",
      show_parcels: "భూ కమతాలను చూపించు",
      parcels_none: "{name} కోసం భూ కమతాలు కనబడలేదు.",
      cadastre_loc_note: "భూ కమతాల రికార్డుల ఆధారంగా స్థానం.",
      pl_search_ph: "సర్వే నం. వెతకండి…",
      n_parcels: "{n} కమతాలు",
      pl_empty: "సరిపోలే సర్వే నంబర్లు లేవు.",
      parcel_title: "భూ కమతం",
      survey_no: "సర్వే నం.",
      parcel_area: "విస్తీర్ణం: {n} మీ²",
      coordinates: "అక్షాంశ రేఖాంశాలు:",
      open_in_maps: "మ్యాప్స్‌లో తెరవండి",
      copy_coords: "కాపీ",
      coords_copied: "కోఆర్డినేట్లు కాపీ అయ్యాయి",
      cad_snapshot_note: "కడస్ట్రల్ స్నాప్‌షాట్ — ప్రత్యక్ష భూ రికార్డులు కాదు.",
      nb_find: "సమీప సేవలను కనుగొనండి",
      nb_loading: "సమీప సేవలను కనుగొంటోంది…",
      nb_none: "{km} కి.మీ లోపల ఏమీ లేదు.",
      nb_err: "లోడ్ కాలేదు — మళ్ళీ ప్రయత్నించండి.",
      nb_src: "OpenStreetMap ద్వారా",
      nb_health: "ఆసుపత్రులు & క్లినిక్‌లు",
      nb_government: "ప్రభుత్వ కార్యాలయాలు",
      nb_civic: "పోలీస్ & పౌర సేవలు",
      km: "{n} కి.మీ",
      t_hospital: "ఆసుపత్రి",
      t_clinic: "క్లినిక్",
      t_police: "పోలీస్",
      t_post_office: "పోస్టాఫీసు",
      t_fire_station: "అగ్నిమాపక కేంద్రం",
      t_townhall: "టౌన్ హాల్",
      t_courthouse: "కోర్టు",
      t_government: "ప్రభుత్వ కార్యాలయం",
      wx_btn: "వాతావరణం & సూచన",
      wx_loading: "వాతావరణం లోడ్ అవుతోంది…",
      wx_err: "లోడ్ కాలేదు — మళ్లీ ప్రయత్నించడానికి నొక్కండి.",
      wx_humidity: "తేమ {n}%",
      wx_wind: "గాలి {n} కి.మీ/గం",
      wx_mm: "{n} మి.మీ",
      wx_clear: "నిర్మలం",
      wx_cloudy: "పాక్షిక మేఘాలు",
      wx_overcast: "మేఘావృతం",
      wx_fog: "పొగమంచు",
      wx_drizzle: "జల్లు",
      wx_rain: "వర్షం",
      wx_storm: "ఉరుములతో వర్షం",
      wx_src: "వాతావరణం: Open-Meteo",
      mandi_btn: "మండీ ధరలు",
      mandi_title: "మండీ ధరలు",
      mandi_sub: "{district} జిల్లా · ₹/క్వింటాల్",
      mandi_loading: "ధరలు లోడ్ అవుతున్నాయి…",
      mandi_err: "ధరలు లోడ్ కాలేదు — మళ్లీ ప్రయత్నించడానికి నొక్కండి.",
      mandi_empty: "సరిపోలే సరుకులు లేవు.",
      mandi_none_district: "{district}లో ఈరోజు మండీ ధరలు నమోదు కాలేదు.",
      mandi_search_ph: "సరుకు పేరు వెతకండి…",
      mandi_updated: "నవీకరణ {date} · Agmarknet, data.gov.in ద్వారా",
      fmb_btn: "సబ్-సర్వే / FMB స్కెచ్",
      fmb_copied:
        "సర్వే వివరాలు కాపీ అయ్యాయి — {portal}లో గ్రామాన్ని ఎంచుకుని వాటిని నమోదు చేయండి.",
      ov_gw: "భూగర్భజల అవకాశాలు",
      ov_soil: "నేల రకం (SoilGrids)",
      sch_btn: "ప్రభుత్వ పథకాలు",
      sch_title: "రైతు పథకాలు",
      sch_sub: "{n} పథకాలు",
      sch_loading: "పథకాలు లోడ్ అవుతున్నాయి…",
      sch_err: "పథకాలు లోడ్ కాలేదు — మళ్లీ ప్రయత్నించడానికి నొక్కండి.",
      sch_empty: "సరిపోలే పథకాలు లేవు.",
      sch_search_ph: "పథకం వెతకండి…",
      sch_central: "కేంద్ర పథకాలు",
      sch_state: "రాష్ట్ర పథకాలు",
      sch_updated: "నవీకరణ {date} · myScheme (myscheme.gov.in)",
      farm_title: "వ్యవసాయ ఇన్‌పుట్లు",
      farm_note:
        "యూరియా ధర ప్రభుత్వం నిర్ణయిస్తుంది; DAP వంటి P&K ఎరువుల ధరల్లో NBS సబ్సిడీ కలిసి ఉంటుంది. అందుబాటు కోసం మీ డీలర్‌ను సంప్రదించండి.",
      farm_stock_link: "ఎరువుల నిల్వ (iFMS)",
      farm_shc_link: "భూసార కార్డు",
      soil_btn: "నేల & ఎరువు",
      soil_loading: "నేల వివరాలు లోడ్ అవుతున్నాయి…",
      soil_err: "నేల డేటా లోడ్ కాలేదు — మళ్లీ ప్రయత్నించడానికి నొక్కండి.",
      soil_lbl_type: "నేల రకం",
      soil_lbl_oc: "సేంద్రియ కర్బనం",
      soil_npk: "సమతుల్య N-P-K వాడకం మార్గదర్శి (అఖిల భారత): 4:2:1",
      soil_note_alk:
        "క్షార నేల — జింక్ లభ్యత తగ్గుతుంది, జింక్ (Zn) లోపం ముప్పు ఎక్కువ; జింక్ సల్ఫేట్ వేసే ముందు నేల పరీక్షతో నిర్ధారించండి.",
      soil_note_acid:
        "ఆమ్ల నేల — భాస్వరం స్థిరపడి తక్కువగా లభిస్తుంది; సున్నం వేయడం ఉపయోగపడవచ్చు. నేల పరీక్షతో నిర్ధారించండి.",
      soil_note_sandy:
        "ఇసుక నేల — నత్రజని, పొటాష్ త్వరగా కొట్టుకుపోతాయి; ఎరువులను విడతలుగా వేయండి.",
      soil_note_ok: "ప్రత్యేక ముప్పు కనబడలేదు — మీ భూసార కార్డు సిఫారసు ప్రకారం ఎరువులు వేయండి.",
      soil_verify: "మోడల్ అంచనా — నిర్ధారణకు భూసార కార్డు పరీక్ష చేయించండి",
      soil_ph_acidic: "ఆమ్లం",
      soil_ph_neutral: "తటస్థం",
      soil_ph_alkaline: "క్షారం",
      soil_tex_clay: "బంక నేల",
      soil_tex_clayloam: "బంక-గరప నేల",
      soil_tex_loam: "గరప నేల",
      soil_tex_sandyloam: "ఇసుక-గరప నేల",
      soil_tex_sandy: "ఇసుక నేల",
      soil_grp_black: "నల్లరేగడి నేల",
      soil_grp_red: "ఎర్ర నేల",
      soil_grp_alluvial: "ఒండ్రు నేల",
      soil_grp_sandy: "ఇసుక నేల",
      soil_grp_calc: "సున్నపు నేల",
      soil_grp_shallow: "పలుచని రాతి నేల"
    },
    hi: {
      village_finder: "ग्राम खोजक",
      search_ph: "कोई भी गाँव, मंडल या ज़िला खोजें…",
      all_districts: "सभी ज़िले",
      districts: "ज़िले",
      mandals: "मंडल",
      villages: "गाँव",
      district: "ज़िला",
      mandal: "मंडल",
      village: "गाँव",
      district_word: "ज़िला",
      mandal_word: "मंडल",
      taluks: "तालुक",
      taluk: "तालुक",
      taluk_word: "तालुक",
      n_taluks: "{n} तालुक",
      villages_per_taluk: "प्रति तालुक गाँव",
      taluk_note: "तालुक स्तर पर दिखाया गया — सटीक गाँव निर्देशांक खुले डेटा में नहीं हैं।",
      az: "A → Z",
      rural: "ग्रामीण",
      urban: "शहरी",
      results: "परिणाम",
      matches: "{n} मिलान",
      no_match: "“{q}” से मेल खाता कोई गाँव, मंडल या ज़िला नहीं।",
      no_villages: "इस क्षेत्र के लिए कोई गाँव सूचीबद्ध नहीं है।",
      villages_per_district: "प्रति ज़िला गाँव",
      villages_per_mandal: "प्रति मंडल गाँव",
      villages_per_area: "प्रति क्षेत्र गाँव",
      updated: "अद्यतन",
      n_villages: "{n} गाँव",
      n_mandals: "{n} मंडल",
      loading_data: "डेटा लोड हो रहा है…",
      loading_map: "मानचित्र लोड हो रहा है…",
      data_lgd: "डेटा: LGD",
      mirror: "मिरर",
      report_issue: "समस्या की रिपोर्ट करें",
      source: "स्रोत",
      home: "होम — सभी राज्य",
      language: "भाषा",
      hide_panel: "पैनल छिपाएँ",
      show_panel: "पैनल दिखाएँ",
      clear: "साफ़ करें",
      currently_viewing: "वर्तमान में {state} देख रहे हैं",
      approx_note: "अनुमानित स्थान (GeoNames द्वारा मिलान)।",
      mandal_note: "मंडल स्तर पर दिखाया गया — सटीक गाँव निर्देशांक खुले डेटा में नहीं हैं।",
      boundary_missing: "{name} के लिए मानचित्र सीमा अभी प्रकाशित नहीं हुई (नया ज़िला)।",
      loc_missing: "{name} का स्थान अभी मानचित्र पर नहीं है।",
      pin_label: "पिन",
      lgd_label: "LGD",
      nb_find: "आस-पास की सेवाएँ खोजें",
      nb_loading: "आस-पास की सेवाएँ खोजी जा रही हैं…",
      nb_none: "{km} किमी के भीतर कुछ नहीं मिला।",
      nb_err: "लोड नहीं हुआ — पुनः प्रयास करें।",
      nb_src: "OpenStreetMap से",
      nb_health: "अस्पताल और क्लिनिक",
      nb_government: "सरकारी कार्यालय",
      nb_civic: "पुलिस और नागरिक सेवाएँ",
      km: "{n} किमी",
      t_hospital: "अस्पताल",
      t_clinic: "क्लिनिक",
      t_police: "पुलिस",
      t_post_office: "डाकघर",
      t_fire_station: "अग्निशमन केंद्र",
      t_townhall: "नगर भवन",
      t_courthouse: "न्यायालय",
      t_government: "सरकारी कार्यालय",
      wx_btn: "मौसम और पूर्वानुमान",
      wx_loading: "मौसम लोड हो रहा है…",
      wx_err: "लोड नहीं हुआ — पुनः प्रयास हेतु टैप करें।",
      wx_humidity: "नमी {n}%",
      wx_wind: "हवा {n} किमी/घं",
      wx_mm: "{n} मिमी",
      wx_clear: "साफ़",
      wx_cloudy: "आंशिक बादल",
      wx_overcast: "घने बादल",
      wx_fog: "कोहरा",
      wx_drizzle: "बूंदाबांदी",
      wx_rain: "बारिश",
      wx_storm: "आंधी-तूफ़ान",
      wx_src: "मौसम: Open-Meteo",
      mandi_btn: "मंडी भाव",
      mandi_title: "मंडी भाव",
      mandi_sub: "{district} ज़िला · ₹/क्विंटल",
      mandi_loading: "भाव लोड हो रहे हैं…",
      mandi_err: "भाव लोड नहीं हुए — पुनः प्रयास हेतु टैप करें।",
      mandi_empty: "कोई मेल नहीं।",
      mandi_none_district: "{district} में आज कोई मंडी भाव दर्ज नहीं।",
      mandi_search_ph: "फ़सल खोजें…",
      mandi_updated: "अद्यतन {date} · Agmarknet, data.gov.in से",
      fmb_btn: "उप-सर्वे / FMB स्केच",
      fmb_copied: "सर्वे विवरण कॉपी हुए — {portal} पर गाँव चुनकर उन्हें दर्ज करें।",
      ov_gw: "भूजल संभावनाएँ",
      ov_soil: "मिट्टी का प्रकार (SoilGrids)",
      sch_btn: "सरकारी योजनाएँ",
      sch_title: "किसानों की योजनाएँ",
      sch_sub: "{n} योजनाएँ",
      sch_loading: "योजनाएँ लोड हो रही हैं…",
      sch_err: "योजनाएँ लोड नहीं हुईं — पुनः प्रयास हेतु टैप करें।",
      sch_empty: "कोई मेल नहीं।",
      sch_search_ph: "योजना खोजें…",
      sch_central: "केंद्रीय योजनाएँ",
      sch_state: "राज्य योजनाएँ",
      sch_updated: "अद्यतन {date} · myScheme (myscheme.gov.in)",
      farm_title: "कृषि इनपुट",
      farm_note:
        "यूरिया का MRP सरकार-निर्धारित है; DAP जैसे P&K उर्वरकों के दाम में NBS सब्सिडी शामिल है। उपलब्धता अपने डीलर से जाँचें।",
      farm_stock_link: "उर्वरक स्टॉक (iFMS)",
      farm_shc_link: "मृदा स्वास्थ्य कार्ड",
      soil_btn: "मिट्टी और उर्वरक",
      soil_loading: "मिट्टी की जानकारी लोड हो रही है…",
      soil_err: "मिट्टी का डेटा लोड नहीं हुआ — पुनः प्रयास हेतु टैप करें।",
      soil_lbl_type: "मिट्टी का प्रकार",
      soil_lbl_oc: "जैविक कार्बन",
      soil_npk: "संतुलित N-P-K उपयोग मार्गदर्शन (अखिल भारत): 4:2:1",
      soil_note_alk:
        "क्षारीय मिट्टी — ज़िंक की उपलब्धता घटती है, ज़िंक (Zn) की कमी का जोखिम अधिक; ज़िंक सल्फेट डालने से पहले मिट्टी जाँच से पुष्टि करें।",
      soil_note_acid:
        "अम्लीय मिट्टी — फॉस्फोरस बंध जाता है और कम मिलता है; चूना डालना उपयोगी हो सकता है। मिट्टी जाँच से पुष्टि करें।",
      soil_note_sandy:
        "रेतीली मिट्टी — नाइट्रोजन व पोटाश जल्दी बह जाते हैं; उर्वरक किस्तों में डालें।",
      soil_note_ok:
        "कोई विशेष जोखिम नहीं दिखा — अपने मृदा स्वास्थ्य कार्ड की सिफ़ारिश के अनुसार उर्वरक डालें।",
      soil_verify: "मॉडल अनुमान — पुष्टि के लिए मृदा स्वास्थ्य कार्ड जाँच कराएँ",
      soil_ph_acidic: "अम्लीय",
      soil_ph_neutral: "उदासीन",
      soil_ph_alkaline: "क्षारीय",
      soil_tex_clay: "चिकनी मिट्टी",
      soil_tex_clayloam: "चिकनी-दोमट",
      soil_tex_loam: "दोमट",
      soil_tex_sandyloam: "रेतीली-दोमट",
      soil_tex_sandy: "रेतीली",
      soil_grp_black: "काली (रेगुर) मिट्टी",
      soil_grp_red: "लाल मिट्टी",
      soil_grp_alluvial: "जलोढ़ मिट्टी",
      soil_grp_sandy: "रेतीली मिट्टी",
      soil_grp_calc: "चूनायुक्त मिट्टी",
      soil_grp_shallow: "उथली/पथरीली मिट्टी"
    },
    kn: {
      village_finder: "ಗ್ರಾಮ ಹುಡುಕಾಟ",
      search_ph: "ಯಾವುದೇ ಗ್ರಾಮ, ತಾಲೂಕು ಅಥವಾ ಜಿಲ್ಲೆ ಹುಡುಕಿ…",
      all_districts: "ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು",
      districts: "ಜಿಲ್ಲೆಗಳು",
      mandals: "ಮಂಡಲಗಳು",
      villages: "ಗ್ರಾಮಗಳು",
      district: "ಜಿಲ್ಲೆ",
      mandal: "ಮಂಡಲ",
      village: "ಗ್ರಾಮ",
      district_word: "ಜಿಲ್ಲೆ",
      mandal_word: "ಮಂಡಲ",
      taluks: "ತಾಲೂಕುಗಳು",
      taluk: "ತಾಲೂಕು",
      taluk_word: "ತಾಲೂಕು",
      n_taluks: "{n} ತಾಲೂಕುಗಳು",
      villages_per_taluk: "ತಾಲೂಕಿಗೆ ಗ್ರಾಮಗಳು",
      taluk_note: "ತಾಲೂಕು ಮಟ್ಟದಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ — ನಿಖರ ಗ್ರಾಮ ನಿರ್ದೇಶಾಂಕಗಳು ಮುಕ್ತ ಡೇಟಾದಲ್ಲಿ ಇಲ್ಲ.",
      az: "A → Z",
      rural: "ಗ್ರಾಮೀಣ",
      urban: "ನಗರ",
      results: "ಫಲಿತಾಂಶಗಳು",
      matches: "{n} ಫಲಿತಾಂಶಗಳು",
      no_match: "“{q}” ಗೆ ಹೊಂದುವ ಗ್ರಾಮ, ತಾಲೂಕು ಅಥವಾ ಜಿಲ್ಲೆ ಇಲ್ಲ.",
      no_villages: "ಈ ಪ್ರದೇಶಕ್ಕೆ ಯಾವುದೇ ಗ್ರಾಮಗಳು ಪಟ್ಟಿ ಮಾಡಿಲ್ಲ.",
      villages_per_district: "ಜಿಲ್ಲೆಗೆ ಗ್ರಾಮಗಳು",
      villages_per_mandal: "ಮಂಡಲಕ್ಕೆ ಗ್ರಾಮಗಳು",
      villages_per_area: "ಪ್ರದೇಶಕ್ಕೆ ಗ್ರಾಮಗಳು",
      updated: "ನವೀಕರಿಸಲಾಗಿದೆ",
      n_villages: "{n} ಗ್ರಾಮಗಳು",
      n_mandals: "{n} ಮಂಡಲಗಳು",
      loading_data: "ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      loading_map: "ನಕ್ಷೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      data_lgd: "ಡೇಟಾ: LGD",
      mirror: "ಮಿರರ್",
      report_issue: "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
      source: "ಮೂಲ",
      home: "ಮುಖಪುಟ — ಎಲ್ಲಾ ರಾಜ್ಯಗಳು",
      language: "ಭಾಷೆ",
      hide_panel: "ಪ್ಯಾನೆಲ್ ಮರೆಮಾಡಿ",
      show_panel: "ಪ್ಯಾನೆಲ್ ತೋರಿಸಿ",
      clear: "ತೆರವುಗೊಳಿಸಿ",
      currently_viewing: "ಪ್ರಸ್ತುತ {state} ನೋಡುತ್ತಿದ್ದೀರಿ",
      approx_note: "ಅಂದಾಜು ಸ್ಥಳ (GeoNames ಮೂಲಕ ಹೊಂದಿಕೆ).",
      mandal_note: "ಮಂಡಲ ಮಟ್ಟದಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ — ನಿಖರ ಗ್ರಾಮ ನಿರ್ದೇಶಾಂಕಗಳು ಮುಕ್ತ ಡೇಟಾದಲ್ಲಿ ಇಲ್ಲ.",
      boundary_missing: "{name} ಗೆ ನಕ್ಷೆ ಗಡಿ ಇನ್ನೂ ಪ್ರಕಟವಾಗಿಲ್ಲ (ಹೊಸ ಜಿಲ್ಲೆ).",
      loc_missing: "{name} ಸ್ಥಳ ಇನ್ನೂ ನಕ್ಷೆಯಲ್ಲಿ ಇಲ್ಲ.",
      pin_label: "ಪಿನ್",
      lgd_label: "LGD",
      parcels_toggle: "ಭೂ ಖಂಡಗಳು",
      parcels_zoom_hint: "ಭೂ ಖಂಡಗಳನ್ನು ನೋಡಲು ಜೂಮ್ ಮಾಡಿ.",
      show_parcels: "ಭೂ ಖಂಡಗಳನ್ನು ತೋರಿಸಿ",
      parcels_none: "{name} ಗೆ ಭೂ ಖಂಡಗಳು ಸಿಗಲಿಲ್ಲ.",
      cadastre_loc_note: "ಭೂ ಖಂಡ ದಾಖಲೆಗಳ ಆಧಾರದ ಮೇಲೆ ಸ್ಥಳ.",
      pl_search_ph: "ಸರ್ವೆ ನಂ. ಹುಡುಕಿ…",
      n_parcels: "{n} ಖಂಡಗಳು",
      pl_empty: "ಹೊಂದಿಕೆಯಾಗುವ ಸರ್ವೆ ನಂಬರ್‌ಗಳಿಲ್ಲ.",
      parcel_title: "ಭೂ ಖಂಡ",
      survey_no: "ಸರ್ವೆ ನಂ.",
      parcel_area: "ವಿಸ್ತೀರ್ಣ: {n} ಮೀ²",
      coordinates: "ನಿರ್ದೇಶಾಂಕಗಳು:",
      open_in_maps: "ಮ್ಯಾಪ್ಸ್‌ನಲ್ಲಿ ತೆರೆಯಿರಿ",
      copy_coords: "ನಕಲಿಸಿ",
      coords_copied: "ನಿರ್ದೇಶಾಂಕಗಳನ್ನು ನಕಲಿಸಲಾಗಿದೆ",
      cad_snapshot_note: "ಕ್ಯಾಡಾಸ್ಟ್ರಲ್ ಸ್ನ್ಯಾಪ್‌ಶಾಟ್ — ನೇರ ಭೂ ದಾಖಲೆಗಳಲ್ಲ.",
      nb_find: "ಸಮೀಪದ ಸೇವೆಗಳನ್ನು ಹುಡುಕಿ",
      nb_loading: "ಸಮೀಪದ ಸೇವೆಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…",
      nb_none: "{km} ಕಿ.ಮೀ ಒಳಗೆ ಏನೂ ಇಲ್ಲ.",
      nb_err: "ಲೋಡ್ ಆಗಲಿಲ್ಲ — ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      nb_src: "OpenStreetMap ಮೂಲಕ",
      nb_health: "ಆಸ್ಪತ್ರೆಗಳು & ಕ್ಲಿನಿಕ್‌ಗಳು",
      nb_government: "ಸರ್ಕಾರಿ ಕಚೇರಿಗಳು",
      nb_civic: "ಪೊಲೀಸ್ & ನಾಗರಿಕ ಸೇವೆಗಳು",
      km: "{n} ಕಿ.ಮೀ",
      t_hospital: "ಆಸ್ಪತ್ರೆ",
      t_clinic: "ಕ್ಲಿನಿಕ್",
      t_police: "ಪೊಲೀಸ್",
      t_post_office: "ಅಂಚೆ ಕಚೇರಿ",
      t_fire_station: "ಅಗ್ನಿಶಾಮಕ ಠಾಣೆ",
      t_townhall: "ಟೌನ್ ಹಾಲ್",
      t_courthouse: "ನ್ಯಾಯಾಲಯ",
      t_government: "ಸರ್ಕಾರಿ ಕಚೇರಿ",
      wx_btn: "ಹವಾಮಾನ ಮತ್ತು ಮುನ್ಸೂಚನೆ",
      wx_loading: "ಹವಾಮಾನ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      wx_err: "ಲೋಡ್ ಆಗಲಿಲ್ಲ — ಮರುಪ್ರಯತ್ನಿಸಲು ಒತ್ತಿ.",
      wx_humidity: "ಆರ್ದ್ರತೆ {n}%",
      wx_wind: "ಗಾಳಿ {n} ಕಿ.ಮೀ/ಗಂ",
      wx_mm: "{n} ಮಿ.ಮೀ",
      wx_clear: "ನಿರ್ಮಲ",
      wx_cloudy: "ಭಾಗಶಃ ಮೋಡ",
      wx_overcast: "ಮೋಡ ಕವಿದ",
      wx_fog: "ಮಂಜು",
      wx_drizzle: "ತುಂತುರು ಮಳೆ",
      wx_rain: "ಮಳೆ",
      wx_storm: "ಗುಡುಗು ಮಳೆ",
      wx_src: "ಹವಾಮಾನ: Open-Meteo",
      mandi_btn: "ಮಂಡಿ ದರಗಳು",
      mandi_title: "ಮಂಡಿ ದರಗಳು",
      mandi_sub: "{district} ಜಿಲ್ಲೆ · ₹/ಕ್ವಿಂಟಾಲ್",
      mandi_loading: "ದರಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…",
      mandi_err: "ದರಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ — ಮರುಪ್ರಯತ್ನಿಸಲು ಒತ್ತಿ.",
      mandi_empty: "ಹೊಂದುವ ಸರಕುಗಳಿಲ್ಲ.",
      mandi_none_district: "{district}ದಲ್ಲಿ ಇಂದು ಮಂಡಿ ದರ ದಾಖಲಾಗಿಲ್ಲ.",
      mandi_search_ph: "ಸರಕು ಹುಡುಕಿ…",
      mandi_updated: "ನವೀಕರಣ {date} · Agmarknet, data.gov.in ಮೂಲಕ",
      fmb_btn: "ಉಪ-ಸರ್ವೆ / FMB ನಕ್ಷೆ",
      fmb_copied: "ಸರ್ವೆ ವಿವರಗಳು ನಕಲಾಗಿವೆ — {portal}ದಲ್ಲಿ ಗ್ರಾಮ ಆಯ್ಕೆ ಮಾಡಿ ಅವನ್ನು ನಮೂದಿಸಿ.",
      ov_gw: "ಅಂತರ್ಜಲ ಸಾಧ್ಯತೆಗಳು",
      ov_soil: "ಮಣ್ಣಿನ ವಿಧ (SoilGrids)",
      sch_btn: "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು",
      sch_title: "ರೈತ ಯೋಜನೆಗಳು",
      sch_sub: "{n} ಯೋಜನೆಗಳು",
      sch_loading: "ಯೋಜನೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…",
      sch_err: "ಯೋಜನೆಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ — ಮರುಪ್ರಯತ್ನಿಸಲು ಒತ್ತಿ.",
      sch_empty: "ಹೊಂದುವ ಯೋಜನೆಗಳಿಲ್ಲ.",
      sch_search_ph: "ಯೋಜನೆ ಹುಡುಕಿ…",
      sch_central: "ಕೇಂದ್ರ ಯೋಜನೆಗಳು",
      sch_state: "ರಾಜ್ಯ ಯೋಜನೆಗಳು",
      sch_updated: "ನವೀಕರಣ {date} · myScheme (myscheme.gov.in)",
      farm_title: "ಕೃಷಿ ಇನ್‌ಪುಟ್‌ಗಳು",
      farm_note:
        "ಯೂರಿಯಾ MRP ಸರ್ಕಾರ ನಿಗದಿಪಡಿಸಿದ್ದು; DAP ಮುಂತಾದ P&K ಗೊಬ್ಬರ ಬೆಲೆಗಳಲ್ಲಿ NBS ಸಬ್ಸಿಡಿ ಸೇರಿದೆ. ಲಭ್ಯತೆಯನ್ನು ನಿಮ್ಮ ಡೀಲರ್ ಬಳಿ ಪರಿಶೀಲಿಸಿ.",
      farm_stock_link: "ಗೊಬ್ಬರ ದಾಸ್ತಾನು (iFMS)",
      farm_shc_link: "ಮಣ್ಣು ಆರೋಗ್ಯ ಕಾರ್ಡ್",
      soil_btn: "ಮಣ್ಣು & ಗೊಬ್ಬರ",
      soil_loading: "ಮಣ್ಣಿನ ವಿವರ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      soil_err: "ಮಣ್ಣಿನ ಡೇಟಾ ಲೋಡ್ ಆಗಲಿಲ್ಲ — ಮರುಪ್ರಯತ್ನಿಸಲು ಒತ್ತಿ.",
      soil_lbl_type: "ಮಣ್ಣಿನ ವಿಧ",
      soil_lbl_oc: "ಸಾವಯವ ಇಂಗಾಲ",
      soil_npk: "ಸಮತೋಲಿತ N-P-K ಬಳಕೆ ಮಾರ್ಗದರ್ಶಿ (ಅಖಿಲ ಭಾರತ): 4:2:1",
      soil_note_alk:
        "ಕ್ಷಾರೀಯ ಮಣ್ಣು — ಸತುವಿನ ಲಭ್ಯತೆ ಕಡಿಮೆಯಾಗುತ್ತದೆ, ಸತು (Zn) ಕೊರತೆಯ ಅಪಾಯ ಹೆಚ್ಚು; ಝಿಂಕ್ ಸಲ್ಫೇಟ್ ಹಾಕುವ ಮೊದಲು ಮಣ್ಣು ಪರೀಕ್ಷೆಯಿಂದ ಖಚಿತಪಡಿಸಿ.",
      soil_note_acid:
        "ಆಮ್ಲೀಯ ಮಣ್ಣು — ರಂಜಕ ಸ್ಥಿರವಾಗಿ ಕಡಿಮೆ ಸಿಗುತ್ತದೆ; ಸುಣ್ಣ ಹಾಕುವುದು ಸಹಾಯವಾಗಬಹುದು. ಮಣ್ಣು ಪರೀಕ್ಷೆಯಿಂದ ಖಚಿತಪಡಿಸಿ.",
      soil_note_sandy:
        "ಮರಳು ಮಣ್ಣು — ಸಾರಜನಕ, ಪೊಟ್ಯಾಷ್ ಬೇಗ ಸೋರಿಹೋಗುತ್ತವೆ; ಗೊಬ್ಬರವನ್ನು ಕಂತುಗಳಲ್ಲಿ ಹಾಕಿ.",
      soil_note_ok: "ವಿಶೇಷ ಅಪಾಯ ಕಂಡುಬಂದಿಲ್ಲ — ನಿಮ್ಮ ಮಣ್ಣು ಆರೋಗ್ಯ ಕಾರ್ಡ್ ಶಿಫಾರಸಿನಂತೆ ಗೊಬ್ಬರ ಹಾಕಿ.",
      soil_verify: "ಮಾದರಿ ಅಂದಾಜು — ಖಚಿತಪಡಿಸಲು ಮಣ್ಣು ಆರೋಗ್ಯ ಕಾರ್ಡ್ ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ",
      soil_ph_acidic: "ಆಮ್ಲೀಯ",
      soil_ph_neutral: "ತಟಸ್ಥ",
      soil_ph_alkaline: "ಕ್ಷಾರೀಯ",
      soil_tex_clay: "ಜೇಡಿ ಮಣ್ಣು",
      soil_tex_clayloam: "ಜೇಡಿ-ಗೋಡು",
      soil_tex_loam: "ಗೋಡು ಮಣ್ಣು",
      soil_tex_sandyloam: "ಮರಳು-ಗೋಡು",
      soil_tex_sandy: "ಮರಳು ಮಣ್ಣು",
      soil_grp_black: "ಕಪ್ಪು (ಎರೆ) ಮಣ್ಣು",
      soil_grp_red: "ಕೆಂಪು ಮಣ್ಣು",
      soil_grp_alluvial: "ಮೆಕ್ಕಲು ಮಣ್ಣು",
      soil_grp_sandy: "ಮರಳು ಮಣ್ಣು",
      soil_grp_calc: "ಸುಣ್ಣಯುಕ್ತ ಮಣ್ಣು",
      soil_grp_shallow: "ಆಳವಿಲ್ಲದ/ಕಲ್ಲು ಮಣ್ಣು"
    },
    ur: {
      village_finder: "گاؤں تلاش",
      search_ph: "کوئی بھی گاؤں، منڈل یا ضلع تلاش کریں…",
      all_districts: "تمام اضلاع",
      districts: "اضلاع",
      mandals: "منڈل",
      villages: "گاؤں",
      district: "ضلع",
      mandal: "منڈل",
      village: "گاؤں",
      district_word: "ضلع",
      mandal_word: "منڈل",
      taluks: "تعلقہ",
      taluk: "تعلقہ",
      taluk_word: "تعلقہ",
      n_taluks: "{n} تعلقہ",
      villages_per_taluk: "فی تعلقہ گاؤں",
      taluk_note: "تعلقہ سطح پر دکھایا گیا — درست گاؤں کوآرڈینیٹس کھلے ڈیٹا میں نہیں ہیں۔",
      az: "A → Z",
      rural: "دیہی",
      urban: "شہری",
      results: "نتائج",
      matches: "{n} نتائج",
      no_match: "“{q}” سے کوئی گاؤں، منڈل یا ضلع میل نہیں کھاتا۔",
      no_villages: "اس علاقے کے لیے کوئی گاؤں درج نہیں۔",
      villages_per_district: "فی ضلع گاؤں",
      villages_per_mandal: "فی منڈل گاؤں",
      villages_per_area: "فی علاقہ گاؤں",
      updated: "اپ ڈیٹ شدہ",
      n_villages: "{n} گاؤں",
      n_mandals: "{n} منڈل",
      loading_data: "ڈیٹا لوڈ ہو رہا ہے…",
      loading_map: "نقشہ لوڈ ہو رہا ہے…",
      data_lgd: "ڈیٹا: LGD",
      mirror: "مرر",
      report_issue: "مسئلہ رپورٹ کریں",
      source: "ماخذ",
      home: "ہوم — تمام ریاستیں",
      language: "زبان",
      hide_panel: "پینل چھپائیں",
      show_panel: "پینل دکھائیں",
      clear: "صاف کریں",
      currently_viewing: "اس وقت {state} دیکھ رہے ہیں",
      approx_note: "تخمینی مقام (GeoNames کے ذریعے میل)۔",
      mandal_note: "منڈل سطح پر دکھایا گیا — درست گاؤں کوآرڈینیٹس کھلے ڈیٹا میں نہیں ہیں۔",
      boundary_missing: "{name} کے لیے نقشے کی حد ابھی شائع نہیں ہوئی (نیا ضلع)۔",
      loc_missing: "{name} کا مقام ابھی نقشے پر نہیں ہے۔",
      pin_label: "پن",
      lgd_label: "LGD",
      nb_find: "قریبی خدمات تلاش کریں",
      nb_loading: "قریبی خدمات تلاش کی جا رہی ہیں…",
      nb_none: "{km} کلومیٹر کے اندر کچھ نہیں ملا۔",
      nb_err: "لوڈ نہیں ہوا — دوبارہ کوشش کریں۔",
      nb_src: "بذریعہ OpenStreetMap",
      nb_health: "ہسپتال اور کلینک",
      nb_government: "سرکاری دفاتر",
      nb_civic: "پولیس اور شہری خدمات",
      km: "{n} کلومیٹر",
      t_hospital: "ہسپتال",
      t_clinic: "کلینک",
      t_police: "پولیس",
      t_post_office: "ڈاک خانہ",
      t_fire_station: "فائر اسٹیشن",
      t_townhall: "ٹاؤن ہال",
      t_courthouse: "عدالت",
      t_government: "سرکاری دفتر",
      wx_btn: "موسم اور پیش گوئی",
      wx_loading: "موسم لوڈ ہو رہا ہے…",
      wx_err: "لوڈ نہیں ہوا — دوبارہ کوشش کے لیے دبائیں۔",
      wx_humidity: "نمی {n}%",
      wx_wind: "ہوا {n} کلومیٹر/گھنٹہ",
      wx_mm: "{n} ملی میٹر",
      wx_clear: "صاف",
      wx_cloudy: "جزوی بادل",
      wx_overcast: "ابر آلود",
      wx_fog: "دھند",
      wx_drizzle: "پھوار",
      wx_rain: "بارش",
      wx_storm: "گرج چمک کے ساتھ بارش",
      wx_src: "موسم: Open-Meteo",
      mandi_btn: "منڈی بھاؤ",
      mandi_title: "منڈی بھاؤ",
      mandi_sub: "{district} ضلع · ₹/کوئنٹل",
      mandi_loading: "بھاؤ لوڈ ہو رہے ہیں…",
      mandi_err: "بھاؤ لوڈ نہیں ہوئے — دوبارہ کوشش کے لیے دبائیں۔",
      mandi_empty: "کوئی مماثل جنس نہیں۔",
      mandi_none_district: "{district} میں آج کوئی منڈی بھاؤ درج نہیں۔",
      mandi_search_ph: "جنس تلاش کریں…",
      mandi_updated: "تازہ کاری {date} · Agmarknet بذریعہ data.gov.in",
      fmb_btn: "ذیلی سروے / FMB خاکہ",
      fmb_copied: "سروے کی تفصیلات کاپی ہو گئیں — {portal} پر گاؤں منتخب کر کے انہیں درج کریں۔",
      ov_gw: "زیرِ زمین پانی کے امکانات",
      ov_soil: "مٹی کی قسم (SoilGrids)",
      sch_btn: "سرکاری اسکیمیں",
      sch_title: "کسانوں کی اسکیمیں",
      sch_sub: "{n} اسکیمیں",
      sch_loading: "اسکیمیں لوڈ ہو رہی ہیں…",
      sch_err: "اسکیمیں لوڈ نہیں ہوئیں — دوبارہ کوشش کے لیے دبائیں۔",
      sch_empty: "کوئی مماثل اسکیم نہیں۔",
      sch_search_ph: "اسکیم تلاش کریں…",
      sch_central: "مرکزی اسکیمیں",
      sch_state: "ریاستی اسکیمیں",
      sch_updated: "تازہ کاری {date} · myScheme (myscheme.gov.in)",
      farm_title: "زرعی اِن پُٹ",
      farm_note:
        "یوریا کی قیمت حکومت مقرر کرتی ہے؛ DAP جیسی P&K کھادوں کی قیمت میں NBS سبسڈی شامل ہے۔ دستیابی اپنے ڈیلر سے معلوم کریں۔",
      farm_stock_link: "کھاد اسٹاک (iFMS)",
      farm_shc_link: "سائل ہیلتھ کارڈ",
      soil_btn: "مٹی اور کھاد",
      soil_loading: "مٹی کی تفصیل لوڈ ہو رہی ہے…",
      soil_err: "مٹی کا ڈیٹا لوڈ نہیں ہوا — دوبارہ کوشش کے لیے دبائیں۔",
      soil_lbl_type: "مٹی کی قسم",
      soil_lbl_oc: "نامیاتی کاربن",
      soil_npk: "متوازن N-P-K استعمال رہنما (کل ہند): 4:2:1",
      soil_note_alk:
        "قلوی مٹی — زنک کی دستیابی گھٹتی ہے، زنک (Zn) کی کمی کا خطرہ زیادہ؛ زنک سلفیٹ ڈالنے سے پہلے مٹی کی جانچ سے تصدیق کریں۔",
      soil_note_acid:
        "تیزابی مٹی — فاسفورس جکڑ کر کم دستیاب ہوتا ہے؛ چونا ڈالنا مفید ہو سکتا ہے۔ مٹی کی جانچ سے تصدیق کریں۔",
      soil_note_sandy: "ریتلی مٹی — نائٹروجن اور پوٹاش جلد بہہ جاتے ہیں؛ کھاد قسطوں میں ڈالیں۔",
      soil_note_ok: "کوئی خاص خطرہ نہیں ملا — اپنے سائل ہیلتھ کارڈ کی سفارش کے مطابق کھاد ڈالیں۔",
      soil_verify: "ماڈل تخمینہ — تصدیق کے لیے سائل ہیلتھ کارڈ جانچ کروائیں",
      soil_ph_acidic: "تیزابی",
      soil_ph_neutral: "معتدل",
      soil_ph_alkaline: "قلوی",
      soil_tex_clay: "چکنی مٹی",
      soil_tex_clayloam: "چکنی-دومٹ",
      soil_tex_loam: "دومٹ",
      soil_tex_sandyloam: "ریتلی-دومٹ",
      soil_tex_sandy: "ریتلی",
      soil_grp_black: "کالی (ریگر) مٹی",
      soil_grp_red: "لال مٹی",
      soil_grp_alluvial: "دریائی مٹی",
      soil_grp_sandy: "ریتلی مٹی",
      soil_grp_calc: "چونے والی مٹی",
      soil_grp_shallow: "کم گہری/پتھریلی مٹی"
    },
    ta: {
      village_finder: "கிராம தேடல்",
      search_ph: "எந்த கிராமம், வட்டம் அல்லது மாவட்டத்தையும் தேடுங்கள்…",
      all_districts: "அனைத்து மாவட்டங்கள்",
      districts: "மாவட்டங்கள்",
      mandals: "மண்டலங்கள்",
      villages: "கிராமங்கள்",
      district: "மாவட்டம்",
      mandal: "மண்டலம்",
      village: "கிராமம்",
      district_word: "மாவட்டம்",
      mandal_word: "மண்டலம்",
      taluks: "வட்டங்கள்",
      taluk: "வட்டம்",
      taluk_word: "வட்டம்",
      n_taluks: "{n} வட்டங்கள்",
      villages_per_taluk: "வட்டத்திற்கு கிராமங்கள்",
      taluk_note:
        "வட்ட அளவில் காட்டப்பட்டுள்ளது — துல்லியமான கிராம ஆயத்தொலைவுகள் திறந்த தரவில் இல்லை.",
      az: "A → Z",
      rural: "கிராமப்புறம்",
      urban: "நகர்ப்புறம்",
      results: "முடிவுகள்",
      matches: "{n} முடிவுகள்",
      no_match: "“{q}” உடன் பொருந்தும் கிராமம், வட்டம் அல்லது மாவட்டம் இல்லை.",
      no_villages: "இந்தப் பகுதிக்கு கிராமங்கள் பட்டியலிடப்படவில்லை.",
      villages_per_district: "மாவட்டத்திற்கு கிராமங்கள்",
      villages_per_mandal: "மண்டலத்திற்கு கிராமங்கள்",
      villages_per_area: "பகுதிக்கு கிராமங்கள்",
      updated: "புதுப்பிக்கப்பட்டது",
      n_villages: "{n} கிராமங்கள்",
      n_mandals: "{n} மண்டலங்கள்",
      loading_data: "தரவு ஏற்றப்படுகிறது…",
      loading_map: "வரைபடம் ஏற்றப்படுகிறது…",
      data_lgd: "தரவு: LGD",
      mirror: "மிரர்",
      report_issue: "சிக்கலைப் புகாரளி",
      source: "மூலம்",
      home: "முகப்பு — அனைத்து மாநிலங்கள்",
      language: "மொழி",
      hide_panel: "பலகத்தை மறை",
      show_panel: "பலகத்தைக் காட்டு",
      clear: "அழி",
      currently_viewing: "தற்போது {state} பார்க்கிறீர்கள்",
      approx_note: "தோராயமான இடம் (GeoNames வழியாகப் பொருத்தப்பட்டது).",
      mandal_note:
        "மண்டல அளவில் காட்டப்பட்டுள்ளது — துல்லியமான கிராம ஆயத்தொலைவுகள் திறந்த தரவில் இல்லை.",
      boundary_missing: "{name} க்கான வரைபட எல்லை இன்னும் வெளியிடப்படவில்லை (புதிய மாவட்டம்).",
      loc_missing: "{name} இன் இடம் இன்னும் வரைபடத்தில் இல்லை.",
      pin_label: "பின்",
      lgd_label: "LGD",
      nb_find: "அருகிலுள்ள சேவைகளைக் கண்டறி",
      nb_loading: "அருகிலுள்ள சேவைகள் தேடப்படுகின்றன…",
      nb_none: "{km} கி.மீ. க்குள் எதுவும் இல்லை.",
      nb_err: "ஏற்ற முடியவில்லை — மீண்டும் முயற்சிக்கவும்.",
      nb_src: "OpenStreetMap வழியாக",
      nb_health: "மருத்துவமனைகள் & கிளினிக்குகள்",
      nb_government: "அரசு அலுவலகங்கள்",
      nb_civic: "காவல் & குடிமைச் சேவைகள்",
      km: "{n} கி.மீ.",
      t_hospital: "மருத்துவமனை",
      t_clinic: "கிளினிக்",
      t_police: "காவல் நிலையம்",
      t_post_office: "தபால் அலுவலகம்",
      t_fire_station: "தீயணைப்பு நிலையம்",
      t_townhall: "நகர மண்டபம்",
      t_courthouse: "நீதிமன்றம்",
      t_government: "அரசு அலுவலகம்",
      wx_btn: "வானிலை மற்றும் முன்னறிவிப்பு",
      wx_loading: "வானிலை ஏற்றப்படுகிறது…",
      wx_err: "ஏற்ற முடியவில்லை — மீண்டும் முயல தட்டவும்.",
      wx_humidity: "ஈரப்பதம் {n}%",
      wx_wind: "காற்று {n} கி.மீ/மணி",
      wx_mm: "{n} மி.மீ",
      wx_clear: "தெளிவு",
      wx_cloudy: "பகுதி மேகம்",
      wx_overcast: "மேக மூட்டம்",
      wx_fog: "மூடுபனி",
      wx_drizzle: "தூறல்",
      wx_rain: "மழை",
      wx_storm: "இடி மழை",
      wx_src: "வானிலை: Open-Meteo",
      mandi_btn: "மண்டி விலைகள்",
      mandi_title: "மண்டி விலைகள்",
      mandi_sub: "{district} மாவட்டம் · ₹/குவிண்டால்",
      mandi_loading: "விலைகள் ஏற்றப்படுகின்றன…",
      mandi_err: "விலைகள் ஏற்ற முடியவில்லை — மீண்டும் முயல தட்டவும்.",
      mandi_empty: "பொருந்தும் பொருட்கள் இல்லை.",
      mandi_none_district: "{district}இல் இன்று மண்டி விலை பதிவாகவில்லை.",
      mandi_search_ph: "பொருளைத் தேடு…",
      mandi_updated: "புதுப்பிப்பு {date} · Agmarknet வழி data.gov.in",
      fmb_btn: "துணை சர்வே / FMB வரைபடம்",
      fmb_copied:
        "சர்வே விவரங்கள் நகலெடுக்கப்பட்டன — {portal}இல் கிராமத்தைத் தேர்ந்தெடுத்து அவற்றை உள்ளிடவும்.",
      ov_gw: "நிலத்தடி நீர் வாய்ப்புகள்",
      ov_soil: "மண் வகை (SoilGrids)",
      sch_btn: "அரசு திட்டங்கள்",
      sch_title: "விவசாயிகளுக்கான திட்டங்கள்",
      sch_sub: "{n} திட்டங்கள்",
      sch_loading: "திட்டங்கள் ஏற்றப்படுகின்றன…",
      sch_err: "திட்டங்களை ஏற்ற முடியவில்லை — மீண்டும் முயல தட்டவும்.",
      sch_empty: "பொருந்தும் திட்டங்கள் இல்லை.",
      sch_search_ph: "திட்டத்தைத் தேடுங்கள்…",
      sch_central: "மத்திய திட்டங்கள்",
      sch_state: "மாநிலத் திட்டங்கள்",
      sch_updated: "புதுப்பிப்பு {date} · myScheme (myscheme.gov.in)",
      farm_title: "விவசாய இடுபொருட்கள்",
      farm_note:
        "யூரியா விலை அரசு நிர்ணயம்; DAP போன்ற P&K உரங்களின் விலையில் NBS மானியம் அடங்கும். கிடைப்பதை உங்கள் விற்பனையாளரிடம் உறுதிப்படுத்துங்கள்.",
      farm_stock_link: "உர இருப்பு (iFMS)",
      farm_shc_link: "மண் வள அட்டை",
      soil_btn: "மண் & உரம்",
      soil_loading: "மண் விவரம் ஏற்றப்படுகிறது…",
      soil_err: "மண் தரவு ஏற்ற முடியவில்லை — மீண்டும் முயல தட்டவும்.",
      soil_lbl_type: "மண் வகை",
      soil_lbl_oc: "அங்ககக் கரிமம்",
      soil_npk: "சமநிலை N-P-K பயன்பாட்டு வழிகாட்டி (அகில இந்தியா): 4:2:1",
      soil_note_alk:
        "காரத்தன்மை மண் — துத்தநாகம் கிடைப்பது குறையும், துத்தநாக (Zn) பற்றாக்குறை அபாயம் அதிகம்; ஜிங்க் சல்பேட் இடும் முன் மண் பரிசோதனையில் உறுதிப்படுத்துங்கள்.",
      soil_note_acid:
        "அமில மண் — மணிச்சத்து பிடிக்கப்பட்டு குறைவாகக் கிடைக்கும்; சுண்ணாம்பு இடுவது உதவலாம். மண் பரிசோதனையில் உறுதிப்படுத்துங்கள்.",
      soil_note_sandy:
        "மணல் மண் — தழைச்சத்து, சாம்பல் சத்து விரைவில் வடிந்துவிடும்; உரத்தை தவணைகளாக இடுங்கள்.",
      soil_note_ok: "சிறப்பு அபாயம் இல்லை — உங்கள் மண் வள அட்டை பரிந்துரைப்படி உரம் இடுங்கள்.",
      soil_verify: "மாதிரி மதிப்பீடு — உறுதிக்கு மண் வள அட்டை பரிசோதனை செய்யுங்கள்",
      soil_ph_acidic: "அமிலம்",
      soil_ph_neutral: "நடுநிலை",
      soil_ph_alkaline: "காரம்",
      soil_tex_clay: "களிமண்",
      soil_tex_clayloam: "களி-வண்டல் மண்",
      soil_tex_loam: "வண்டல் மண்",
      soil_tex_sandyloam: "மணல்-வண்டல் மண்",
      soil_tex_sandy: "மணல் மண்",
      soil_grp_black: "கரிசல் மண்",
      soil_grp_red: "செம்மண்",
      soil_grp_alluvial: "ஆற்றுப் படிவு மண்",
      soil_grp_sandy: "மணல் மண்",
      soil_grp_calc: "சுண்ணாம்பு மண்",
      soil_grp_shallow: "ஆழமற்ற/கற்கள் நிறைந்த மண்"
    },
    ml: {
      village_finder: "ഗ്രാമ തിരയൽ",
      search_ph: "ഏതെങ്കിലും ഗ്രാമം, താലൂക്ക് അല്ലെങ്കിൽ ജില്ല തിരയുക…",
      all_districts: "എല്ലാ ജില്ലകളും",
      districts: "ജില്ലകൾ",
      mandals: "മണ്ഡലങ്ങൾ",
      villages: "ഗ്രാമങ്ങൾ",
      district: "ജില്ല",
      mandal: "മണ്ഡലം",
      village: "ഗ്രാമം",
      district_word: "ജില്ല",
      mandal_word: "മണ്ഡലം",
      taluks: "താലൂക്കുകൾ",
      taluk: "താലൂക്ക്",
      taluk_word: "താലൂക്ക്",
      n_taluks: "{n} താലൂക്കുകൾ",
      villages_per_taluk: "ഓരോ താലൂക്കിലെയും ഗ്രാമങ്ങൾ",
      taluk_note:
        "താലൂക്ക് തലത്തിൽ കാണിച്ചിരിക്കുന്നു — കൃത്യമായ ഗ്രാമ കോർഡിനേറ്റുകൾ ഓപ്പൺ ഡാറ്റയിൽ ഇല്ല.",
      az: "A → Z",
      rural: "ഗ്രാമീണം",
      urban: "നഗരം",
      results: "ഫലങ്ങൾ",
      matches: "{n} ഫലങ്ങൾ",
      no_match: "“{q}” എന്നതുമായി പൊരുത്തപ്പെടുന്ന ഗ്രാമമോ താലൂക്കോ ജില്ലയോ ഇല്ല.",
      no_villages: "ഈ പ്രദേശത്തിന് ഗ്രാമങ്ങൾ പട്ടികയിൽ ഇല്ല.",
      villages_per_district: "ഓരോ ജില്ലയിലെയും ഗ്രാമങ്ങൾ",
      villages_per_mandal: "ഓരോ മണ്ഡലത്തിലെയും ഗ്രാമങ്ങൾ",
      villages_per_area: "ഓരോ പ്രദേശത്തെയും ഗ്രാമങ്ങൾ",
      updated: "പുതുക്കിയത്",
      n_villages: "{n} ഗ്രാമങ്ങൾ",
      n_mandals: "{n} മണ്ഡലങ്ങൾ",
      loading_data: "ഡാറ്റ ലോഡ് ചെയ്യുന്നു…",
      loading_map: "ഭൂപടം ലോഡ് ചെയ്യുന്നു…",
      data_lgd: "ഡാറ്റ: LGD",
      mirror: "മിറർ",
      report_issue: "പ്രശ്നം അറിയിക്കുക",
      source: "ഉറവിടം",
      home: "ഹോം — എല്ലാ സംസ്ഥാനങ്ങളും",
      language: "ഭാഷ",
      hide_panel: "പാനൽ മറയ്ക്കുക",
      show_panel: "പാനൽ കാണിക്കുക",
      clear: "മായ്ക്കുക",
      currently_viewing: "ഇപ്പോൾ {state} കാണുന്നു",
      approx_note: "ഏകദേശ സ്ഥാനം (GeoNames വഴി പൊരുത്തപ്പെടുത്തിയത്).",
      mandal_note:
        "മണ്ഡല തലത്തിൽ കാണിച്ചിരിക്കുന്നു — കൃത്യമായ ഗ്രാമ കോർഡിനേറ്റുകൾ ഓപ്പൺ ഡാറ്റയിൽ ഇല്ല.",
      boundary_missing:
        "{name} എന്നതിന്റെ ഭൂപട അതിർത്തി ഇനിയും പ്രസിദ്ധീകരിച്ചിട്ടില്ല (പുതിയ ജില്ല).",
      loc_missing: "{name} എന്നതിന്റെ സ്ഥാനം ഇനിയും ഭൂപടത്തിൽ ഇല്ല.",
      pin_label: "പിൻ",
      lgd_label: "LGD",
      parcels_toggle: "ഭൂമി പ്ലോട്ടുകൾ",
      parcels_zoom_hint: "ഭൂമി പ്ലോട്ടുകൾ കാണാൻ സൂം ഇൻ ചെയ്യുക.",
      show_parcels: "ഭൂമി പ്ലോട്ടുകൾ കാണിക്കുക",
      parcels_none: "{name} എന്നതിന് ഭൂമി പ്ലോട്ടുകൾ കണ്ടെത്തിയില്ല.",
      cadastre_loc_note: "ഭൂമി പ്ലോട്ട് രേഖകളിൽ നിന്നുള്ള സ്ഥാനം.",
      pl_search_ph: "സർവേ നമ്പർ തിരയുക…",
      n_parcels: "{n} പ്ലോട്ടുകൾ",
      pl_empty: "പൊരുത്തപ്പെടുന്ന സർവേ നമ്പറുകൾ ഇല്ല.",
      parcel_title: "ഭൂമി പ്ലോട്ട്",
      survey_no: "സർവേ നമ്പർ",
      parcel_area: "വിസ്തീർണ്ണം: {n} m²",
      coordinates: "കോർഡിനേറ്റുകൾ:",
      open_in_maps: "മാപ്സിൽ തുറക്കുക",
      copy_coords: "പകർത്തുക",
      coords_copied: "കോർഡിനേറ്റുകൾ പകർത്തി",
      cad_snapshot_note: "കഡസ്ട്രൽ സ്നാപ്പ്ഷോട്ട് — തത്സമയ ഭൂരേഖകളല്ല.",
      nb_find: "സമീപ സേവനങ്ങൾ കണ്ടെത്തുക",
      nb_loading: "സമീപ സേവനങ്ങൾ തിരയുന്നു…",
      nb_none: "{km} കി.മീ. നുള്ളിൽ ഒന്നും മാപ്പ് ചെയ്തിട്ടില്ല.",
      nb_err: "ലോഡ് ചെയ്യാനായില്ല — വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.",
      nb_src: "OpenStreetMap വഴി",
      nb_health: "ആശുപത്രികളും ക്ലിനിക്കുകളും",
      nb_government: "സർക്കാർ ഓഫീസുകൾ",
      nb_civic: "പോലീസും സിവിക് സേവനങ്ങളും",
      km: "{n} കി.മീ.",
      t_hospital: "ആശുപത്രി",
      t_clinic: "ക്ലിനിക്ക്",
      t_police: "പോലീസ് സ്റ്റേഷൻ",
      t_post_office: "പോസ്റ്റ് ഓഫീസ്",
      t_fire_station: "ഫയർ സ്റ്റേഷൻ",
      t_townhall: "ടൗൺ ഹാൾ",
      t_courthouse: "കോടതി",
      t_government: "സർക്കാർ ഓഫീസ്",
      wx_btn: "കാലാവസ്ഥയും പ്രവചനവും",
      wx_loading: "കാലാവസ്ഥ ലോഡ് ചെയ്യുന്നു…",
      wx_err: "ലോഡ് ചെയ്യാനായില്ല — വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.",
      wx_humidity: "ആർദ്രത {n}%",
      wx_wind: "കാറ്റ് {n} കി.മീ/മണിക്കൂർ",
      wx_mm: "{n} മി.മീ",
      wx_clear: "തെളിഞ്ഞ ആകാശം",
      wx_cloudy: "ഭാഗികമായി മേഘാവൃതം",
      wx_overcast: "മേഘാവൃതം",
      wx_fog: "മൂടൽമഞ്ഞ്",
      wx_drizzle: "ചാറ്റൽമഴ",
      wx_rain: "മഴ",
      wx_storm: "ഇടിമിന്നലോടു കൂടിയ മഴ",
      wx_src: "കാലാവസ്ഥ: Open-Meteo",
      mandi_btn: "മണ്ഡി വിലകൾ",
      mandi_title: "മണ്ഡി വിലകൾ",
      mandi_sub: "{district} ജില്ല · ₹/ക്വിന്റൽ",
      mandi_loading: "വിലകൾ ലോഡ് ചെയ്യുന്നു…",
      mandi_err: "വിലകൾ ലോഡ് ചെയ്യാനായില്ല — വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.",
      mandi_empty: "പൊരുത്തപ്പെടുന്ന ഉൽപ്പന്നങ്ങൾ ഇല്ല.",
      mandi_none_district: "{district} ജില്ലയിൽ ഇന്ന് മണ്ഡി വില രേഖപ്പെടുത്തിയിട്ടില്ല.",
      mandi_search_ph: "ഉൽപ്പന്നം തിരയുക…",
      mandi_updated: "പുതുക്കിയത് {date} · Agmarknet വഴി data.gov.in",
      fmb_btn: "സബ്-സർവേ / FMB സ്കെച്ച്",
      fmb_copied: "സർവേ വിവരങ്ങൾ പകർത്തി — {portal} ൽ ഗ്രാമം തിരഞ്ഞെടുത്ത് അവ നൽകുക.",
      ov_gw: "ഭൂഗർഭജല സാധ്യതകൾ",
      ov_soil: "മണ്ണിന്റെ തരം (SoilGrids)",
      sch_btn: "സർക്കാർ പദ്ധതികൾ",
      sch_title: "കർഷകർക്കുള്ള പദ്ധതികൾ",
      sch_sub: "{n} പദ്ധതികൾ",
      sch_loading: "പദ്ധതികൾ ലോഡ് ചെയ്യുന്നു…",
      sch_err: "പദ്ധതികൾ ലോഡ് ചെയ്യാനായില്ല — വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.",
      sch_empty: "പൊരുത്തപ്പെടുന്ന പദ്ധതികൾ ഇല്ല.",
      sch_search_ph: "പദ്ധതികൾ തിരയുക…",
      sch_central: "കേന്ദ്ര പദ്ധതികൾ",
      sch_state: "സംസ്ഥാന പദ്ധതികൾ",
      sch_updated: "പുതുക്കിയത് {date} · myScheme (myscheme.gov.in)",
      farm_title: "കൃഷി ഇൻപുട്ടുകൾ",
      farm_note:
        "യൂറിയയുടെ വില സർക്കാർ നിശ്ചയിച്ചതാണ്; DAP ഉൾപ്പെടെയുള്ള P&K വളങ്ങളുടെ വിലയിൽ NBS സബ്സിഡി ഉൾപ്പെടുന്നു. ലഭ്യത നിങ്ങളുടെ പ്രാദേശിക ഡീലറുമായി ഉറപ്പാക്കുക.",
      farm_stock_link: "വളം സ്റ്റോക്ക് (iFMS)",
      farm_shc_link: "സോയിൽ ഹെൽത്ത് കാർഡ്",
      soil_btn: "മണ്ണും വളവും",
      soil_loading: "മണ്ണിന്റെ വിവരം വായിക്കുന്നു…",
      soil_err: "മണ്ണിന്റെ ഡാറ്റ ലോഡ് ചെയ്യാനായില്ല — വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.",
      soil_lbl_type: "മണ്ണിന്റെ തരം",
      soil_lbl_oc: "ജൈവ കാർബൺ",
      soil_npk: "സന്തുലിത N-P-K ഉപയോഗ മാർഗ്ഗരേഖ (അഖിലേന്ത്യ): 4:2:1",
      soil_note_alk:
        "ക്ഷാര മണ്ണ് — സിങ്കിന്റെ ലഭ്യത കുറയും, സിങ്ക് (Zn) കുറവിനുള്ള സാധ്യത കൂടുതലാണ്; സിങ്ക് സൾഫേറ്റ് ഇടുന്നതിന് മുമ്പ് മണ്ണ് പരിശോധനയിൽ ഉറപ്പാക്കുക.",
      soil_note_acid:
        "അമ്ല മണ്ണ് — ഫോസ്ഫറസ് ബന്ധിക്കപ്പെട്ട് ലഭ്യത കുറയും; കുമ്മായം ഇടുന്നത് സഹായിക്കും. മണ്ണ് പരിശോധനയിൽ ഉറപ്പാക്കുക.",
      soil_note_sandy: "മണൽ മണ്ണ് — നൈട്രജനും പൊട്ടാഷും വേഗം ഒലിച്ചുപോകും; വളം തവണകളായി ഇടുക.",
      soil_note_ok:
        "പ്രത്യേക അപകടസാധ്യതയൊന്നും കണ്ടില്ല — നിങ്ങളുടെ സോയിൽ ഹെൽത്ത് കാർഡ് ശുപാർശ പിന്തുടരുക.",
      soil_verify: "മോഡൽ കണക്കാക്കൽ — സോയിൽ ഹെൽത്ത് കാർഡ് പരിശോധനയിൽ ഉറപ്പാക്കുക",
      soil_ph_acidic: "അമ്ലം",
      soil_ph_neutral: "നിഷ്പക്ഷം",
      soil_ph_alkaline: "ക്ഷാരം",
      soil_tex_clay: "കളിമണ്ണ്",
      soil_tex_clayloam: "കളിമണ്ണ്-പശിമ മണ്ണ്",
      soil_tex_loam: "പശിമ മണ്ണ്",
      soil_tex_sandyloam: "മണൽ-പശിമ മണ്ണ്",
      soil_tex_sandy: "മണൽ മണ്ണ്",
      soil_grp_black: "കറുത്ത പരുത്തി മണ്ണ്",
      soil_grp_red: "ചെമ്മണ്ണ്",
      soil_grp_alluvial: "എക്കൽ മണ്ണ്",
      soil_grp_sandy: "മണൽ മണ്ണ്",
      soil_grp_calc: "ചുണ്ണാമ്പ് മണ്ണ്",
      soil_grp_shallow: "ആഴം കുറഞ്ഞ / ചരൽ മണ്ണ്"
    }
  };

  var LANGS = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "te", name: "తెలుగు", dir: "ltr" },
    { code: "kn", name: "ಕನ್ನಡ", dir: "ltr" },
    { code: "ta", name: "தமிழ்", dir: "ltr" },
    { code: "ml", name: "മലയാളം", dir: "ltr" },
    { code: "hi", name: "हिन्दी", dir: "ltr" },
    { code: "ur", name: "اردو", dir: "rtl" }
  ];

  /**
   * Text direction for a language.
   * @param {string} lang  Language code.
   * @returns {("ltr"|"rtl")} Direction.
   */
  function dirOf(lang) {
    return lang === "ur" ? "rtl" : "ltr";
  }

  /**
   * Translate a UI string, expanding `{name}` placeholders, falling back to
   * English and then the raw key when a translation is missing.
   * @param {string} lang  Language code.
   * @param {string} key  Dictionary key.
   * @param {Object} [params]  Placeholder values.
   * @returns {string} Localised text.
   */
  function t(lang, key, params) {
    var d = DICT[lang] || DICT.en;
    var s = d[key];
    if (s == null) s = DICT.en[key];
    if (s == null) s = key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (_, k) {
        return params[k] != null ? params[k] : "{" + k + "}";
      });
    }
    return s;
  }

  // -------------------------------------------------- transliteration engine
  // Indic abugida scripts share structure; index by language:
  // te -> 0, hi -> 1, kn -> 2, ta -> 3, ml -> 4
  // Vowels: [te_indep, te_matra, hi_indep, hi_matra, kn_indep, kn_matra,
  //          ta_indep, ta_matra, ml_indep, ml_matra]
  var V = {
    a: ["అ", "", "अ", "", "ಅ", "", "அ", "", "അ", ""],
    aa: ["ఆ", "ా", "आ", "ा", "ಆ", "ಾ", "ஆ", "ா", "ആ", "ാ"],
    i: ["ఇ", "ి", "इ", "ि", "ಇ", "ಿ", "இ", "ி", "ഇ", "ി"],
    ii: ["ఈ", "ీ", "ई", "ी", "ಈ", "ೀ", "ஈ", "ீ", "ഈ", "ീ"],
    ee: ["ఈ", "ీ", "ई", "ी", "ಈ", "ೀ", "ஈ", "ீ", "ഈ", "ീ"],
    u: ["ఉ", "ు", "उ", "ु", "ಉ", "ು", "உ", "ு", "ഉ", "ു"],
    uu: ["ఊ", "ూ", "ऊ", "ू", "ಊ", "ೂ", "ஊ", "ூ", "ഊ", "ൂ"],
    oo: ["ఊ", "ూ", "ऊ", "ू", "ಊ", "ೂ", "ஊ", "ூ", "ഊ", "ൂ"],
    e: ["ఎ", "ె", "ए", "े", "ಎ", "ೆ", "எ", "ெ", "എ", "െ"],
    ai: ["ఐ", "ై", "ऐ", "ै", "ಐ", "ೈ", "ஐ", "ை", "ഐ", "ൈ"],
    o: ["ఒ", "ొ", "ओ", "ो", "ಒ", "ೊ", "ஒ", "ொ", "ഒ", "ൊ"],
    au: ["ఔ", "ౌ", "औ", "ौ", "ಔ", "ೌ", "ஔ", "ௌ", "ഔ", "ൗ"],
    ou: ["ఔ", "ౌ", "औ", "ौ", "ಔ", "ೌ", "ஔ", "ௌ", "ഔ", "ൗ"]
  };
  // Consonants: [te, hi, kn, ta]. Tamil has a reduced consonant set (no separate
  // voiced/aspirated letters), so several Roman keys map to the same Tamil glyph;
  // Sanskrit/Urdu sounds use the Grantha letters (ஜ ஷ ஸ ஹ க்ஷ).
  var C = {
    k: ["క", "क", "ಕ", "க", "ക"],
    kh: ["ఖ", "ख", "ಖ", "க", "ഖ"],
    g: ["గ", "ग", "ಗ", "க", "ഗ"],
    gh: ["ఘ", "घ", "ಘ", "க", "ഘ"],
    ch: ["చ", "च", "ಚ", "ச", "ച"],
    chh: ["ఛ", "छ", "ಛ", "ச", "ഛ"],
    c: ["చ", "च", "ಚ", "ச", "ച"],
    j: ["జ", "ज", "ಜ", "ஜ", "ജ"],
    jh: ["ఝ", "झ", "ಝ", "ஜ", "ഝ"],
    // Kerala English spellings use "t"/"d" for the retroflex row (Kottayam →
    // കോട്ടയം, Wayanad → വയനാട്) and "th"/"dh" for the dental one (Thrissur →
    // തൃശ്ശൂർ) — mirror that, like Tamil's ட choice.
    t: ["త", "त", "ತ", "ட", "ട"],
    th: ["థ", "थ", "ಥ", "த", "ത"],
    d: ["ద", "द", "ದ", "ட", "ട"],
    dh: ["ధ", "ध", "ಧ", "த", "ധ"],
    n: ["న", "न", "ನ", "ன", "ന"],
    p: ["ప", "प", "ಪ", "ப", "പ"],
    ph: ["ఫ", "फ", "ಫ", "ப", "ഫ"],
    f: ["ఫ", "फ़", "ಫ", "ப", "ഫ"],
    b: ["బ", "ब", "ಬ", "ப", "ബ"],
    bh: ["భ", "भ", "ಭ", "ப", "ഭ"],
    m: ["మ", "म", "ಮ", "ம", "മ"],
    y: ["య", "य", "ಯ", "ய", "യ"],
    r: ["ర", "र", "ರ", "ர", "ര"],
    l: ["ల", "ल", "ಲ", "ல", "ല"],
    v: ["వ", "व", "ವ", "வ", "വ"],
    w: ["వ", "व", "ವ", "வ", "വ"],
    sh: ["శ", "श", "ಶ", "ஷ", "ഷ"],
    s: ["స", "स", "ಸ", "ஸ", "സ"],
    h: ["హ", "ह", "ಹ", "ஹ", "ഹ"],
    z: ["జ", "ज़", "ಜ", "ஜ", "സ"],
    zh: ["ళ", "ळ", "ಳ", "ழ", "ഴ"],
    x: ["క్స", "क्स", "ಕ್ಸ", "க்ஸ", "ക്സ"],
    ksh: ["క్ష", "क्ष", "ಕ್ಷ", "க்ஷ", "ക്ഷ"],
    gn: ["గ్న", "ग्न", "ಗ್ನ", "க்ன", "ഗ്ന"],
    jn: ["జ్ఞ", "ज्ञ", "ಜ್ಞ", "ஜ்ஞ", "ജ്ഞ"]
  };
  // anusvara (nasal) [te, hi, kn, ta, ml]; Tamil writes nasals as full
  // consonants; Malayalam uses ം for the m-nasal only (ബോംബെ) — see renderIndic.
  var ANUS = ["ం", "ं", "ಂ", "", "ം"];
  var VIRAMA = ["్", "्", "್", "்", "്"]; // virama (halant / pulli / chandrakkala)
  var SCRIPT_IDX = { te: 0, hi: 1, kn: 2, ta: 3, ml: 4 };
  // Word-final consonant+virama → Malayalam chillu letter (കണ്ണൂര് → കണ്ണൂർ);
  // final മ് is written as the anusvara (പുറം-style endings).
  var ML_CHILLU = [
    [/മ്$/, "ം"],
    [/ന്$/, "ൻ"],
    [/ണ്$/, "ൺ"],
    [/ര്$/, "ർ"],
    [/ല്$/, "ൽ"],
    [/ള്$/, "ൾ"]
  ];

  // Urdu (abjad): consonants + long vowels; short vowels omitted.
  var CUR = {
    k: "ک",
    kh: "کھ",
    g: "گ",
    gh: "گھ",
    ch: "چ",
    chh: "چھ",
    c: "چ",
    j: "ج",
    jh: "جھ",
    t: "ت",
    th: "تھ",
    d: "د",
    dh: "دھ",
    n: "ن",
    p: "پ",
    ph: "پھ",
    f: "ف",
    b: "ب",
    bh: "بھ",
    m: "م",
    y: "ی",
    r: "ر",
    l: "ل",
    v: "و",
    w: "و",
    sh: "ش",
    s: "س",
    h: "ہ",
    z: "ز",
    x: "کس",
    ksh: "کش",
    gn: "گن",
    jn: "جن"
  };
  var VUR = {
    aa: "ا",
    ii: "ی",
    ee: "ی",
    uu: "و",
    oo: "و",
    ai: "ے",
    au: "و",
    ou: "و",
    o: "و",
    e: "ے",
    a: "",
    i: "",
    u: ""
  };

  // tokenizer keys, longest first so digraphs win
  var TOKKEYS = (function () {
    var keys = [];
    for (var k in C) if (C.hasOwnProperty(k)) keys.push(k);
    for (var v in V) if (V.hasOwnProperty(v)) keys.push(v);
    return keys.sort(function (a, b) {
      return b.length - a.length;
    });
  })();

  /**
   * Split a lowercase Roman word into phonetic tokens, matching the longest
   * known consonant/vowel key first so digraphs win.
   * @param {string} word  Lowercase Roman word.
   * @returns {string[]} Token sequence.
   */
  function tokenize(word) {
    var toks = [],
      i = 0,
      n = word.length;
    while (i < n) {
      var matched = null;
      for (var k = 0; k < TOKKEYS.length; k++) {
        var key = TOKKEYS[k];
        if (word.substr(i, key.length) === key) {
          matched = key;
          break;
        }
      }
      if (matched) {
        toks.push(matched);
        i += matched.length;
      } else {
        toks.push(word.charAt(i));
        i += 1;
      }
    }
    return toks;
  }

  /**
   * Render phonetic tokens into an Indic abugida script (Telugu/Devanagari/
   * Kannada/Tamil), handling matras, conjuncts, anusvara nasals and the
   * trailing-inherent-`a` rules per script.
   * @param {string[]} toks  Tokens from {@link tokenize}.
   * @param {("te"|"hi"|"kn"|"ta")} lang  Target script language.
   * @returns {string} Native-script string.
   */
  function renderIndic(toks, lang) {
    var si = SCRIPT_IDX[lang];
    var ind = si * 2,
      mat = si * 2 + 1,
      con = si;
    var anus = ANUS[si],
      virama = VIRAMA[si];
    var tamil = lang === "ta";
    var mal = lang === "ml";
    var dravidian = lang === "te" || lang === "kn" || tamil || mal; // drop trailing inherent 'a'
    var out = "",
      prev = "start";
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i],
        next = toks[i + 1];
      if (C[tk]) {
        // n / m after a vowel and before a *different* consonant → nasal anusvara
        // (must follow a vowel — an anusvara can't begin a syllable/word). A
        // doubled nasal (nn / mm) is gemination, not an anusvara, so it falls
        // through to the conjunct path (Dimma → దిమ్మ, not దింమ). Tamil has no
        // anusvara so it always uses consonant + pulli (சென்னை); Malayalam's ം
        // is an m-sound only (ബോംബെ), so its n keeps the conjunct path (കൊണ്ട).
        if (
          !tamil &&
          (tk === "n" || tk === "m") &&
          !(mal && tk === "n") &&
          prev === "vowel" &&
          next &&
          C[next] &&
          next !== tk
        ) {
          out += anus;
          prev = "nasal";
          continue;
        }
        if (prev === "cons") out += virama; // conjunct / gemination
        // Tamil 'n': dental ந word-initially, alveolar ன elsewhere (best-effort).
        out += tamil && tk === "n" && prev === "start" ? "ந" : C[tk][con];
        prev = "cons";
      } else if (V[tk]) {
        out += prev === "cons" ? V[tk][mat] : V[tk][ind];
        prev = "vowel";
      } else {
        out += tk;
        prev = "other";
      }
    }
    if (prev === "cons" && dravidian) out += virama;
    // Malayalam writes word-final nasals/liquids as chillu letters (ർ ൻ ൽ …)
    // and a final m as the anusvara — also correct before a rendered suffix
    // (മനൽ + കര), so applying per rendered chunk is safe.
    if (mal) {
      for (var c = 0; c < ML_CHILLU.length; c++)
        out = out.replace(ML_CHILLU[c][0], ML_CHILLU[c][1]);
    }
    return out;
  }

  /**
   * Render phonetic tokens into Urdu (abjad): consonants and long vowels, with
   * short vowels omitted and a word-initial alif/madda for vowel-initial words.
   * @param {string[]} toks  Tokens from {@link tokenize}.
   * @returns {string} Urdu-script string.
   */
  function renderUrdu(toks) {
    var out = "";
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (CUR[tk]) {
        out += CUR[tk];
      } else if (VUR.hasOwnProperty(tk)) {
        if (i === 0) {
          out += tk === "aa" ? "آ" : "ا";
          if (tk !== "aa") out += VUR[tk];
        } else {
          out += VUR[tk];
        }
      } else {
        out += tk;
      }
    }
    return out;
  }

  // Common place-name suffixes → canonical native spelling [te, hi, kn, ta].
  // Indian village names are highly compositional, and these morphemes carry long
  // vowels that the English spelling drops (e.g. "-pur" → పూర్, not పుర్). Rendering
  // them directly — and transliterating only the preceding stem — is markedly more
  // faithful to the official LGD spelling than going letter-by-letter. (Validated
  // against LGD's authoritative names via scraper/translit_eval.mjs.)
  var MORPH = {
    puram: ["పురం", "पुरम", "ಪುರ", "புரம்", "പുരം"],
    pur: ["పూర్", "पुर", "ಪುರ", "பூர்", "പൂർ"],
    palle: ["పల్లె", "पल्ले", "ಪಲ್ಲೆ", "பள்ளி", "പള്ളെ"],
    palli: ["పల్లి", "पल्ली", "ಪಲ್ಲಿ", "பள்ளி", "പള്ളി"],
    pally: ["పల్లి", "पल्ली", "ಪಲ್ಲಿ", "பள்ளி", "പള്ളി"],
    halli: ["హళ్ళి", "हल्ली", "ಹಳ್ಳಿ", "அள்ளி", "ഹള്ളി"],
    hatti: ["హట్టి", "हट्टी", "ಹಟ್ಟಿ", "அட்டி", "ഹട്ടി"],
    gaon: ["గాంవ్", "गांव", "ಗಾಂವ್", "காவ்", "ഗാവ്"],
    wadi: ["వాడి", "वाडी", "ವಾಡಿ", "வாடி", "വാടി"],
    wada: ["వాడ", "वाडा", "ವಾಡ", "வாடா", "വാഡ"],
    vada: ["వాడ", "वाडा", "ವಾಡ", "வாடா", "വാഡ"],
    palayam: ["పాళయం", "पालयम", "ಪಾಳ್ಯ", "பாளையம்", "പാളയം"],
    palem: ["పాలెం", "पालेम", "ಪಾಳೆಂ", "பாளேம்", "പാലെം"],
    gudem: ["గూడెం", "गूडेम", "ಗೂಡೆಂ", "கூடேம்", "ഗൂഡെം"],
    guda: ["గూడ", "गूडा", "ಗೂಡ", "குடா", "ഗൂഡ"],
    kunta: ["కుంట", "कुंटा", "ಕುಂಟ", "குந்த", "കുണ്ട"],
    pettai: ["పేట్టై", "पेट्टै", "ಪೇಟ್ಟೈ", "பேட்டை", "പേട്ട"],
    pakkam: ["పాక్కం", "पाक्कम", "ಪಾಕ್ಕಂ", "பாக்கம்", "പാക്കം"],
    kuppam: ["కుప్పం", "कुप्पम", "ಕುಪ್ಪಂ", "குப்பம்", "കുപ്പം"],
    patti: ["పట్టి", "पट्टी", "ಪಟ್ಟಿ", "பட்டி", "പട്ടി"],
    peta: ["పేట", "पेठा", "ಪೇಟ", "பேட்டை", "പേട്ട"],
    nagar: ["నగర్", "नगर", "ನಗರ", "நகர்", "നഗർ"],
    mangalam: ["మంగళం", "मंगलम", "ಮಂಗಳ", "மங்கலம்", "മംഗലം"],
    // Kerala-specific morphemes. `null` for the other scripts falls through to
    // plain letter-by-letter rendering there, so adding these keys cannot
    // change any existing language's output (see the MORPH[suf][si] guard).
    kulam: [null, null, null, null, "കുളം"],
    kara: [null, null, null, null, "കര"],
    kode: [null, null, null, null, "കോട്"],
    kad: [null, null, null, null, "കാട്"],
    chery: [null, null, null, null, "ചേരി"],
    ssery: [null, null, null, null, "ശ്ശേരി"],
    kavu: [null, null, null, null, "കാവ്"]
  };
  var MORPHKEYS = Object.keys(MORPH).sort(function (a, b) {
    return b.length - a.length;
  });

  /**
   * Transliterate one Roman word: peel off a known place-name suffix (rendered
   * from its canonical spelling) and transliterate the remaining stem, applying
   * stem-final nasal→anusvara fixes for Telugu/Kannada.
   * @param {("te"|"hi"|"kn"|"ta"|"ur")} lang  Target language.
   * @param {string} word  Roman word.
   * @returns {string} Native-script word.
   */
  function renderWord(lang, word) {
    if (lang === "ur") return renderUrdu(tokenize(word.toLowerCase()));
    var lw = word.toLowerCase(),
      si = SCRIPT_IDX[lang];
    for (var i = 0; i < MORPHKEYS.length; i++) {
      var suf = MORPHKEYS[i];
      if (lw.length > suf.length + 1 && lw.slice(-suf.length) === suf && MORPH[suf][si] != null) {
        var stem = word.slice(0, word.length - suf.length);
        var nasal = "";
        // A stem-final n/m before the (consonant-initial) suffix nasalises to an
        // anusvara in Telugu/Kannada (e.g. Bheem+pur → భీంపూర్). Tamil has no
        // anusvara, so it keeps the nasal consonant via the normal path;
        // Malayalam's ം covers only the m sound (Ram+puram → റാംപുരം).
        var nasalRe = lang === "ml" ? /[aeiou]m$/ : /[aeiou][nm]$/;
        if (lang !== "ta" && nasalRe.test(stem.toLowerCase())) {
          nasal = ANUS[si];
          stem = stem.slice(0, -1);
        }
        return renderIndic(tokenize(stem.toLowerCase()), lang) + nasal + MORPH[suf][si];
      }
    }
    return renderIndic(tokenize(lw), lang);
  }

  var SUPPORTED = { te: 1, hi: 1, kn: 1, ta: 1, ml: 1, ur: 1 };
  var CACHE = {};
  /**
   * Best-effort transliteration of a Roman place name into the target script,
   * transliterating each `[A-Za-z]+` run and caching results. Returns the input
   * unchanged for English or unsupported languages.
   * @param {string} lang  Target language code.
   * @param {string} name  Roman place name.
   * @returns {string} Transliterated (or unchanged) name.
   */
  function translit(lang, name) {
    if (!name || lang === "en" || !SUPPORTED[lang]) return name;
    var ck = lang + "|" + name;
    if (CACHE[ck] != null) return CACHE[ck];
    var out = name.replace(/[A-Za-z]+/g, function (word) {
      return renderWord(lang, word) || word;
    });
    CACHE[ck] = out;
    return out;
  }

  return { LANGS: LANGS, t: t, translit: translit, dirOf: dirOf };
})();
