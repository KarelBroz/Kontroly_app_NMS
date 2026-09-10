import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode } from "./matchQuestion";

/** config = { questionCode: string, allowedValues: string[] } */
export const checkAllowedValues: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const allowedValues = Array.isArray(ruleConfig.allowedValues) ? (ruleConfig.allowedValues as string[]) : [];
  if (!questionCode || allowedValues.length === 0) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  // prázdnou hodnotu řeší samostatné pravidlo "Povinné pole" — tady bychom jen duplikovali nález
  if (value === undefined || value === null || String(value).trim() === "") return [];

  const normalized = String(value).trim();
  const isAllowed = allowedValues.some((allowed) => allowed.trim().toLowerCase() === normalized.toLowerCase());

  const results: RuleCheckResult[] = [];
  if (!isAllowed) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" ("${normalized}") není mezi povolenými hodnotami (${allowedValues.join(", ")}).`,
      details: { questionCode, value: normalized, allowedValues },
    });
  }
  return results;
};
