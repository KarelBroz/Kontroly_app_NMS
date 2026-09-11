import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode, stripAnswerOptionPrefix } from "./matchQuestion";

/**
 * config = { questionCode: string, threshold: number, booleanQuestionCode: string, valueAtOrBelow: string, valueAbove: string }
 * Číselná otázka (questionCode) porovnaná s prahem musí odpovídat navazující
 * ano/ne otázce (booleanQuestionCode): hodnota > threshold -> booleanQuestionCode
 * musí být valueAbove, hodnota <= threshold -> musí být valueAtOrBelow.
 * Typicky: "průměrná fronta 3,1+ zákazníků = fronta" -> otázka o frontě
 * (max. 3?) musí u hodnoty nad 3 odpovídat "Ne".
 */
export const checkNumericThresholdConsistency: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const booleanQuestionCode =
    typeof ruleConfig.booleanQuestionCode === "string" ? ruleConfig.booleanQuestionCode.trim() : "";
  const threshold = typeof ruleConfig.threshold === "number" ? ruleConfig.threshold : undefined;
  const valueAtOrBelow = typeof ruleConfig.valueAtOrBelow === "string" ? ruleConfig.valueAtOrBelow.trim() : "";
  const valueAbove = typeof ruleConfig.valueAbove === "string" ? ruleConfig.valueAbove.trim() : "";
  if (!questionCode || !booleanQuestionCode || threshold === undefined || !valueAtOrBelow || !valueAbove) return [];

  const numericRaw = findAnswerByQuestionCode(visitData, questionCode);
  if (numericRaw === undefined || numericRaw === null || String(numericRaw).trim() === "") return [];
  const numeric = Number(String(numericRaw).trim().replace(",", "."));
  if (Number.isNaN(numeric)) return []; // "není číslo" řeší samostatné pravidlo Číselný rozsah

  const boolRaw = findAnswerByQuestionCode(visitData, booleanQuestionCode);
  if (boolRaw === undefined || boolRaw === null || String(boolRaw).trim() === "") return [];
  const boolNormalized = stripAnswerOptionPrefix(String(boolRaw).trim());

  const expected = numeric > threshold ? valueAbove : valueAtOrBelow;

  const results: RuleCheckResult[] = [];
  if (boolNormalized.toLowerCase() !== expected.toLowerCase()) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" (${numeric}) neodpovídá otázce "${booleanQuestionCode}" ("${boolNormalized}") — od hodnoty nad ${threshold} by mělo být "${valueAbove}", jinak "${valueAtOrBelow}".`,
      details: { questionCode, value: numeric, threshold, booleanQuestionCode, boolValue: boolNormalized, expected },
    });
  }
  return results;
};
