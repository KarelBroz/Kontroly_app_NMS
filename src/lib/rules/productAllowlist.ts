import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode } from "./matchQuestion";

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Odstraní diakritiku a sjednotí na malá písmena — pro tolerantní porovnání názvů artiklů. */
function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS_RE, "");
}

/** Normalizace pro porovnání: bez diakritiky/velikosti písmen/interpunkce, slova seřazená — slovosled nehraje roli. */
function normalizeProductName(s: string): string {
  return foldDiacritics(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
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

/** True, pokud candidate odpovídá NĚKTERÉMU z povolených artiklů — tolerantně (slovosled, velikost písmen, drobný překlep). */
function fuzzyMatches(candidate: string, allowed: string[]): boolean {
  const normCandidate = normalizeProductName(candidate);
  if (!normCandidate) return false;
  for (const item of allowed) {
    const normItem = normalizeProductName(item);
    if (!normItem) continue;
    if (normCandidate === normItem) return true;
    const maxLen = Math.max(normCandidate.length, normItem.length);
    const threshold = Math.max(2, Math.round(maxLen * 0.15));
    if (levenshtein(normCandidate, normItem) <= threshold) return true;
  }
  return false;
}

/**
 * config = { questionCode: string, allowedProducts: string[] }
 * Odpověď musí odpovídat některé položce seznamu (case-insensitive,
 * bez ohledu na slovosled, s tolerancí na drobný překlep). Odpověď se
 * navíc rozdělí na jednotlivé položky podle čárky/středníku (pro případ,
 * že shopper napsal víc věcí najednou) — každá musí projít zvlášť.
 */
export const checkProductAllowlist: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const allowedProducts = Array.isArray(ruleConfig.allowedProducts) ? (ruleConfig.allowedProducts as string[]) : [];
  if (!questionCode || allowedProducts.length === 0) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  if (value === undefined || value === null || String(value).trim() === "") return [];

  const raw = String(value).trim();
  const parts = raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const itemsToCheck = parts.length > 0 ? parts : [raw];

  const invalid = itemsToCheck.filter((item) => !fuzzyMatches(item, allowedProducts));

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
