/** =====================================================================
   AP, Telangana, Karnataka & Tamil Nadu Village Finder — i18n
   Exposes window.VF_I18N:
     LANGS              [{code, name, dir}, ...]
     t(lang, key, p)    translate a UI string ({n}-style placeholders)
     translit(lang, s)  best-effort transliteration of a Roman place name
                        into Telugu / Devanagari / Kannada / Tamil / Urdu script
     dirOf(lang)        "ltr" | "rtl"

   Sub-district tier: AP/Telangana call it a "Mandal", Karnataka & Tamil Nadu a
   "Taluk". Both term families are provided; the app picks one via config.division.

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
 * @property {string} code  Language code (en | te | kn | ta | hi | ur).
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
      cadastre_loc_note: "Location from land-parcel records (APSAC).",
      pl_search_ph: "Search survey no…",
      n_parcels: "{n} parcels",
      pl_empty: "No matching survey numbers.",
      parcel_title: "Land parcel",
      survey_no: "Survey no.",
      parcel_area: "Area: {n} m²",
      cad_snapshot_note: "Cadastral snapshot (APSAC) — not live land records.",
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
      t_government: "Govt. office"
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
      cadastre_loc_note: "భూ కమతాల రికార్డుల ఆధారంగా స్థానం (APSAC).",
      pl_search_ph: "సర్వే నం. వెతకండి…",
      n_parcels: "{n} కమతాలు",
      pl_empty: "సరిపోలే సర్వే నంబర్లు లేవు.",
      parcel_title: "భూ కమతం",
      survey_no: "సర్వే నం.",
      parcel_area: "విస్తీర్ణం: {n} మీ²",
      cad_snapshot_note: "కడస్ట్రల్ స్నాప్‌షాట్ (APSAC) — ప్రత్యక్ష భూ రికార్డులు కాదు.",
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
      t_government: "ప్రభుత్వ కార్యాలయం"
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
      t_government: "सरकारी कार्यालय"
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
      t_government: "ಸರ್ಕಾರಿ ಕಚೇರಿ"
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
      t_government: "سرکاری دفتر"
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
      t_government: "அரசு அலுவலகம்"
    }
  };

  var LANGS = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "te", name: "తెలుగు", dir: "ltr" },
    { code: "kn", name: "ಕನ್ನಡ", dir: "ltr" },
    { code: "ta", name: "தமிழ்", dir: "ltr" },
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
  // Indic abugida scripts share structure; index by language: te -> 0, hi -> 1, kn -> 2, ta -> 3
  // Vowels: [te_indep, te_matra, hi_indep, hi_matra, kn_indep, kn_matra, ta_indep, ta_matra]
  var V = {
    a: ["అ", "", "अ", "", "ಅ", "", "அ", ""],
    aa: ["ఆ", "ా", "आ", "ा", "ಆ", "ಾ", "ஆ", "ா"],
    i: ["ఇ", "ి", "इ", "ि", "ಇ", "ಿ", "இ", "ி"],
    ii: ["ఈ", "ీ", "ई", "ी", "ಈ", "ೀ", "ஈ", "ீ"],
    ee: ["ఈ", "ీ", "ई", "ी", "ಈ", "ೀ", "ஈ", "ீ"],
    u: ["ఉ", "ు", "उ", "ु", "ಉ", "ು", "உ", "ு"],
    uu: ["ఊ", "ూ", "ऊ", "ू", "ಊ", "ೂ", "ஊ", "ூ"],
    oo: ["ఊ", "ూ", "ऊ", "ू", "ಊ", "ೂ", "ஊ", "ூ"],
    e: ["ఎ", "ె", "ए", "े", "ಎ", "ೆ", "எ", "ெ"],
    ai: ["ఐ", "ై", "ऐ", "ै", "ಐ", "ೈ", "ஐ", "ை"],
    o: ["ఒ", "ొ", "ओ", "ो", "ಒ", "ೊ", "ஒ", "ொ"],
    au: ["ఔ", "ౌ", "औ", "ौ", "ಔ", "ೌ", "ஔ", "ௌ"],
    ou: ["ఔ", "ౌ", "औ", "ौ", "ಔ", "ೌ", "ஔ", "ௌ"]
  };
  // Consonants: [te, hi, kn, ta]. Tamil has a reduced consonant set (no separate
  // voiced/aspirated letters), so several Roman keys map to the same Tamil glyph;
  // Sanskrit/Urdu sounds use the Grantha letters (ஜ ஷ ஸ ஹ க்ஷ).
  var C = {
    k: ["క", "क", "ಕ", "க"],
    kh: ["ఖ", "ख", "ಖ", "க"],
    g: ["గ", "ग", "ಗ", "க"],
    gh: ["ఘ", "घ", "ಘ", "க"],
    ch: ["చ", "च", "ಚ", "ச"],
    chh: ["ఛ", "छ", "ಛ", "ச"],
    c: ["చ", "च", "ಚ", "ச"],
    j: ["జ", "ज", "ಜ", "ஜ"],
    jh: ["ఝ", "झ", "ಝ", "ஜ"],
    t: ["త", "त", "ತ", "ட"],
    th: ["థ", "थ", "ಥ", "த"],
    d: ["ద", "द", "ದ", "ட"],
    dh: ["ధ", "ध", "ಧ", "த"],
    n: ["న", "न", "ನ", "ன"],
    p: ["ప", "प", "ಪ", "ப"],
    ph: ["ఫ", "फ", "ಫ", "ப"],
    f: ["ఫ", "फ़", "ಫ", "ப"],
    b: ["బ", "ब", "ಬ", "ப"],
    bh: ["భ", "भ", "ಭ", "ப"],
    m: ["మ", "म", "ಮ", "ம"],
    y: ["య", "य", "ಯ", "ய"],
    r: ["ర", "र", "ರ", "ர"],
    l: ["ల", "ल", "ಲ", "ல"],
    v: ["వ", "व", "ವ", "வ"],
    w: ["వ", "व", "ವ", "வ"],
    sh: ["శ", "श", "ಶ", "ஷ"],
    s: ["స", "स", "ಸ", "ஸ"],
    h: ["హ", "ह", "ಹ", "ஹ"],
    z: ["జ", "ज़", "ಜ", "ஜ"],
    x: ["క్స", "क्स", "ಕ್ಸ", "க்ஸ"],
    ksh: ["క్ష", "क्ष", "ಕ್ಷ", "க்ஷ"],
    gn: ["గ్న", "ग्न", "ಗ್ನ", "க்ன"],
    jn: ["జ్ఞ", "ज्ञ", "ಜ್ಞ", "ஜ்ஞ"]
  };
  var ANUS = ["ం", "ं", "ಂ", ""]; // anusvara (nasal)  [te, hi, kn]; Tamil writes nasals as full consonants
  var VIRAMA = ["్", "्", "್", "்"]; // virama (halant / Tamil pulli) [te, hi, kn, ta]
  var SCRIPT_IDX = { te: 0, hi: 1, kn: 2, ta: 3 };

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
    var dravidian = lang === "te" || lang === "kn" || tamil; // drop trailing inherent 'a'
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
        // anusvara either, so it always uses the consonant + pulli (சென்னை).
        if (
          !tamil &&
          (tk === "n" || tk === "m") &&
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
    puram: ["పురం", "पुरम", "ಪುರ", "புரம்"],
    pur: ["పూర్", "पुर", "ಪುರ", "பூர்"],
    palle: ["పల్లె", "पल्ले", "ಪಲ್ಲೆ", "பள்ளி"],
    palli: ["పల్లి", "पल्ली", "ಪಲ್ಲಿ", "பள்ளி"],
    pally: ["పల్లి", "पल्ली", "ಪಲ್ಲಿ", "பள்ளி"],
    halli: ["హళ్ళి", "हल्ली", "ಹಳ್ಳಿ", "அள்ளி"],
    hatti: ["హట్టి", "हट्टी", "ಹಟ್ಟಿ", "அட்டி"],
    gaon: ["గాంవ్", "गांव", "ಗಾಂವ್", "காவ்"],
    wadi: ["వాడి", "वाडी", "ವಾಡಿ", "வாடி"],
    wada: ["వాడ", "वाडा", "ವಾಡ", "வாடா"],
    vada: ["వాడ", "वाडा", "ವಾಡ", "வாடா"],
    palayam: ["పాళయం", "पालयम", "ಪಾಳ್ಯ", "பாளையம்"],
    palem: ["పాలెం", "पालेम", "ಪಾಳೆಂ", "பாளேம்"],
    gudem: ["గూడెం", "गूडेम", "ಗೂಡೆಂ", "கூடேம்"],
    guda: ["గూడ", "गूडा", "ಗೂಡ", "குடா"],
    kunta: ["కుంట", "कुंटा", "ಕುಂಟ", "குந்த"],
    pettai: ["పేట్టై", "पेट्टै", "ಪೇಟ್ಟೈ", "பேட்டை"],
    pakkam: ["పాక్కం", "पाक्कम", "ಪಾಕ್ಕಂ", "பாக்கம்"],
    kuppam: ["కుప్పం", "कुप्पम", "ಕುಪ್ಪಂ", "குப்பம்"],
    patti: ["పట్టి", "पट्टी", "ಪಟ್ಟಿ", "பட்டி"],
    peta: ["పేట", "पेठा", "ಪೇಟ", "பேட்டை"],
    nagar: ["నగర్", "नगर", "ನಗರ", "நகர்"],
    mangalam: ["మంగళం", "मंगलम", "ಮಂಗಳ", "மங்கலம்"]
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
        // anusvara, so it keeps the nasal consonant via the normal path.
        if (lang !== "ta" && /[aeiou][nm]$/.test(stem.toLowerCase())) {
          nasal = ANUS[si];
          stem = stem.slice(0, -1);
        }
        return renderIndic(tokenize(stem.toLowerCase()), lang) + nasal + MORPH[suf][si];
      }
    }
    return renderIndic(tokenize(lw), lang);
  }

  var SUPPORTED = { te: 1, hi: 1, kn: 1, ta: 1, ur: 1 };
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
