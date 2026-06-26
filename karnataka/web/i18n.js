/* =====================================================================
   AP, Telangana & Karnataka Village Finder — internationalisation (i18n)
   Exposes window.VF_I18N:
     LANGS              [{code, name, dir}, ...]
     t(lang, key, p)    translate a UI string ({n}-style placeholders)
     translit(lang, s)  best-effort transliteration of a Roman place name
                        into Telugu / Devanagari / Kannada / Urdu script
     dirOf(lang)        "ltr" | "rtl"

   Sub-district tier: AP/Telangana call it a "Mandal", Karnataka a "Taluk".
   Both term families are provided; the app picks one via config.division.

   NOTE ON TRANSLITERATION
   The official LGD open data only carries *English* place names, so the
   native-script names below are produced by a rule-based phonetic engine.
   They are approximate (especially for Urdu, which omits short vowels) and
   are always shown alongside the canonical English name (hover / search).
   ===================================================================== */
window.VF_I18N = (function () {
  "use strict";

  // ---------------------------------------------------------------- UI text
  var DICT = {
    en: {
      village_finder: "Village Finder",
      search_ph: "Search any village, mandal or district…",
      all_districts: "All districts",
      districts: "Districts", mandals: "Mandals", villages: "Villages",
      district: "District", mandal: "Mandal", village: "Village",
      district_word: "district", mandal_word: "mandal",
      taluks: "Taluks", taluk: "Taluk", taluk_word: "taluk",
      n_taluks: "{n} taluks", villages_per_taluk: "Villages per taluk",
      taluk_note: "Shown at taluk level — exact village coordinates aren’t in the open data.",
      az: "A → Z",
      rural: "Rural", urban: "Urban",
      results: "Results", matches: "{n} matches",
      no_match: "No village, mandal or district matches “{q}”.",
      no_villages: "No villages listed for this area.",
      villages_per_district: "Villages per district",
      villages_per_mandal: "Villages per mandal",
      villages_per_area: "Villages per area",
      updated: "Updated",
      n_villages: "{n} villages", n_mandals: "{n} mandals",
      loading_data: "Loading data…", loading_map: "Loading map…",
      data_lgd: "Data: LGD", mirror: "Mirror",
      report_issue: "Report an issue", source: "Source",
      home: "Home — all states",
      language: "Language", hide_panel: "Hide panel", show_panel: "Show panel",
      clear: "Clear", currently_viewing: "Currently viewing {state}",
      approx_note: "Approximate location (matched via GeoNames).",
      mandal_note: "Shown at mandal level — exact village coordinates aren’t in the open data.",
      boundary_missing: "Map boundary not yet published for {name} (a new district).",
      loc_missing: "Location of {name} isn’t on the map yet.",
      pin_label: "PIN", lgd_label: "LGD"
    },
    te: {
      village_finder: "గ్రామ శోధన",
      search_ph: "ఏదైనా గ్రామం, మండలం లేదా జిల్లాను శోధించండి…",
      all_districts: "అన్ని జిల్లాలు",
      districts: "జిల్లాలు", mandals: "మండలాలు", villages: "గ్రామాలు",
      district: "జిల్లా", mandal: "మండలం", village: "గ్రామం",
      district_word: "జిల్లా", mandal_word: "మండలం",
      taluks: "తాలూకాలు", taluk: "తాలూకా", taluk_word: "తాలూకా",
      n_taluks: "{n} తాలూకాలు", villages_per_taluk: "తాలూకాకి గ్రామాలు",
      taluk_note: "తాలూకా స్థాయిలో చూపబడింది — ఖచ్చితమైన గ్రామ నిర్దేశాంకాలు ఓపెన్ డేటాలో లేవు.",
      az: "A → Z",
      rural: "గ్రామీణ", urban: "పట్టణ",
      results: "ఫలితాలు", matches: "{n} ఫలితాలు",
      no_match: "“{q}”కి సరిపోలే గ్రామం, మండలం లేదా జిల్లా లేదు.",
      no_villages: "ఈ ప్రాంతానికి గ్రామాలు జాబితా చేయబడలేదు.",
      villages_per_district: "జిల్లాకి గ్రామాలు",
      villages_per_mandal: "మండలానికి గ్రామాలు",
      villages_per_area: "ప్రాంతానికి గ్రామాలు",
      updated: "నవీకరించబడింది",
      n_villages: "{n} గ్రామాలు", n_mandals: "{n} మండలాలు",
      loading_data: "డేటా లోడ్ అవుతోంది…", loading_map: "మ్యాప్ లోడ్ అవుతోంది…",
      data_lgd: "డేటా: LGD", mirror: "మిర్రర్",
      report_issue: "సమస్యను నివేదించండి", source: "సోర్స్",
      home: "హోమ్ — అన్ని రాష్ట్రాలు",
      language: "భాష", hide_panel: "ప్యానెల్ దాచు", show_panel: "ప్యానెల్ చూపించు",
      clear: "క్లియర్", currently_viewing: "ప్రస్తుతం {state} చూస్తున్నారు",
      approx_note: "సుమారు స్థానం (GeoNames ద్వారా సరిపోల్చబడింది).",
      mandal_note: "మండల స్థాయిలో చూపబడింది — ఖచ్చితమైన గ్రామ నిర్దేశాంకాలు ఓపెన్ డేటాలో లేవు.",
      boundary_missing: "{name} కోసం మ్యాప్ సరిహద్దు ఇంకా ప్రచురించబడలేదు (కొత్త జిల్లా).",
      loc_missing: "{name} స్థానం ఇంకా మ్యాప్‌లో లేదు.",
      pin_label: "పిన్", lgd_label: "LGD"
    },
    hi: {
      village_finder: "ग्राम खोजक",
      search_ph: "कोई भी गाँव, मंडल या ज़िला खोजें…",
      all_districts: "सभी ज़िले",
      districts: "ज़िले", mandals: "मंडल", villages: "गाँव",
      district: "ज़िला", mandal: "मंडल", village: "गाँव",
      district_word: "ज़िला", mandal_word: "मंडल",
      taluks: "तालुक", taluk: "तालुक", taluk_word: "तालुक",
      n_taluks: "{n} तालुक", villages_per_taluk: "प्रति तालुक गाँव",
      taluk_note: "तालुक स्तर पर दिखाया गया — सटीक गाँव निर्देशांक खुले डेटा में नहीं हैं।",
      az: "A → Z",
      rural: "ग्रामीण", urban: "शहरी",
      results: "परिणाम", matches: "{n} मिलान",
      no_match: "“{q}” से मेल खाता कोई गाँव, मंडल या ज़िला नहीं।",
      no_villages: "इस क्षेत्र के लिए कोई गाँव सूचीबद्ध नहीं है।",
      villages_per_district: "प्रति ज़िला गाँव",
      villages_per_mandal: "प्रति मंडल गाँव",
      villages_per_area: "प्रति क्षेत्र गाँव",
      updated: "अद्यतन",
      n_villages: "{n} गाँव", n_mandals: "{n} मंडल",
      loading_data: "डेटा लोड हो रहा है…", loading_map: "मानचित्र लोड हो रहा है…",
      data_lgd: "डेटा: LGD", mirror: "मिरर",
      report_issue: "समस्या की रिपोर्ट करें", source: "स्रोत",
      home: "होम — सभी राज्य",
      language: "भाषा", hide_panel: "पैनल छिपाएँ", show_panel: "पैनल दिखाएँ",
      clear: "साफ़ करें", currently_viewing: "वर्तमान में {state} देख रहे हैं",
      approx_note: "अनुमानित स्थान (GeoNames द्वारा मिलान)।",
      mandal_note: "मंडल स्तर पर दिखाया गया — सटीक गाँव निर्देशांक खुले डेटा में नहीं हैं।",
      boundary_missing: "{name} के लिए मानचित्र सीमा अभी प्रकाशित नहीं हुई (नया ज़िला)।",
      loc_missing: "{name} का स्थान अभी मानचित्र पर नहीं है।",
      pin_label: "पिन", lgd_label: "LGD"
    },
    kn: {
      village_finder: "ಗ್ರಾಮ ಹುಡುಕಾಟ",
      search_ph: "ಯಾವುದೇ ಗ್ರಾಮ, ತಾಲೂಕು ಅಥವಾ ಜಿಲ್ಲೆ ಹುಡುಕಿ…",
      all_districts: "ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು",
      districts: "ಜಿಲ್ಲೆಗಳು", mandals: "ಮಂಡಲಗಳು", villages: "ಗ್ರಾಮಗಳು",
      district: "ಜಿಲ್ಲೆ", mandal: "ಮಂಡಲ", village: "ಗ್ರಾಮ",
      district_word: "ಜಿಲ್ಲೆ", mandal_word: "ಮಂಡಲ",
      taluks: "ತಾಲೂಕುಗಳು", taluk: "ತಾಲೂಕು", taluk_word: "ತಾಲೂಕು",
      n_taluks: "{n} ತಾಲೂಕುಗಳು", villages_per_taluk: "ತಾಲೂಕಿಗೆ ಗ್ರಾಮಗಳು",
      taluk_note: "ತಾಲೂಕು ಮಟ್ಟದಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ — ನಿಖರ ಗ್ರಾಮ ನಿರ್ದೇಶಾಂಕಗಳು ಮುಕ್ತ ಡೇಟಾದಲ್ಲಿ ಇಲ್ಲ.",
      az: "A → Z",
      rural: "ಗ್ರಾಮೀಣ", urban: "ನಗರ",
      results: "ಫಲಿತಾಂಶಗಳು", matches: "{n} ಫಲಿತಾಂಶಗಳು",
      no_match: "“{q}” ಗೆ ಹೊಂದುವ ಗ್ರಾಮ, ತಾಲೂಕು ಅಥವಾ ಜಿಲ್ಲೆ ಇಲ್ಲ.",
      no_villages: "ಈ ಪ್ರದೇಶಕ್ಕೆ ಯಾವುದೇ ಗ್ರಾಮಗಳು ಪಟ್ಟಿ ಮಾಡಿಲ್ಲ.",
      villages_per_district: "ಜಿಲ್ಲೆಗೆ ಗ್ರಾಮಗಳು",
      villages_per_mandal: "ಮಂಡಲಕ್ಕೆ ಗ್ರಾಮಗಳು",
      villages_per_area: "ಪ್ರದೇಶಕ್ಕೆ ಗ್ರಾಮಗಳು",
      updated: "ನವೀಕರಿಸಲಾಗಿದೆ",
      n_villages: "{n} ಗ್ರಾಮಗಳು", n_mandals: "{n} ಮಂಡಲಗಳು",
      loading_data: "ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ…", loading_map: "ನಕ್ಷೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      data_lgd: "ಡೇಟಾ: LGD", mirror: "ಮಿರರ್",
      report_issue: "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ", source: "ಮೂಲ",
      home: "ಮುಖಪುಟ — ಎಲ್ಲಾ ರಾಜ್ಯಗಳು",
      language: "ಭಾಷೆ", hide_panel: "ಪ್ಯಾನೆಲ್ ಮರೆಮಾಡಿ", show_panel: "ಪ್ಯಾನೆಲ್ ತೋರಿಸಿ",
      clear: "ತೆರವುಗೊಳಿಸಿ", currently_viewing: "ಪ್ರಸ್ತುತ {state} ನೋಡುತ್ತಿದ್ದೀರಿ",
      approx_note: "ಅಂದಾಜು ಸ್ಥಳ (GeoNames ಮೂಲಕ ಹೊಂದಿಕೆ).",
      mandal_note: "ಮಂಡಲ ಮಟ್ಟದಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ — ನಿಖರ ಗ್ರಾಮ ನಿರ್ದೇಶಾಂಕಗಳು ಮುಕ್ತ ಡೇಟಾದಲ್ಲಿ ಇಲ್ಲ.",
      boundary_missing: "{name} ಗೆ ನಕ್ಷೆ ಗಡಿ ಇನ್ನೂ ಪ್ರಕಟವಾಗಿಲ್ಲ (ಹೊಸ ಜಿಲ್ಲೆ).",
      loc_missing: "{name} ಸ್ಥಳ ಇನ್ನೂ ನಕ್ಷೆಯಲ್ಲಿ ಇಲ್ಲ.",
      pin_label: "ಪಿನ್", lgd_label: "LGD"
    },
    ur: {
      village_finder: "گاؤں تلاش",
      search_ph: "کوئی بھی گاؤں، منڈل یا ضلع تلاش کریں…",
      all_districts: "تمام اضلاع",
      districts: "اضلاع", mandals: "منڈل", villages: "گاؤں",
      district: "ضلع", mandal: "منڈل", village: "گاؤں",
      district_word: "ضلع", mandal_word: "منڈل",
      taluks: "تعلقہ", taluk: "تعلقہ", taluk_word: "تعلقہ",
      n_taluks: "{n} تعلقہ", villages_per_taluk: "فی تعلقہ گاؤں",
      taluk_note: "تعلقہ سطح پر دکھایا گیا — درست گاؤں کوآرڈینیٹس کھلے ڈیٹا میں نہیں ہیں۔",
      az: "A → Z",
      rural: "دیہی", urban: "شہری",
      results: "نتائج", matches: "{n} نتائج",
      no_match: "“{q}” سے کوئی گاؤں، منڈل یا ضلع میل نہیں کھاتا۔",
      no_villages: "اس علاقے کے لیے کوئی گاؤں درج نہیں۔",
      villages_per_district: "فی ضلع گاؤں",
      villages_per_mandal: "فی منڈل گاؤں",
      villages_per_area: "فی علاقہ گاؤں",
      updated: "اپ ڈیٹ شدہ",
      n_villages: "{n} گاؤں", n_mandals: "{n} منڈل",
      loading_data: "ڈیٹا لوڈ ہو رہا ہے…", loading_map: "نقشہ لوڈ ہو رہا ہے…",
      data_lgd: "ڈیٹا: LGD", mirror: "مرر",
      report_issue: "مسئلہ رپورٹ کریں", source: "ماخذ",
      home: "ہوم — تمام ریاستیں",
      language: "زبان", hide_panel: "پینل چھپائیں", show_panel: "پینل دکھائیں",
      clear: "صاف کریں", currently_viewing: "اس وقت {state} دیکھ رہے ہیں",
      approx_note: "تخمینی مقام (GeoNames کے ذریعے میل)۔",
      mandal_note: "منڈل سطح پر دکھایا گیا — درست گاؤں کوآرڈینیٹس کھلے ڈیٹا میں نہیں ہیں۔",
      boundary_missing: "{name} کے لیے نقشے کی حد ابھی شائع نہیں ہوئی (نیا ضلع)۔",
      loc_missing: "{name} کا مقام ابھی نقشے پر نہیں ہے۔",
      pin_label: "پن", lgd_label: "LGD"
    }
  };

  var LANGS = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "te", name: "తెలుగు", dir: "ltr" },
    { code: "kn", name: "ಕನ್ನಡ", dir: "ltr" },
    { code: "hi", name: "हिन्दी", dir: "ltr" },
    { code: "ur", name: "اردو", dir: "rtl" }
  ];

  function dirOf(lang) { return lang === "ur" ? "rtl" : "ltr"; }

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
  // Indic abugida scripts share structure; index by language: te -> 0, hi -> 1, kn -> 2
  // Vowels: [te_indep, te_matra, hi_indep, hi_matra, kn_indep, kn_matra]
  var V = {
    "a":  ["అ", "",  "अ", "",  "ಅ", ""],
    "aa": ["ఆ", "ా", "आ", "ा", "ಆ", "ಾ"],
    "i":  ["ఇ", "ి", "इ", "ि", "ಇ", "ಿ"],
    "ii": ["ఈ", "ీ", "ई", "ी", "ಈ", "ೀ"],
    "ee": ["ఈ", "ీ", "ई", "ी", "ಈ", "ೀ"],
    "u":  ["ఉ", "ు", "उ", "ु", "ಉ", "ು"],
    "uu": ["ఊ", "ూ", "ऊ", "ू", "ಊ", "ೂ"],
    "oo": ["ఊ", "ూ", "ऊ", "ू", "ಊ", "ೂ"],
    "e":  ["ఎ", "ె", "ए", "े", "ಎ", "ೆ"],
    "ai": ["ఐ", "ై", "ऐ", "ै", "ಐ", "ೈ"],
    "o":  ["ఒ", "ొ", "ओ", "ो", "ಒ", "ೊ"],
    "au": ["ఔ", "ౌ", "औ", "ौ", "ಔ", "ೌ"],
    "ou": ["ఔ", "ౌ", "औ", "ौ", "ಔ", "ೌ"]
  };
  // Consonants: [te, hi, kn]
  var C = {
    "k": ["క", "क", "ಕ"], "kh": ["ఖ", "ख", "ಖ"], "g": ["గ", "ग", "ಗ"], "gh": ["ఘ", "घ", "ಘ"],
    "ch": ["చ", "च", "ಚ"], "chh": ["ఛ", "छ", "ಛ"], "c": ["చ", "च", "ಚ"],
    "j": ["జ", "ज", "ಜ"], "jh": ["ఝ", "झ", "ಝ"],
    "t": ["త", "त", "ತ"], "th": ["థ", "थ", "ಥ"], "d": ["ద", "द", "ದ"], "dh": ["ధ", "ध", "ಧ"],
    "n": ["న", "न", "ನ"], "p": ["ప", "प", "ಪ"], "ph": ["ఫ", "फ", "ಫ"], "f": ["ఫ", "फ़", "ಫ"],
    "b": ["బ", "ब", "ಬ"], "bh": ["భ", "भ", "ಭ"], "m": ["మ", "म", "ಮ"],
    "y": ["య", "य", "ಯ"], "r": ["ర", "र", "ರ"], "l": ["ల", "ल", "ಲ"],
    "v": ["వ", "व", "ವ"], "w": ["వ", "व", "ವ"],
    "sh": ["శ", "श", "ಶ"], "s": ["స", "स", "ಸ"], "h": ["హ", "ह", "ಹ"],
    "z": ["జ", "ज़", "ಜ"], "x": ["క్స", "क्स", "ಕ್ಸ"], "ksh": ["క్ష", "क्ष", "ಕ್ಷ"],
    "gn": ["గ్న", "ग्न", "ಗ್ನ"], "jn": ["జ్ఞ", "ज्ञ", "ಜ್ಞ"]
  };
  var ANUS = ["ం", "ं", "ಂ"];       // anusvara (nasal)  [te, hi, kn]
  var VIRAMA = ["్", "्", "್"];      // virama (halant)   [te, hi, kn]
  var SCRIPT_IDX = { te: 0, hi: 1, kn: 2 };

  // Urdu (abjad): consonants + long vowels; short vowels omitted.
  var CUR = {
    "k": "ک", "kh": "کھ", "g": "گ", "gh": "گھ", "ch": "چ", "chh": "چھ", "c": "چ",
    "j": "ج", "jh": "جھ", "t": "ت", "th": "تھ", "d": "د", "dh": "دھ",
    "n": "ن", "p": "پ", "ph": "پھ", "f": "ف", "b": "ب", "bh": "بھ", "m": "م",
    "y": "ی", "r": "ر", "l": "ل", "v": "و", "w": "و", "sh": "ش", "s": "س",
    "h": "ہ", "z": "ز", "x": "کس", "ksh": "کش", "gn": "گن", "jn": "جن"
  };
  var VUR = {
    "aa": "ا", "ii": "ی", "ee": "ی", "uu": "و", "oo": "و",
    "ai": "ے", "au": "و", "ou": "و", "o": "و", "e": "ے",
    "a": "", "i": "", "u": ""
  };

  // tokenizer keys, longest first so digraphs win
  var TOKKEYS = (function () {
    var keys = [];
    for (var k in C) if (C.hasOwnProperty(k)) keys.push(k);
    for (var v in V) if (V.hasOwnProperty(v)) keys.push(v);
    return keys.sort(function (a, b) { return b.length - a.length; });
  })();

  function tokenize(word) {
    var toks = [], i = 0, n = word.length;
    while (i < n) {
      var matched = null;
      for (var k = 0; k < TOKKEYS.length; k++) {
        var key = TOKKEYS[k];
        if (word.substr(i, key.length) === key) { matched = key; break; }
      }
      if (matched) { toks.push(matched); i += matched.length; }
      else { toks.push(word.charAt(i)); i += 1; }
    }
    return toks;
  }

  function renderIndic(toks, lang) {
    var si = SCRIPT_IDX[lang];
    var ind = si * 2, mat = si * 2 + 1, con = si;
    var anus = ANUS[si], virama = VIRAMA[si];
    var dravidian = (lang === "te" || lang === "kn"); // drop trailing inherent 'a'
    var out = "", prev = "start";
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i], next = toks[i + 1];
      if (C[tk]) {
        // n / m after a vowel and before another consonant → nasal anusvara
        // (must follow a vowel — an anusvara can't begin a syllable/word)
        if ((tk === "n" || tk === "m") && prev === "vowel" && next && C[next]) { out += anus; prev = "nasal"; continue; }
        if (prev === "cons") out += virama;       // conjunct / gemination
        out += C[tk][con];
        prev = "cons";
      } else if (V[tk]) {
        out += (prev === "cons") ? V[tk][mat] : V[tk][ind];
        prev = "vowel";
      } else {
        out += tk; prev = "other";
      }
    }
    if (prev === "cons" && dravidian) out += virama;
    return out;
  }

  function renderUrdu(toks) {
    var out = "";
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (CUR[tk]) { out += CUR[tk]; }
      else if (VUR.hasOwnProperty(tk)) {
        if (i === 0) { out += (tk === "aa") ? "آ" : "ا"; if (tk !== "aa") out += VUR[tk]; }
        else { out += VUR[tk]; }
      } else { out += tk; }
    }
    return out;
  }

  var SUPPORTED = { te: 1, hi: 1, kn: 1, ur: 1 };
  var CACHE = {};
  function translit(lang, name) {
    if (!name || lang === "en" || !SUPPORTED[lang]) return name;
    var ck = lang + "|" + name;
    if (CACHE[ck] != null) return CACHE[ck];
    var out = name.replace(/[A-Za-z]+/g, function (word) {
      var toks = tokenize(word.toLowerCase());
      var r = (lang === "ur") ? renderUrdu(toks) : renderIndic(toks, lang);
      return r || word;
    });
    CACHE[ck] = out;
    return out;
  }

  return { LANGS: LANGS, t: t, translit: translit, dirOf: dirOf };
})();
