/* =====================================================================
   AP & Telangana Village Finder — internationalisation (i18n)
   Exposes window.VF_I18N:
     LANGS              [{code, name, dir}, ...]
     t(lang, key, p)    translate a UI string ({n}-style placeholders)
     translit(lang, s)  best-effort transliteration of a Roman place name
                        into Telugu / Devanagari / Urdu script
     dirOf(lang)        "ltr" | "rtl"

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
      az: "A → Z",
      rural: "Rural", urban: "Urban",
      results: "Results", matches: "{n} matches",
      no_match: "No village, mandal or district matches “{q}”.",
      no_villages: "No villages listed for this mandal.",
      villages_per_district: "Villages per district",
      villages_per_mandal: "Villages per mandal",
      villages_per_area: "Villages per area",
      updated: "Updated",
      n_villages: "{n} villages", n_mandals: "{n} mandals",
      loading_data: "Loading data…", loading_map: "Loading map…",
      data_lgd: "Data: LGD", mirror: "Mirror",
      report_issue: "Report an issue", source: "Source",
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
      az: "A → Z",
      rural: "గ్రామీణ", urban: "పట్టణ",
      results: "ఫలితాలు", matches: "{n} ఫలితాలు",
      no_match: "“{q}”కి సరిపోలే గ్రామం, మండలం లేదా జిల్లా లేదు.",
      no_villages: "ఈ మండలానికి గ్రామాలు జాబితా చేయబడలేదు.",
      villages_per_district: "జిల్లాకి గ్రామాలు",
      villages_per_mandal: "మండలానికి గ్రామాలు",
      villages_per_area: "ప్రాంతానికి గ్రామాలు",
      updated: "నవీకరించబడింది",
      n_villages: "{n} గ్రామాలు", n_mandals: "{n} మండలాలు",
      loading_data: "డేటా లోడ్ అవుతోంది…", loading_map: "మ్యాప్ లోడ్ అవుతోంది…",
      data_lgd: "డేటా: LGD", mirror: "మిర్రర్",
      report_issue: "సమస్యను నివేదించండి", source: "సోర్స్",
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
      az: "A → Z",
      rural: "ग्रामीण", urban: "शहरी",
      results: "परिणाम", matches: "{n} मिलान",
      no_match: "“{q}” से मेल खाता कोई गाँव, मंडल या ज़िला नहीं।",
      no_villages: "इस मंडल के लिए कोई गाँव सूचीबद्ध नहीं है।",
      villages_per_district: "प्रति ज़िला गाँव",
      villages_per_mandal: "प्रति मंडल गाँव",
      villages_per_area: "प्रति क्षेत्र गाँव",
      updated: "अद्यतन",
      n_villages: "{n} गाँव", n_mandals: "{n} मंडल",
      loading_data: "डेटा लोड हो रहा है…", loading_map: "मानचित्र लोड हो रहा है…",
      data_lgd: "डेटा: LGD", mirror: "मिरर",
      report_issue: "समस्या की रिपोर्ट करें", source: "स्रोत",
      language: "भाषा", hide_panel: "पैनल छिपाएँ", show_panel: "पैनल दिखाएँ",
      clear: "साफ़ करें", currently_viewing: "वर्तमान में {state} देख रहे हैं",
      approx_note: "अनुमानित स्थान (GeoNames द्वारा मिलान)।",
      mandal_note: "मंडल स्तर पर दिखाया गया — सटीक गाँव निर्देशांक खुले डेटा में नहीं हैं।",
      boundary_missing: "{name} के लिए मानचित्र सीमा अभी प्रकाशित नहीं हुई (नया ज़िला)।",
      loc_missing: "{name} का स्थान अभी मानचित्र पर नहीं है।",
      pin_label: "पिन", lgd_label: "LGD"
    },
    ur: {
      village_finder: "گاؤں تلاش",
      search_ph: "کوئی بھی گاؤں، منڈل یا ضلع تلاش کریں…",
      all_districts: "تمام اضلاع",
      districts: "اضلاع", mandals: "منڈل", villages: "گاؤں",
      district: "ضلع", mandal: "منڈل", village: "گاؤں",
      district_word: "ضلع", mandal_word: "منڈل",
      az: "A → Z",
      rural: "دیہی", urban: "شہری",
      results: "نتائج", matches: "{n} نتائج",
      no_match: "“{q}” سے کوئی گاؤں، منڈل یا ضلع میل نہیں کھاتا۔",
      no_villages: "اس منڈل کے لیے کوئی گاؤں درج نہیں۔",
      villages_per_district: "فی ضلع گاؤں",
      villages_per_mandal: "فی منڈل گاؤں",
      villages_per_area: "فی علاقہ گاؤں",
      updated: "اپ ڈیٹ شدہ",
      n_villages: "{n} گاؤں", n_mandals: "{n} منڈل",
      loading_data: "ڈیٹا لوڈ ہو رہا ہے…", loading_map: "نقشہ لوڈ ہو رہا ہے…",
      data_lgd: "ڈیٹا: LGD", mirror: "مرر",
      report_issue: "مسئلہ رپورٹ کریں", source: "ماخذ",
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
  // Vowels: [te_independent, te_matra, hi_independent, hi_matra]
  var V = {
    "a":  ["అ", "",  "अ", ""],
    "aa": ["ఆ", "ా", "आ", "ा"],
    "i":  ["ఇ", "ి", "इ", "ि"],
    "ii": ["ఈ", "ీ", "ई", "ी"],
    "ee": ["ఈ", "ీ", "ई", "ी"],
    "u":  ["ఉ", "ు", "उ", "ु"],
    "uu": ["ఊ", "ూ", "ऊ", "ू"],
    "oo": ["ఊ", "ూ", "ऊ", "ू"],
    "e":  ["ఎ", "ె", "ए", "े"],
    "ai": ["ఐ", "ై", "ऐ", "ै"],
    "o":  ["ఒ", "ొ", "ओ", "ो"],
    "au": ["ఔ", "ౌ", "औ", "ौ"],
    "ou": ["ఔ", "ౌ", "औ", "ौ"]
  };
  // Consonants: [te, hi]
  var C = {
    "k": ["క", "क"], "kh": ["ఖ", "ख"], "g": ["గ", "ग"], "gh": ["ఘ", "घ"],
    "ch": ["చ", "च"], "chh": ["ఛ", "छ"], "c": ["చ", "च"],
    "j": ["జ", "ज"], "jh": ["ఝ", "झ"],
    "t": ["త", "त"], "th": ["థ", "थ"], "d": ["ద", "द"], "dh": ["ధ", "ध"],
    "n": ["న", "न"], "p": ["ప", "प"], "ph": ["ఫ", "फ"], "f": ["ఫ", "फ़"],
    "b": ["బ", "ब"], "bh": ["భ", "भ"], "m": ["మ", "म"],
    "y": ["య", "य"], "r": ["ర", "र"], "l": ["ల", "ल"],
    "v": ["వ", "व"], "w": ["వ", "व"],
    "sh": ["శ", "श"], "s": ["స", "स"], "h": ["హ", "ह"],
    "z": ["జ", "ज़"], "x": ["క్స", "क्स"], "ksh": ["క్ష", "क्ष"],
    "gn": ["గ్న", "ग्न"], "jn": ["జ్ఞ", "ज्ञ"]
  };
  var ANUS = ["ం", "ं"];     // anusvara (nasal)  [te, hi]
  var VIRAMA = ["్", "्"];   // virama (halant)   [te, hi]

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
    var isTe = lang === "te";
    var ind = isTe ? 0 : 2, mat = isTe ? 1 : 3, con = isTe ? 0 : 1;
    var anus = isTe ? ANUS[0] : ANUS[1];
    var virama = isTe ? VIRAMA[0] : VIRAMA[1];
    var out = "", prev = "start";
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i], next = toks[i + 1];
      if (C[tk]) {
        // n / m before another consonant → nasal anusvara
        if ((tk === "n" || tk === "m") && next && C[next]) { out += anus; prev = "nasal"; continue; }
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
    if (prev === "cons" && isTe) out += virama;     // Telugu: drop trailing inherent 'a'
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

  var CACHE = {};
  function translit(lang, name) {
    if (!name || lang === "en" || (lang !== "te" && lang !== "hi" && lang !== "ur")) return name;
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
