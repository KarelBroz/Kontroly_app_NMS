// Pravidla kontroly dat — MS Raiffeisenbank (CZ26011), tři scénáře podle
// dotazníků rb_servis.xlsx, rb_akvizice.xlsx a rb_pokladny.xlsx.
//
// Vedle těchto pravidel v appce vždy běží vestavěná kontrola pravopisu
// a data návštěvy vs. okno terénu.
//
// Skupiny:
//   D — délka návštěvy (celkový čas, čekání, jestli shopperovi připadala dlouhá)
//   R — filtrování otázek podle definice (enable/disable u odpovědí)
//   L — jasné rozpory mezi odpověďmi
//   T — nesmyslné texty (výplň, zkopírovaný text)
// HIGH = jasná chyba, MEDIUM = podezřelé, ručně ověřit.

const H = "HIGH";
const M = "MEDIUM";

// --- stavebnice podmínek (viz src/lib/rules/conditionCheck.ts) ---
const filled = (q) => ({ q, is: "filled" });
const empty = (q) => ({ q, is: "empty" });
const code = (q, ...codes) => ({ q, codeIn: codes });
const includes = (q, ...codes) => ({ q, codesInclude: codes });
const all = (...c) => ({ all: c });
const any = (...c) => ({ any: c });
const not = (c) => ({ not: c });
const iff = (a, b) => ({ iff: [a, b] });
const num = (q, min, max) => ({ q, number: { min, max } });
const matches = (q, re, label) => ({ q, matches: re, label });

const rule = (code, description, severity, questionCode, when, require) => ({
  code, description, severity, questionCode, when, require,
});

// Hodnocení délky schůzky v X11 („Přišla Vám délka schůzky přiměřená? Proč?“).
// „přiměřená“ se počítá jen bez „ne“ na začátku (nepřiměřená = dlouhá/krátká).
const X11_TOO_LONG = "nepřiměřen|neprimeren|dlouh|zdlouhav|nekonečn|nekonecn|protahoval|natahoval";
const X11_FINE = "(^|[^a-zá-ž])(přiměřen|primeren|akorát|akorat|adekvátn|adekvatn|v pořádku|v poradku|odpovídal|odpovidal)";
const X11_TOO_SHORT = "krátk|kratk|rychle odbyt|odbyl|spěch|spech|uspěchan|uspechan";

// ---------- společné pro servis a akvizici (dotazníky mají stejný základ) ----------
function branchRules({ scenarioCode, scenarioLabel, minMinutes, maxMinutes }) {
  return [
    // D — délka návštěvy
    rule("D01", "Celkový čas na pobočce (X03) není číslo v minutách nebo je nesmyslný (1–240)", H, "X03",
      undefined, num("X03", 1, 240)),
    rule("D02", `Celkový čas na pobočce (X03) je mimo obvyklých ${minMinutes}–${maxMinutes} min – ověřit`, M, "X03",
      num("X03", 1, 240), num("X03", minMinutes, maxMinutes)),
    rule("D03", "Bankéř se ujal až po víc než 10 min (A30 = o8), ale celkový čas (X03) je do 10 min", H, "A30",
      all(code("A30", "o8"), num("X03", 0, 10000)), num("X03", 11)),
    rule("D04", "X11 neříká, jestli byla délka schůzky přiměřená, ani proč", M, "X11",
      undefined, all(filled("X11"), matches("X11", `${X11_TOO_LONG}|${X11_FINE}|${X11_TOO_SHORT}|(^|[^a-zá-ž])(ano|ne)([^a-zá-ž]|$)`, "hodnocení délky"))),
    rule("D05", "Shopperovi schůzka připadala dlouhá (X11), ale celkový čas (X03) je do 15 min – ověřit", M, "X11",
      all(matches("X11", X11_TOO_LONG), not(matches("X11", X11_FINE)), num("X03", 0, 10000)), num("X03", 16)),
    rule("D06", "Shopperovi schůzka připadala krátká/uspěchaná (X11), ale celkový čas (X03) je přes 60 min – ověřit", M, "X11",
      all(matches("X11", X11_TOO_SHORT), num("X03", 0, 10000)), num("X03", 0, 60)),
    rule("D07", "Shopper píše, že délka byla přiměřená (X11), ale celkový čas (X03) je přes 120 min – ověřit", M, "X11",
      all(matches("X11", X11_FINE), not(matches("X11", X11_TOO_LONG)), num("X03", 0, 10000)), num("X03", 0, 120)),

    // R — filtrování
    rule("R01", `Scénář návštěvy (X12) má být ${scenarioLabel}`, H, "X12",
      undefined, code("X12", scenarioCode)),
    rule("R02", "Důvod opakování (X05) patří jen k druhé/třetí návštěvě (X04 = o2/o4)", H, "X05",
      undefined, iff(code("X04", "o2", "o4"), filled("X05"))),
    rule("R03", "A42t (co ovlivnilo dojem z oblečení) patří jen k A42 = Ne", H, "A42t",
      undefined, iff(code("A42", "o2"), filled("A42t"))),
    rule("R04", "B402t (jiný produkt) patří jen k B402 = Jiné (o18)", H, "B402t",
      undefined, iff(includes("B402", "o18"), filled("B402t"))),
    rule("R05", "B402 = Žádný produkt (o17) se nekombinuje s jinými produkty", H, "B402",
      includes("B402", "o17"), { q: "B402", codeCount: { max: 1 } }),
    rule("R06", "B408t (účel úvěru) patří jen k B408 = Ano", H, "B408t",
      undefined, iff(code("B408", "o0"), filled("B408t"))),
    rule("R07", "B111 a B112 se hodnotí jen, když bankéř odhalil potřebu financování (B110 = Ano)", H, "B110",
      filled("B110"), iff(code("B110", "o0"), all(filled("B111"), filled("B112")))),

    // L — rozpory
    rule("L01", "Nikdo shoppera nezaregistroval (A300 = Ne), ale bankéř se ho ujal ihned (A30 = Ihned)", H, "A30",
      undefined, not(all(code("A300", "o2"), code("A30", "o0")))),
    rule("L02", "Rozhovor veden s recepcí (X09 = o8) – podle zadání se s recepcí nejedná, návštěva platná?", M, "X09",
      undefined, not(code("X09", "o8"))),
    rule("L03", "Bankéř podle D30 „určitě dobře postaral“, ale shopper se necítil chtěný (D100 = Ne) – ověřit", M, "D30",
      undefined, not(all(code("D30", "o0"), code("D100", "o2")))),
    rule("L04", "Podle D30 „určitě ne dobře postaráno“, ale shopper se cítil chtěný (D100) a chce s bankéřem jednat znovu (D110) – ověřit", M, "D30",
      undefined, not(all(code("D30", "o6"), code("D100", "o0"), code("D110", "o0")))),
  ];
}

const TEXT_RULES = (texts) => [
  rule("T01", "Výplňová odpověď místo textu („-“, „.“, „x“, „nevím“, „viz výše“, „ok“, jen číslo)", H, texts[0],
    undefined, all(...texts.map((q) => ({ q, notFiller: true })))),
  rule("T02", "Stejný text zkopírovaný do více otázek (podobnost nad 85 %)", H, texts[0],
    undefined, { texts, maxPairSimilarity: 0.85 }),
];

const SERVIS_TEXTS = ["X02", "X11", "X05", "a301t", "A42t", "A90", "A70", "A80", "B402t", "B220", "B230", "C60", "C70", "D120t", "D80"];
const AKVIZICE_TEXTS = ["X02", "X11", "X05", "a301t", "A42t", "A90", "A70", "A80", "B130a", "B360t", "B402t", "B220", "B230", "C80t", "C60", "C70", "D120t", "D20", "D70", "D80"];
const POKLADNY_TEXTS = ["X05", "X06", "A101", "A120t", "B110t", "B140"];

const SERVIS = [
  ...branchRules({ scenarioCode: "o2", scenarioLabel: "Servisní schůzka (o2)", minMinutes: 10, maxMinutes: 90 }),
  rule("R08", "Servis: chybí záminka návštěvy (X12t)", H, "X12t", undefined, filled("X12t")),
  rule("L05", "Bankéř nabízel další produkt (B601 = Ano), ale v B402 je „Žádný“", M, "B601",
    code("B601", "o0"), not(includes("B402", "o17"))),
  rule("L06", "Bankéř podle B601 další produkt nenabízel, ale v B402 jsou představené produkty", H, "B601",
    all(code("B601", "o2"), filled("B402")), includes("B402", "o17")),
  ...TEXT_RULES(SERVIS_TEXTS),
];

const AKVIZICE = [
  ...branchRules({ scenarioCode: "o0", scenarioLabel: "Akviziční schůzka (o0)", minMinutes: 15, maxMinutes: 120 }),
  rule("R08", "Akvizice: záminka (X12t) patří jen k servisu – má být prázdná", H, "X12t", undefined, empty("X12t")),
  rule("R09", "B170 (benefit kreditní karty) se hodnotí jen, když bankéř kartu nabídl (B160 = Ano)", H, "B170",
    filled("B160"), iff(code("B160", "o0"), filled("B170"))),
  rule("R10", "B360t (odhalený potenciál) patří jen k B360 = Ano", H, "B360t",
    undefined, iff(code("B360", "o0"), filled("B360t"))),
  rule("R11", "B130a (jiné pomůcky) patří jen k B130 = Jiné (o12)", H, "B130a",
    undefined, iff(includes("B130", "o12"), filled("B130a"))),
  rule("R12", "B130 = Žádnou jinou pomůcku (o10) se nekombinuje s pomůckami", H, "B130",
    includes("B130", "o10"), { q: "B130", codeCount: { max: 1 } }),
  rule("R13", "B504 = Nic z toho neproběhlo (o10) se nekombinuje s otevřenými tématy", H, "B504",
    includes("B504", "o10"), { q: "B504", codeCount: { max: 1 } }),
  rule("R14", "B601 a B602 se hodnotí jen, když se bankéř zmínil o doporučení (B600 = Ano)", H, "B600",
    filled("B600"), iff(code("B600", "o0"), all(filled("B601"), filled("B602")))),
  rule("R15", "C80t (navržené řešení) patří jen k C80 = Ano", H, "C80t",
    undefined, iff(code("C80", "o0"), filled("C80t"))),
  rule("R16", "C40t (komu předal kontakt) patří jen k předanému kontaktu (C40 ≠ Ne)", H, "C40t",
    filled("C40"), iff(not(code("C40", "o12")), filled("C40t"))),
  rule("R17", "C40t = Pouze na sebe (o0) se nekombinuje s dalšími kanály", H, "C40t",
    includes("C40t", "o0"), { q: "C40t", codeCount: { max: 1 } }),
  rule("L05", "Kreditní karta je v B402 (o6), ale podle B160 ji bankéř nenabídl", H, "B160",
    includes("B402", "o6"), not(code("B160", "o2"))),
  rule("L06", "Bankéř podle B160 nabídl kreditní kartu, ale v B402 chybí (o6) – ověřit", M, "B160",
    all(code("B160", "o0"), filled("B402")), includes("B402", "o6")),
  rule("L07", "Bankéř nabídl řešení nad rámec účtu (C80 = Ano), ale v B402 je „Žádný“ produkt", H, "C80",
    code("C80", "o0"), not(includes("B402", "o17"))),
  rule("L08", "Žádný prodejní tlak (B200 = o4), ale bankéř měl tah na branku (C90 = Ano) – ověřit", M, "B200",
    undefined, not(all(code("B200", "o4"), code("C90", "o0")))),
  ...TEXT_RULES(AKVIZICE_TEXTS),
];

const POKLADNY = [
  // D — délka návštěvy (X01 celkem, X02 čekání, A140 vyřízení u pokladny)
  rule("D01", "Celkový čas na pobočce (X01) není číslo v minutách nebo je nesmyslný (1–180)", H, "X01",
    undefined, num("X01", 1, 180)),
  rule("D02", "Celkový čas na pobočce (X01) přes 60 min – ověřit", M, "X01",
    num("X01", 1, 180), num("X01", 1, 60)),
  rule("D03", "Čekání na pokladnu (X02) není číslo v minutách", H, "X02",
    undefined, num("X02", 0, 180)),
  rule("D04", "Vyřízení u pokladny (A140) není číslo v minutách", H, "A140",
    undefined, num("A140", 0, 180)),
  rule("D05", "Čekání (X02) je delší než celý čas na pobočce (X01)", H, "X02",
    undefined, { q: "X02", atMostSumOf: ["X01"] }),
  rule("D06", "Vyřízení u pokladny (A140) je delší než celý čas na pobočce (X01)", H, "A140",
    undefined, { q: "A140", atMostSumOf: ["X01"] }),
  rule("D07", "Čekání (X02) + vyřízení (A140) je o víc než 5 min delší než celý čas na pobočce (X01)", M, "X01",
    undefined, { q: "X02", alsoAdd: ["A140"], atMostSumOf: ["X01"], plus: 5 }),
  rule("D08", "Před shopperem nikdo nečekal (X03 = 0), ale čekání (X02) trvalo přes 10 min – ověřit", M, "X02",
    all(num("X03", 0, 0), num("X02", 0, 10000)), num("X02", 0, 10)),

  // R — filtrování
  rule("R01", "Důvod opakování (X05) patří jen k druhé/třetí návštěvě (X04 = o2/o4)", H, "X05",
    undefined, iff(code("X04", "o2", "o4"), filled("X05"))),
  rule("R02", "A110 (kopie potvrzení) se hodnotí jen, když pokladník bankovku zadržel (A100 = o2)", H, "A110",
    filled("A100"), iff(code("A100", "o2"), filled("A110"))),
  rule("R03", "A120 (kam odkázal) se hodnotí jen, když pokladník odkázal jinam (A100 = o4)", H, "A120",
    filled("A100"), iff(code("A100", "o4"), filled("A120"))),
  rule("R04", "A120t (kam jinam) patří jen k A120 = Jinam (o6)", H, "A120t",
    undefined, iff(includes("A120", "o6"), filled("A120t"))),
  rule("R05", "Chybí popis průběhu jednání u pokladny (A101) – povinný i u „Jiné“", H, "A101",
    filled("A100"), filled("A101")),

  // L — rozpory
  rule("L01", "Pokladník byl spíše/určitě nevstřícný (B110), ale shopper se cítil jako vítaný zákazník (B130 = Ano) – ověřit", M, "B110",
    undefined, not(all(code("B110", "o4", "o6"), code("B130", "o0")))),
  rule("L02", "Pokladník byl určitě vstřícný (B110 = o0), ale shopper se necítil vítaný (B130 = Ne) – ověřit", M, "B110",
    undefined, not(all(code("B110", "o0"), code("B130", "o2")))),
  ...TEXT_RULES(POKLADNY_TEXTS),
];

export const SCENARIOS = [
  { template: "RB Servis", rules: SERVIS },
  { template: "RB Akvizice", rules: AKVIZICE },
  { template: "RB Pokladny", rules: POKLADNY },
];
