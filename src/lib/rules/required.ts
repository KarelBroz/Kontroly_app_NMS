import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode } from "./matchQuestion";

/** config = { questionCode: string } — otázka nesmí být prázdná. */
export const checkRequired: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  if (!questionCode) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  const isEmpty = value === undefined || value === null || String(value).trim() === "";

  const results: RuleCheckResult[] = [];
  if (isEmpty) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Povinná otázka "${questionCode}" je prázdná.`,
      details: { questionCode },
    });
  }
  return results;
};
