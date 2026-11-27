// Pravidla kontroly dat — Tesco Mobile MS (dotazník listopad 2026 v2).
//
// MÍRNÁ VERZE (27. 11. 2026). Původní sada podle "Tesco Mobile – pravidla
// pro kontrolu dat.xlsx" (58 pravidel) hlásila hlavně věci, které chybou
// nejsou — hledání klíčových slov v textech, minimální délky textů, slang,
// "ověřit/nahlásit" podněty. Ponecháno je jen to, co je v dotazníku logicky
// NESMYSL: rozpor mezi uzavřenými odpověďmi, porušené filtrování otázek
// (text vyplněný u odpovědi, která ho nemá, nebo chybějící tam, kde být má),
// nemožné hodnoty (datum, délka rozhovoru) a prázdné výplňové odpovědi.
// Všechna pravidla mají závažnost HIGH — co tu zbylo, je potřeba opravit.
//
// Vedle těchto pravidel běží v appce vždy i vestavěné kontroly: pravopis
// (překlepy v odpovědích) a datum návštěvy vs. okno terénu scénáře.
//
// Vědomě vyřazeno z původní sady (falešné nálezy v listopadové vlně):
//   R01, F05, O10a–c — A1 = o12 (cedule) neznamená konec dotazníku: MS na
//                      pracovníka počkal a rozhovor proběhl (všech 7 návštěv
//                      má dotazník vyplněný správně)
//   R09b             — B9 = o6 a vysvětlující text („síť nezmínil“) není chyba
//   O01–O09, Q01, Q02, Q07 — hledání slov v textu, délka textu, slang
//   F02 30 min, F03b/c, F04b, F06, L03b, L04–L07, P01 — jen podněty k ověření

const H = "HIGH";

// --- stavebnice podmínek ---
const filled = (q) => ({ q, is: "filled" });
const empty = (q) => ({ q, is: "empty" });
const code = (q, ...codes) => ({ q, codeIn: codes });
const includes = (q, ...codes) => ({ q, codesInclude: codes });
const has = (q, ...keywords) => ({ q, containsAny: keywords });
const all = (...c) => ({ all: c });
const not = (c) => ({ not: c });
const iff = (a, b) => ({ iff: [a, b] });

// otevřené (textové) otázky dotazníku
const TEXTS = ["X1", "X6", "A1t", "A3", "A4t", "A5", "B3j", "B4tt", "B5t", "B9t", "B12", "D1t", "D2t", "D3t", "D4t", "D5", "D6t", "D7t"];

const rule = (code, description, questionCode, when, require) => ({
  code, description, severity: H, questionCode, when, require,
});

export const RULES = [
  // ---------- F – nemožné hodnoty ----------
  rule("F02", "Datum návštěvy (X2) je jiný den než RealDate", "X2",
    all(filled("X2"), filled("RealDate")),
    { q: "X2", dateTimeNear: { of: "RealDate", maxMinutes: 24 * 60, sameDay: true } }),
  rule("F03", "Datum návštěvy (X2) je v budoucnosti", "X2",
    filled("X2"), { q: "X2", dateTimeOnOrBefore: "now" }),
  rule("F04a", "Délka rozhovoru (X5) 1 hodina a víc – nejspíš zapsané hodiny místo minut", "X5",
    filled("X5"), { q: "X5", durationMinutes: { max: 59 } }),
  rule("F04b", "Rozhovor proběhl (A1 = o0/o2), ale délka (X5) chybí nebo je pod 1 minutu", "X5",
    code("A1", "o0", "o2"), { q: "X5", durationMinutes: { min: 1 } }),

  // ---------- R – filtrování otázek (text jen u správné odpovědi) ----------
  rule("R02", "Popis situace (A1t) vyplněný, i když pracovník byl na místě (A1 = o0/o2)", "A1t",
    code("A1", "o0", "o2"), empty("A1t")),
  rule("R03", "A3 (čemu se pracovník věnoval) patří jen k A2 = o2 (MS ho musel oslovit)", "A3",
    undefined, iff(code("A2", "o2"), filled("A3"))),
  rule("R04", "A4t (co pracovník dělal) patří jen k A4 = o4 (nejevil zájem)", "A4t",
    undefined, iff(code("A4", "o4"), filled("A4t"))),
  rule("R05", "B3j (jiné benefity) patří jen k B3tt = Jiné (o12)", "B3j",
    undefined, iff(includes("B3tt", "o12"), filled("B3j"))),
  rule("R07a", "B4t (pomůcky) patří jen k B4 = Ano (o0)", "B4t",
    undefined, iff(code("B4", "o0"), filled("B4t"))),
  rule("R07b", "B4tt (jiné pomůcky) patří jen k B4t = Jiné (o10)", "B4tt",
    undefined, iff(includes("B4t", "o10"), filled("B4tt"))),
  rule("R08", "B5t (co ukazoval v aplikaci) patří jen k B5 = Ano (o0)", "B5t",
    undefined, iff(code("B5", "o0"), filled("B5t"))),
  rule("R09", "B9 říká, že pracovník síť/rychlost zmínil (o0/o2/o4), ale B9t je prázdné", "B9t",
    code("B9", "o0", "o2", "o4"), filled("B9t")),
  rule("R10", "D5 (co udělat jinak) patří jen k D4 = Váhal/Ne (o2/o4)", "D5",
    undefined, iff(code("D4", "o2", "o4"), filled("D5"))),
  rule("R11", "D7t (co odradilo) patří jen k D7 = Ano (o2/o4)", "D7t",
    undefined, iff(code("D7", "o2", "o4"), filled("D7t"))),
  rule("R12", "Rozhovor proběhl (A1 = o0/o2), ale chybí povinný text (X6, A5, B12, D1t–D4t, D6t)", "A1",
    code("A1", "o0", "o2"), all(...["X6", "A5", "B12", "D1t", "D2t", "D3t", "D4t", "D6t"].map(filled))),
  rule("R13", "Vyřazený kód odpovědi (A1 o4/o6/o8, B4t o4) – v dotazníku už není", "A1",
    undefined, all(not(code("A1", "o4", "o6", "o8")), not(includes("B4t", "o4")))),

  // ---------- L – rozpory mezi uzavřenými odpověďmi ----------
  // A1 = o12 (cedule) sem nepatří: cedule může být jen o přestávce, bez kontaktů → X4 = Ne je možné.
  rule("L01a", "Pracovník byl na místě (A1 = o0/o2), ale X4 = Ne", "X4",
    code("A1", "o0", "o2"), code("X4", "o0")),
  rule("L01b", "Pracovník nebyl na místě ani cedule (A1 = o10), ale X4 = Ano", "X4",
    code("A1", "o10"), code("X4", "o2")),
  rule("L02", "Pracovník MS aktivně oslovil (A2 = o0), ale A4 = o4 „nejevil zájem, musel/a jsem ho oslovit sám“", "A2",
    undefined, not(all(code("A2", "o0"), code("A4", "o4")))),
  rule("L03", "Zvolené „žádné benefity“ (B3tt o14) spolu s jinými benefity", "B3tt",
    includes("B3tt", "o14"), { q: "B3tt", codeCount: { max: 1 } }),
  rule("L04", "Relevantní benefit zmínil (B3t = o0), ale v B3tt jsou „žádné benefity“ (o14)", "B3t",
    undefined, not(all(code("B3t", "o0"), includes("B3tt", "o14")))),

  // ---------- Q – prázdné a zkopírované texty ----------
  rule("Q03", "Stejný text zkopírovaný do více otázek (podobnost nad 90 %)", "B12",
    undefined, { texts: TEXTS, maxPairSimilarity: 0.9 }),
  rule("Q05", "Výplňová odpověď místo textu („-“, „.“, „x“, „viz výše“, jen číslo…)", "B12",
    undefined, all(...TEXTS.map((q) => ({ q, notFiller: true })))),

  // ---------- P – štítek vs. dotazník ----------
  rule("P02", "Štítek „nebyl zde pracovník“, ale dotazník říká, že pracovník na místě byl", "A1",
    has("Tags", "nebyl zde pracovnik"), not(code("A1", "o0", "o2"))),
];
