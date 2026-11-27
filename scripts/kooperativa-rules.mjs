// Pravidla kontroly dat — MS Kooperativa (CZ26222), od 27. 11. 2026.
//
// Čtyři scénáře se stejným základem: Cestovní pojištění, Povinné ručení,
// Pojištění domácnosti, Servis (servis má víc variant, pořád je to servis).
// Každý scénář = šablona + scénář ve vlně. Vedle těchto pravidel v appce
// vždy běží i vestavěná kontrola pravopisu a data návštěvy.
//
// Klasická pravidla (ne CONDITION) mají všechny scénáře stejná:
//   X20 — délka návštěvy 5–45 min, F10 — povolená odpověď „Ne“, D10t — povinné.
//
// Předpoklady k ověření na prvních datech (dotazník nebyl k dispozici):
//   XX  — sloupec „XX: …“ se scénářem návštěvy (text nebo „oN: text“)
//   E10 — uzavřená otázka Ano/Ne; zmínka o QR se hledá v jejích textech E10t / E10tt / E10j
//   X40 — jméno poradce

const H = "HIGH";
const M = "MEDIUM";

// --- stavebnice podmínek (viz src/lib/rules/conditionCheck.ts) ---
const filled = (q) => ({ q, is: "filled" });
const has = (q, ...keywords) => ({ q, containsAny: keywords });
const any = (...c) => ({ any: c });
const not = (c) => ({ not: c });

const rule = (code, description, severity, questionCode, when, require) => ({
  code, description, severity, questionCode, when, require,
});

// Klíčová slova druhů pojištění (bez diakritiky, stačí část slova).
// Slouží k hlášení D10: v textech se mluví o jiném pojištění, než je scénář.
const INSURANCE_KEYWORDS = {
  cestovni: ["cestovn", "lecebne vylohy", "lecebnych vyloh", "storno zajezd", "pojisteni zavazadel"],
  ruceni: ["ruceni", "povinnak", "havarijn", "zelenou kartu", "zelena karta", "pojisteni auta", "pojisteni vozidla"],
  domacnost: ["domacnost", "nemovitost", "pojisteni bytu", "pojisteni domu", "pojisteni majetku"],
  zivotni: ["zivotni pojisteni", "zivotniho pojisteni", "zivotnim pojisteni", "zivotko", "zivotka", "urazov"],
};

// Sloupce, ve kterých se jiné pojištění nehledá (název scénáře, jméno poradce).
const MENTION_EXCEPT = ["XX", "X40"];

/** Pravidla jednoho scénáře. `own` = klíče z INSURANCE_KEYWORDS, které ke scénáři patří. */
function scenarioRules({ label, scenarioKeywords, own }) {
  const otherKeywords = Object.entries(INSURANCE_KEYWORDS)
    .filter(([key]) => !own.includes(key))
    .flatMap(([, keywords]) => keywords);

  const rules = [
    rule("XX", `Scénář návštěvy (XX) neodpovídá kontrolovanému scénáři „${label}“`, H, "XX",
      undefined, has("XX", ...scenarioKeywords)),
    rule("X40", "Jméno poradce (X40) ve tvaru „Jméno Příjmení“ – bez titulu, velká písmena, jméno první", H, "X40",
      filled("X40"), { q: "X40", personName: true }),
    rule("E10", "V textu E10 je zmínka o QR kódu, ale E10 není „Ano“", H, "E10",
      any(has("E10t", "qr"), has("E10tt", "qr"), has("E10j", "qr")),
      { q: "E10", matches: "^(o\\d+\\s*:\\s*)?ano\\b", label: "odpověď „Ano“" }),
  ];

  // Servis se může týkat jakékoli smlouvy — hlídání jiného druhu pojištění
  // u něj zatím neběží (viz poznámka v souhrnu).
  if (otherKeywords.length > 0 && own.length > 0) {
    rules.push(
      rule("D10", `V textech se mluví o jiném pojištění než „${label}“ – zkontrolovat ručně`, M, "D10",
        undefined, not({ textsMention: otherKeywords, except: MENTION_EXCEPT }))
    );
  }
  return rules;
}

export const SCENARIOS = [
  {
    template: "Cestovní pojištění 2026",
    label: "Cestovní pojištění",
    scenarioKeywords: ["cestovn"],
    own: ["cestovni"],
  },
  {
    template: "Povinné ručení 2026",
    label: "Povinné ručení",
    scenarioKeywords: ["ruceni", "povinn"],
    own: ["ruceni"],
  },
  {
    template: "Pojištění domácnosti 2026",
    label: "Pojištění domácnosti",
    scenarioKeywords: ["domacnost"],
    own: ["domacnost"],
  },
  {
    template: "Servis 2026",
    label: "Servis",
    scenarioKeywords: ["servis"],
    own: [],
  },
].map((s) => ({ ...s, rules: scenarioRules(s) }));

// Klasická pravidla, která mají všechny scénáře (kopírují se do nových).
export const CLASSIC_RULES = [
  { type: "NUMERIC_RANGE", name: "X20 — Číselný rozsah", config: { questionCode: "X20", min: 5, max: 45 } },
  { type: "ALLOWED_VALUES", name: "F10 — Povolené hodnoty", config: { questionCode: "F10", allowedValues: ["Ne"] } },
  { type: "REQUIRED", name: "D10t — Povinné pole", config: { questionCode: "D10t" } },
];
