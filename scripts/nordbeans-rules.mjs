// Pravidla kontroly dat — MS Nordbeans (CZ26529), dotazník
// "Scenario definition 8306.xlsx" (návštěva kavárny, sekce A–G).
//
// Vedle těchto pravidel v appce vždy běží vestavěná kontrola pravopisu
// a data návštěvy vs. okno terénu.
//
// Skupiny:
//   F — formální údaje (datum, časy)
//   R — filtrování otázek podle definice (disable(…) u odpovědí): doplňující
//       text jen u odpovědi, ke které patří
//   L — logické vazby napříč otázkami (odpovědi si nesmí odporovat)
//   T — nesmyslné a nesouvisející texty (výplň, kopírování, jen opakuje
//       odpověď, text mimo téma otázky)
// HIGH = jasná chyba, MEDIUM = podezřelé, ručně ověřit.

const H = "HIGH";
const M = "MEDIUM";

// --- stavebnice podmínek (viz src/lib/rules/conditionCheck.ts) ---
const filled = (q) => ({ q, is: "filled" });
const empty = (q) => ({ q, is: "empty" });
const code = (q, ...codes) => ({ q, codeIn: codes });
const has = (q, ...keywords) => ({ q, containsAny: keywords });
const all = (...c) => ({ all: c });
const any = (...c) => ({ any: c });
const not = (c) => ({ not: c });
const iff = (a, b) => ({ iff: [a, b] });

const rule = (code, description, severity, questionCode, when, require) => ({
  code, description, severity, questionCode, when, require,
});

// otevřené (textové) otázky dotazníku
const TEXTS = [
  "X4", "X5", "X7", "A1t", "A4t", "A5", "B1t", "B4t", "B10t", "B11t", "B16t", "B23", "C2t", "C5t", "C8t", "C9",
  "D1", "D6", "E0t", "E2t", "E3t", "E4", "F8", "G1", "G2t", "G8", "G9",
];

// doplňující text → kdy patří (podle disable(…) v definici)
const FOLLOW_UPS = [
  ["R01", "A1t", "co bylo špatně při uvítání", code("A1", "o2", "o4"), "A1 = o2/o4 (necítil/a se vítán/a)"],
  ["R02", "A4t", "v čem se v provozu nevyznal/a", code("A4", "o2"), "A4 = Ne"],
  ["R03", "B1t", "co nebylo v pořádku se stolem", code("B1", "o2"), "B1 = Ne"],
  ["R04", "B4t", "co obsluha doporučila", code("B4", "o0"), "B4 = Ano"],
  ["R05", "B11t", "co nebylo v pořádku s pořadím", code("B11", "o2"), "B11 = Ne"],
  ["R06", "B16t", "co obsluha nabídla navíc", code("B16", "o0", "o2"), "B16 = Ano (o0/o2)"],
  ["R07", "C2t", "dotaz na alergeny", code("C2", "o0", "o2"), "C2 = Ano/Ne (ptal/a se)"],
  ["R08", "C5t", "co zaznamenal/a v týmu", code("C5", "o2"), "C5 = Ne"],
  ["R09", "C8t", "popis komplikace", code("C8", "o0", "o2"), "C8 = Ano/Ne (komplikace nastala)"],
];

// slova, která v názvu kávového nápoje (E0t) dávají smysl
const COFFEE_WORDS = [
  "kav", "espresso", "esspreso", "expreso", "lungo", "ristretto", "doppio", "americano", "cappuccino", "capuccino",
  "kapucin", "latte", "flat", "white", "cortado", "macchiato", "piccolo", "mocha", "moka", "filtr", "batch",
  "v60", "aeropress", "chemex", "cold brew", "coldbrew", "tonic", "frappe", "affogato", "irish", "viden", "turek",
  "decaf", "bezkofein", "presso",
];

export const RULES = [
  // ---------- F – formální údaje ----------
  rule("F01", "Datum návštěvy (X1) je jiný den než RealDate", H, "X1",
    all(filled("X1"), filled("RealDate")),
    { q: "X1", dateTimeNear: { of: "RealDate", maxMinutes: 24 * 60, sameDay: true } }),
  rule("F02", "Datum návštěvy (X1) je v budoucnosti", H, "X1",
    filled("X1"), { q: "X1", dateTimeOnOrBefore: "now" }),
  rule("F03", "Čas odchodu (X3) je dřív než čas příchodu (X2)", H, "X3",
    all(filled("X2"), filled("X3")), { q: "X3", timeAfter: { of: "X2", minMinutes: 1 } }),
  rule("F04", "Návštěva podle X2/X3 trvala přes 4 hodiny – překlep v čase?", M, "X3",
    all(filled("X2"), filled("X3")), { q: "X3", timeAfter: { of: "X2", maxMinutes: 240 } }),
  rule("F05", "Celková útrata (X4) neobsahuje částku", H, "X4",
    filled("X4"), { q: "X4", matches: "\\d", label: "číslo (částku)" }),

  // ---------- R – filtrování otázek ----------
  ...FOLLOW_UPS.map(([id, q, what, cond, condText]) =>
    rule(id, `${q} (${what}) patří jen k ${condText}`, H, q, undefined, iff(cond, filled(q)))),
  rule("R10", "Jen dezert (B6t = o2) → B13 a B15 se nehodnotí", H, "B6t",
    code("B6t", "o2"), all(empty("B13"), empty("B15"))),

  // ---------- L – logické vazby napříč otázkami ----------
  rule("L01", "Nikdo nezaregistroval příchod (A1 = o4), ale obsluha se věnovala ihned (A2 = o0)", H, "A2",
    undefined, not(all(code("A1", "o4"), code("A2", "o0")))),
  rule("L02", "Nádobí se sklízelo průběžně (B14 = Ano), ale B15 = „nádobí nebylo sklizeno“ (o4)", H, "B15",
    undefined, not(all(code("B14", "o0"), code("B15", "o4")))),
  rule("L03", "Objednávka nebyla připravena včas (B10 = Ne), ale B12 = „objednávka se nezdržela“", H, "B12",
    undefined, not(all(code("B10", "o2"), code("B12", "o4")))),
  rule("L04", "Objednávka byla včas (B10 = Ano), ale B12 hodnotí zdržení – ověřit", M, "B12",
    undefined, not(all(code("B10", "o0"), code("B12", "o0", "o2")))),
  rule("L05", "Účet/platba s komplikací (B18 = Ne) nebo zdržení (B12 = o0/o2), ale C8 = „žádná komplikace“", M, "C8",
    code("C8", "o4"), not(any(code("B18", "o2"), code("B12", "o0", "o2")))),
  rule("L06", "Vrátil/a by se (G7 = Ano), ale G3–G6 jsou všechny za 1 bod", H, "G7",
    code("G7", "o0"), not(all(code("G3", "o0"), code("G4", "o0"), code("G5", "o0"), code("G6", "o0")))),
  rule("L07", "Nevrátil/a by se (G7 = Ne), ale G3–G6 jsou všechny za 5 bodů", H, "G7",
    code("G7", "o2"), not(all(code("G3", "o8"), code("G4", "o8"), code("G5", "o8"), code("G6", "o8")))),
  rule("L08", "Neobjednal/a nekávový nápoj (D5 = o4), ale v D1 je čaj / limonáda / čokoláda / džus – ověřit", M, "D5",
    code("D5", "o4"), not(has("D1", "caj", "limonad", "cokolad", "dzus", "fresh", "smoothie", "matcha", "chai", "kombuch", "voda"))),

  // ---------- T – nesmyslné a nesouvisející texty ----------
  rule("T01", "Výplňová odpověď místo textu („-“, „.“, „x“, „nevím“, „viz výše“, „ok“, jen číslo)", H, "A5",
    undefined, all(...TEXTS.filter((q) => q !== "X4").map((q) => ({ q, notFiller: true })))),
  rule("T02", "Stejný text zkopírovaný do více otázek (podobnost nad 85 %)", H, "A5",
    undefined, { texts: TEXTS, maxPairSimilarity: 0.85 }),
  rule("T03", "Doplňující text jen opakuje zvolenou odpověď (podobnost nad 80 %)", M, "A1t",
    undefined, all(
      { q: "A1t", notSimilarToAnswerOf: "A1", max: 0.8 },
      { q: "B11t", notSimilarToAnswerOf: "B11", max: 0.8 },
      { q: "C5t", notSimilarToAnswerOf: "C5", max: 0.8 },
    )),
  rule("T04", "Kávový nápoj (E0t) neobsahuje název kávy – nesouvisející text?", M, "E0t",
    filled("E0t"), has("E0t", ...COFFEE_WORDS)),
  rule("T05", "Doba čekání (B10t) neobsahuje číslo ani časový údaj", M, "B10t",
    filled("B10t"), { q: "B10t", matches: "\\d|minut|hodin|chvil|ihned|hned|okamzit|okamžit", label: "dobu čekání" }),
  rule("T06", "Místo bydliště (X7) vypadá jako věta, ne název města", M, "X7",
    filled("X7"), { q: "X7", matches: "^[^.!?]{1,40}$", label: "krátký název města" }),
];
