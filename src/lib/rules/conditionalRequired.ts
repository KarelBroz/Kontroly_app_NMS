import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode, stripAnswerOptionPrefix } from "./matchQuestion";

/**
 * config = { questionCode: string, notEqualsValue: string, detailQuestionCode: string }
 * Pokud odpověď na "Kód otázky" NENÍ (case-insensitive) rovna notEqualsValue
 * (typicky "Ano"), musí být vyplněná navazující doplňující otázka
 * (detailQuestionCode) — např. "pokud ne, vysvětlete situaci".
 * Prázdnou hlavní otázku řeší samostatné pravidlo "Povinné pole" — tady by
 * se jen duplikoval nález.
 */
export const checkConditionalRequired: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const notEqualsValue = typeof ruleConfig.notEqualsValue === "string" ? ruleConfig.notEqualsValue.trim() : "";
  const detailQuestionCode =
    typeof ruleConfig.detailQuestionCode === "string" ? ruleConfig.detailQuestionCode.trim() : "";
  if (!questionCode || !notEqualsValue || !detailQuestionCode) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  if (value === undefined || value === null || String(value).trim() === "") return [];

  const normalized = stripAnswerOptionPrefix(String(value).trim());
  if (normalized.toLowerCase() === notEqualsValue.toLowerCase()) return [];

  const detailValue = findAnswerByQuestionCode(visitData, detailQuestionCode);
  const detailEmpty = detailValue === undefined || detailValue === null || String(detailValue).trim() === "";

  const results: RuleCheckResult[] = [];
  if (detailEmpty) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" ("${normalized}") není "${notEqualsValue}", ale doplňující otázka "${detailQuestionCode}" je prázdná.`,
      details: { questionCode, value: normalized, notEqualsValue, detailQuestionCode },
    });
  }
  return results;
};
