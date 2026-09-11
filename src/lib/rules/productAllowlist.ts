import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode } from "./matchQuestion";

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Odstraní diakritiku a sjednotí na malá písmena — pro tolerantní porovnání názvů artiklů. */
function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS_RE, "");
}

/** Rozdělí na jednotlivá slova: bez diakritiky/velikosti písmen/interpunkce. */
function tokenize(s: string): string[] {
  return foldDiacritics(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Normalizace pro porovnání celého textu najednou: slova seřazená — slovosled nehraje roli. */
function normalizeProductName(s: string): string {
  return tokenize(s).sort().join(" ");
}

/** Klasická editační (Levenshteinova) vzdálenost — tolerance na drobné překlepy. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** True, pokud si dvě jednotlivá slova tolerantně odpovídají — drobný
 * překlep, jednotné/množné číslo, nebo zkratka/začátek slova (min. 3
 * znaky — např. "del"/"del." odpovídá "delicious"). */
function tokensFuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 3 && longer.startsWith(shorter)) return true;
  const threshold = a.length <= 4 || b.length <= 4 ? 1 : 2;
  return levenshtein(a, b) <= threshold;
}

/** `superset` doplněný o spojené sousední dvojice slov bez mezery (např.
 * "crimson"+"snow" -> "crimsonsnow") — pro případ, že shopper napíše dvě
 * slova názvu artiklu dohromady bez mezery. */
function withAdjacentPairs(tokens: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) pairs.push(tokens[i] + tokens[i + 1]);
  return tokens.concat(pairs);
}

/** True, pokud každé slovo z `subset` má tolerantní protějšek někde v `superset` (slovosled nehraje roli, i spojená slova bez mezery). */
function tokensAreSubsetOf(subset: string[], superset: string[]): boolean {
  if (subset.length === 0) return false;
  const candidates = withAdjacentPairs(superset);
  return subset.every((token) => candidates.some((candidate) => tokensFuzzyEqual(token, candidate)));
}

/**
 * True, pokud candidate odpovídá NĚKTERÉMU z povolených artiklů — tolerantně:
 * slovosled nehraje roli, malá/velká písmena ani diakritika nevadí, drobný
 * překlep je v pořádku. Navíc se toleruje i to, že candidate popisuje artikl
 * MÉNĚ přesně než seznam (chybí popisné slovo jako barva/velikost — např.
 * "Jablko Golden Delicious" odpovídá položce "Jablka zelená Golden
 * Delicious"), nebo naopak PŘESNĚJI (obsahuje slovo navíc, např. balení).
 * Toleruje i zkratky/začátky slov ("Golden Del." odpovídá "Golden
 * Delicious") a slova napsaná dohromady bez mezery ("CrimsonSnow"
 * odpovídá "Crimson Snow").
 */
function fuzzyMatches(candidate: string, allowed: string[]): boolean {
  const candTokens = tokenize(candidate);
  if (candTokens.length === 0) return false;
  const normCandidate = normalizeProductName(candidate);

  for (const item of allowed) {
    const itemTokens = tokenize(item);
    if (itemTokens.length === 0) continue;

    // 1) Celý text je (skoro) shodný — pokrývá drobné překlepy napříč celým názvem.
    const normItem = normalizeProductName(item);
    if (normCandidate === normItem) return true;
    const maxLen = Math.max(normCandidate.length, normItem.length);
    const threshold = Math.max(2, Math.round(maxLen * 0.15));
    if (levenshtein(normCandidate, normItem) <= threshold) return true;

    // 2) Odpověď je podmnožinou slov povoleného artiklu — chybí jen popisné
    // slovo (barva, "volná", velikost balení...), jádro názvu ale sedí.
    // Vyžadujeme aspoň 2 slova, ať jedno obecné slovo (např. samotné
    // "Jablka") neprojde jako shoda se vším.
    if (candTokens.length >= 2 && tokensAreSubsetOf(candTokens, itemTokens)) return true;

    // 3) Odpověď obsahuje navíc nějaké slovo (např. hmotnost balení) oproti
    // povolenému artiklu — název artiklu je celý obsažený v odpovědi.
    if (tokensAreSubsetOf(itemTokens, candTokens)) return true;
  }
  return false;
}

/**
 * config = { questionCode: string, allowedProducts: string[] }
 * Odpověď musí odpovídat některé položce seznamu (case-insensitive,
 * bez ohledu na slovosled, s tolerancí na drobný překlep). Pokud celá
 * odpověď neodpovídá žádné položce najednou, rozdělí se podle čárky/
 * středníku (pro případ, že shopper napsal víc věcí najednou) a každá
 * část se zkusí zvlášť — ale NEJDŘÍV se zkouší celý text vcelku, protože
 * některé názvy artiklů čárku přímo obsahují (např. "Kaiserka len,
 * sezam") a rozdělení by je nesprávně rozbilo na dvě neplatné položky.
 */
export const checkProductAllowlist: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const allowedProducts = Array.isArray(ruleConfig.allowedProducts) ? (ruleConfig.allowedProducts as string[]) : [];
  if (!questionCode || allowedProducts.length === 0) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  if (value === undefined || value === null || String(value).trim() === "") return [];

  const raw = String(value).trim();

  let invalid: string[] = [];
  if (!fuzzyMatches(raw, allowedProducts)) {
    const parts = raw
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const itemsToCheck = parts.length > 0 ? parts : [raw];
    invalid = itemsToCheck.filter((item) => !fuzzyMatches(item, allowedProducts));
  }

  const results: RuleCheckResult[] = [];
  if (invalid.length > 0) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" ("${raw}") obsahuje artikl mimo povolený seznam: ${invalid.join(", ")}.`,
      details: { questionCode, value: raw, invalid, allowedProducts },
    });
  }
  return results;
};
