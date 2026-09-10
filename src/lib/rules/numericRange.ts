import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode } from "./matchQuestion";

/** config = { questionCode: string, min?: number, max?: number } */
export const checkNumericRange: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const min = typeof ruleConfig.min === "number" ? ruleConfig.min : undefined;
  const max = typeof ruleConfig.max === "number" ? ruleConfig.max : undefined;
  if (!questionCode || (min === undefined && max === undefined)) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  if (value === undefined || value === null || String(value).trim() === "") return [];

  const numeric = Number(String(value).trim().replace(",", "."));
  const results: RuleCheckResult[] = [];

  if (Number.isNaN(numeric)) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" ("${value}") není číslo.`,
      details: { questionCode, value },
    });
    return results;
  }

  const outOfRange = (min !== undefined && numeric < min) || (max !== undefined && numeric > max);
  if (outOfRange) {
    const rangeLabel = `${min ?? "…"}–${max ?? "…"}`;
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" (${numeric}) je mimo povolený rozsah ${rangeLabel}.`,
      details: { questionCode, value: numeric, min, max },
    });
  }
  return results;
};
