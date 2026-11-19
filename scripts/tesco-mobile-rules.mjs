// Pravidla kontroly dat — Tesco Mobile MS (dotazník listopad 2026 v2).
// Zdroj: "Tesco Mobile – pravidla pro kontrolu dat.xlsx" (47 pravidel,
// skupiny F/R/L/O/Q/P). Každé pravidlo = jedno pravidlo typu CONDITION
// (src/lib/rules/conditionCheck.ts). Chyba = HIGH, Varování = MEDIUM.
// Pravidla se smíšenou závažností jsou rozdělená (F03a/b/c, F04a/b, …).
//
// Zatím NEZAVEDENO (chybí podklady nebo to appka neumí):
//   F01 — formát okna v Labelu (potřeba ukázka exportu)
//   F07 — rozpis směn (ruční kontrola)
//   L08 — přepočet skóre (chybí list "Výpočet skóre" + otázka na B10)
//   Q04 — duplicity mezi návštěvami jednoho MS (appka kontroluje návštěvy jednotlivě)
//   Q06 — pravopis řeší vestavěná kontrola překlepů pro všechny projekty

const H = "HIGH";
const M = "MEDIUM";

// --- stavebnice podmínek ---
const filled = (q) => ({ q, is: "filled" });
const empty = (q) => ({ q, is: "empty" });
const code = (q, ...codes) => ({ q, codeIn: codes });
const includes = (q, ...codes) => ({ q, codesInclude: codes });
const has = (q, ...keywords) => ({ q, containsAny: keywords });
const all = (...c) => ({ all: c });
const any = (...c) => ({ any: c });
const not = (c) => ({ not: c });
const iff = (a, b) => ({ iff: [a, b] });

// otevřené (textové) otázky dotazníku
const TEXTS = ["X1", "X6", "A1t", "A3", "A4t", "A5", "B3j", "B4tt", "B5t", "B9t", "B12", "D1t", "D2t", "D3t", "D4t", "D5", "D6t", "D7t"];

// minimální délky textů (Q01) — prahy odhadem od kolegy, klidně upravit
const MIN_LENGTH = {
  A5: 20,
  D1t: 80, D2t: 80, D3t: 80, D4t: 80, D6t: 80,
  B12: 300,
  A1t: 30, A3: 30, A4t: 30, B5t: 30, B9t: 30, D5: 30, D7t: 30,
};

const DEAL_KEYWORDS = ["na miste", "sjedn", "uzavr", "podeps", "hned", "preved"];
const NEGATIVE_KEYWORDS = ["neprijemn", "nezajem", "nevenoval", "chybn"];
const PRICE_KEYWORDS = ["cena", "drah", "levn", "nepotrebuji", "tarif je"];
const WORKER_KEYWORDS = ["pracovn", "prodavac", "prodejc", "obsluh", "zamestnan", "porad", "konzultant"];

// konec vlny Listopad 2026 — u další vlny upravit (F03b/F03c)
const WAVE_END = "2026-11-20T23:59";
const WAVE_END_UNOFFICIAL = "2026-11-27T23:59";

const rule = (code, description, severity, questionCode, when, require) => ({
  code, description, severity, questionCode, when, require,
});

export const RULES = [
  // ---------- F – formální údaje ----------
  rule("F02", "Datum a čas návštěvy musí odpovídat RealDate (stejný den, max. 30 min)", H, "X2",
    all(filled("X2"), filled("RealDate")),
    { q: "X2", dateTimeNear: { of: "RealDate", maxMinutes: 30, sameDay: true } }),
  rule("F03a", "Návštěva nesmí být v budoucnosti", H, "X2",
    filled("X2"), { q: "X2", dateTimeOnOrBefore: "now" }),
  rule("F03b", "Návštěva po oficiálním konci vlny (20. 11.)", M, "X2",
    filled("X2"), { q: "X2", dateTimeOnOrBefore: WAVE_END }),
  rule("F03c", "Návštěva po neoficiálním konci vlny (27. 11.)", H, "X2",
    filled("X2"), { q: "X2", dateTimeOnOrBefore: WAVE_END_UNOFFICIAL }),
  rule("F04a", "Délka rozhovoru zapsaná v hodinách místo minut", H, "X5",
    filled("X5"), { q: "X5", durationMinutes: { max: 59 } }),
  rule("F04b", "Délka rozhovoru mimo rozumné rozpětí 2–40 min", M, "X5",
    all(filled("X5"), { q: "X5", durationMinutes: { max: 59 } }), { q: "X5", durationMinutes: { min: 2, max: 40 } }),
  rule("F05", "Bez kontaktu s pracovníkem nemá být délka rozhovoru", H, "X5",
    code("A1", "o10", "o12"), any(empty("X5"), { q: "X5", durationMinutes: { max: 0 } })),
  rule("F06", "Lokalita (X1) odpovídá navštívené prodejně (Name / Address)", M, "X1",
    filled("X1"), { q: "X1", sharesWordWith: ["Name", "Address"] }),

  // ---------- R – routování ----------
  rule("R01", "Když pracovník nebyl na místě (A1 = o10/o12), zbytek dotazníku je prázdný a A1t vyplněné", H, "A1",
    code("A1", "o10", "o12"), all({ range: ["A2", "D7t"], is: "empty" }, filled("A1t"))),
  rule("R02", "Popis situace (A1t) jen tehdy, když ke kontaktu nedošlo", H, "A1t",
    code("A1", "o0", "o2"), empty("A1t")),
  rule("R03", "Čemu se pracovník věnoval (A3) – jen když ho MS musel oslovit (A2 = o2)", H, "A3",
    undefined, iff(code("A2", "o2"), filled("A3"))),
  rule("R04", "Co pracovník dělal (A4t) – jen u nezájmu (A4 = o4)", H, "A4t",
    undefined, iff(code("A4", "o4"), filled("A4t"))),
  rule("R05", "Jiné benefity (B3j) vypsané, když je v B3tt zvoleno Jiné (o12)", H, "B3j",
    undefined, iff(includes("B3tt", "o12"), filled("B3j"))),
  rule("R06", "Žádné benefity (o14) se nekombinují s jinými", H, "B3tt",
    includes("B3tt", "o14"), { q: "B3tt", codeCount: { max: 1 } }),
  rule("R07a", "Pomůcky (B4t) vyplněné právě když B4 = Ano (o0)", H, "B4t",
    undefined, iff(code("B4", "o0"), filled("B4t"))),
  rule("R07b", "B4 = Ne (o2) → B4t a B4tt prázdné", H, "B4",
    code("B4", "o2"), all(empty("B4t"), empty("B4tt"))),
  rule("R07c", "Jiné pomůcky (B4tt) vyplněné právě když B4t obsahuje o10", H, "B4tt",
    undefined, iff(includes("B4t", "o10"), filled("B4tt"))),
  rule("R08", "Popis aplikace (B5t) jen u B5 = Ano (o0)", H, "B5t",
    undefined, iff(code("B5", "o0"), filled("B5t"))),
  rule("R09a", "Text o síti (B9t) vyplněný, když ji pracovník zmínil (B9 = o0/o2/o4)", H, "B9t",
    code("B9", "o0", "o2", "o4"), filled("B9t")),
  rule("R09b", "B9 = o6, ale B9t je vyplněné (text může odporovat kódu)", M, "B9t",
    code("B9", "o6"), empty("B9t")),
  rule("R10", "Co by měl pracovník udělat jinak (D5) – jen u Váhal/Ne (D4 = o2/o4)", H, "D5",
    undefined, iff(code("D4", "o2", "o4"), filled("D5"))),
  rule("R11", "Co MS odradilo (D7t) – jen když něco zaznělo (D7 = o2/o4)", H, "D7t",
    undefined, iff(code("D7", "o2", "o4"), filled("D7t"))),
  rule("R12", "Povinné texty při kontaktu (A1 = o0/o2)", H, "A1",
    code("A1", "o0", "o2"), all(...["X6", "A5", "B12", "D1t", "D2t", "D3t", "D4t", "D6t"].map(filled))),
  rule("R13", "Vyřazené kódy se nesmí objevit (A1 o4/o6/o8, B4t o4)", H, "A1",
    undefined, all(not(code("A1", "o4", "o6", "o8")), not(includes("B4t", "o4")))),

  // ---------- L – vazby mezi uzavřenými otázkami ----------
  rule("L01a", "Přítomnost pracovníka: A1 = o0/o2/o12 → X4 = o0", H, "X4",
    code("A1", "o0", "o2", "o12"), code("X4", "o0")),
  rule("L01b", "Přítomnost pracovníka: A1 = o10 → X4 = o2", H, "X4",
    code("A1", "o10"), code("X4", "o2")),
  rule("L02", "Aktivní oslovení (A2 = o0) vylučuje nezájem pracovníka (A4 = o4)", H, "A2",
    undefined, not(all(code("A2", "o0"), code("A4", "o4")))),
  rule("L03a", "Relevantní benefit (B3t = o0) vs. žádné benefity (B3tt = o14)", H, "B3t",
    undefined, not(all(code("B3t", "o0"), includes("B3tt", "o14")))),
  rule("L03b", "B3t = o2, ale B3tt má 3 a více benefitů", M, "B3t",
    code("B3t", "o2"), { q: "B3tt", codeCount: { max: 2 } }),
  rule("L04", "Ukázka aplikace (B5 = o0) bez pomůcky (B4 = o2) – ověřit, jestli neukazoval na telefonu MS", M, "B5",
    undefined, not(all(code("B5", "o0"), code("B4", "o2")))),
  rule("L05", "Letáček jako pomůcka (B4t o6) vs. nepředané materiály (B10 = o2) – ukazoval, nebo předal?", M, "B4t",
    undefined, not(all(includes("B4t", "o6"), code("B10", "o2")))),
  rule("L06a", "Koupě (D4 = o0), ale některé z D1–D3 = o4", M, "D4",
    code("D4", "o0"), not(any(code("D1", "o4"), code("D2", "o4"), code("D3", "o4")))),
  rule("L06b", "Bez koupě (D4 = o4), ale D1–D3 všechny o0", M, "D4",
    code("D4", "o4"), not(all(code("D1", "o0"), code("D2", "o0"), code("D3", "o0")))),
  rule("L07", "Znalost produktu (D2 = o0) vs. odrazující informace (D7 = o2/o4)", M, "D2",
    undefined, not(all(code("D2", "o0"), code("D7", "o2", "o4")))),

  // ---------- O – kód proti textu ----------
  rule("O01a", "Ukázka aplikace (B5 = o0) je popsaná v B5t nebo B12", M, "B5",
    code("B5", "o0"), any(has("B5t", "aplikac", "appk"), has("B12", "aplikac", "appk"))),
  rule("O01b", "B5 = o2, ale B12 popisuje ukázku aplikace", M, "B5",
    code("B5", "o2"), not(all(has("B12", "aplikac", "appk"), has("B12", "ukazal", "predvedl")))),
  rule("O02", "Tah na branku (D3 = o0) = nabídka sjednání na místě v D3t nebo B12, jinak má být o2", M, "D3",
    code("D3", "o0"), any(has("D3t", ...DEAL_KEYWORDS), has("B12", ...DEAL_KEYWORDS))),
  rule("O03a", "B9 = o0 → B9t zmiňuje O2 i 5G", M, "B9",
    code("B9", "o0"), all(has("B9t", "o2"), has("B9t", "5g"))),
  rule("O03b", "B9 = o2 → B9t zmiňuje jen O2", M, "B9",
    code("B9", "o2"), all(has("B9t", "o2"), not(has("B9t", "5g")))),
  rule("O03c", "B9 = o4 → B9t zmiňuje jen 5G", M, "B9",
    code("B9", "o4"), all(has("B9t", "5g"), not(has("B9t", "o2")))),
  rule("O03d", "B9t popisuje dotaz MS („zeptal“, „na můj dotaz“) → mělo být B9 = o6", M, "B9",
    has("B9t", "zeptal", "na muj dotaz"), code("B9", "o6")),
  rule("O04", "B12 obsahuje konkrétní nabídku (objem v GB, cenu) a spotřebu MS", M, "B12",
    filled("B12"),
    all(
      { q: "B12", matches: "\\d+\\s*GB", label: "objem dat v GB" },
      { q: "B12", matches: "\\d+\\s*(Kč|kc|korun|,-)", label: "cenu v Kč" },
      has("B12", "spotreb", "vyuziv", "pouziv", "provol", "protoc")
    )),
  rule("O05", "Zjišťování potřeb (B2 = o0) je vidět v B12", M, "B2",
    code("B2", "o0"), has("B12", "ptal", "zeptal", "kolik dat", "spotreb", "vyuziv")),
  rule("O06a", "Požadavek MS (A5) odpovídá scénáři (data / GB / tarif / internet)", M, "A5",
    filled("A5"), has("A5", "dat", "gb", "tarif", "internet")),
  rule("O06b", "A5 mimo scénář (dítě / služební / firemní) – nahlásit koordinátorovi, A5 nepřepisovat", M, "A5",
    undefined, not(has("A5", "dite", "ditet", "sluzebn", "firem"))),
  rule("O07", "MS sám ovlivnil průběh rozhovoru – nahlásit koordinátorovi", M, "B12",
    undefined, all(...["B12", "D1t", "D2t", "D3t", "D4t"].map((q) => not(has(q, "tvaril", "spechal", "nemam cas", "nemam zajem"))))),
  rule("O08", "Škála v části D (o0) vs. negativní tón textu", M, "D1",
    undefined, all(...["D1", "D2", "D3"].map((q) => not(all(code(q, "o0"), has(`${q}t`, ...NEGATIVE_KEYWORDS)))))),
  rule("O09", "D-texty hodnotí pracovníka, ne produkt nebo cenu", M, "D1t",
    undefined, all(...["D1t", "D2t", "D3t", "D4t"].map((q) => not(all(has(q, ...PRICE_KEYWORDS), not(has(q, ...WORKER_KEYWORDS))))))),
  rule("O10a", "A1 = o12 → A1t zmiňuje ceduli", M, "A1t",
    code("A1", "o12"), has("A1t", "cedul")),
  rule("O10b", "A1 = o10 → A1t ceduli nezmiňuje", M, "A1t",
    code("A1", "o10"), not(has("A1t", "cedul"))),
  rule("O10c", "Popis nepřítomnosti (A1t) uvádí dobu čekání", M, "A1t",
    all(code("A1", "o10", "o12"), filled("A1t")), { q: "A1t", matches: "\\d+\\s*(min|minut)", label: "dobu čekání v minutách" }),

  // ---------- Q – kvalita textu ----------
  rule("Q01", "Minimální délka otevřených odpovědí", M, "B12",
    undefined, all(...Object.entries(MIN_LENGTH).map(([q, n]) => ({ q, minLength: n })))),
  rule("Q02", "Text jen opakuje znění zvolené odpovědi (podobnost > 70 %)", M, "D1t",
    undefined, all(...["D1", "D2", "D3", "D4"].map((q) => ({ q: `${q}t`, notSimilarToAnswerOf: q, max: 0.7 })))),
  rule("Q03", "Stejný text u více otázek jedné návštěvy (podobnost > 80 %)", M, "B12",
    undefined, { texts: TEXTS, maxPairSimilarity: 0.8 }),
  rule("Q05", "Výplňové odpovědi („-“, „.“, „x“, „nevím“, „viz výše“, „ok“, jen číslo)", H, "B12",
    undefined, all(...TEXTS.map((q) => ({ q, notFiller: true })))),
  rule("Q07", "Hovorové výrazy a slang (data jdou přímo klientovi) – navrhnout úpravu", M, "B12",
    undefined, all(...TEXTS.map((q) => not(has(q, "appka", "appku", "appce", "appky", "lacinejsi"))))),

  // ---------- P – procesní ----------
  rule("P01", "Odevzdaná návštěva bez uzavřené kontroly", M, undefined,
    { q: "InspectionIsComplete", equals: ["1", "true"] }, { q: "ControlIsComplete", equals: ["1", "true"] }),
  rule("P02", "Tag „nebyl zde pracovník“ sedí s dotazníkem (A1 = o10/o12 nebo Failed = 1)", M, "A1",
    has("Tags", "nebyl zde pracovnik"), any(code("A1", "o10", "o12"), { q: "Failed", equals: ["1", "true"] })),
];
