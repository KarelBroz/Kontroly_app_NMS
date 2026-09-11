import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";
import { findAnswerByQuestionCode, stripAnswerOptionPrefix } from "./matchQuestion";

/**
 * config = { questionCode: string, detailQuestionCode: string } + PRÁVĚ JEDNA z:
 *   - notEqualsValue: string — vyžaduje detailQuestionCode, když se odpověď NEROVNÁ
 *     (typicky "Ano" — "pokud ne, vysvětlete situaci").
 *   - equalsValue: string — vyžaduje detailQuestionCode, když se odpověď PŘESNĚ ROVNÁ
 *     (typicky "Jiné_"/"Jiné" — dvouúrovňové otázky typu "upřesněte" -> "jiné, vypište").
 *   - containsValue: string — vyžaduje detailQuestionCode, když odpověď OBSAHUJE
 *     zadaný text (pro _MULTIPLE otázky, kde odpověď je seznam kódů oddělený
 *     čárkou, např. "o2,o8" — nejde použít equalsValue, protože vybraných
 *     možností může být víc najednou).
 * Prázdnou hlavní otázku řeší samostatné pravidlo "Povinné pole" — tady by
 * se jen duplikoval nález.
 */
export const checkConditionalRequired: RuleChecker = ({ visitData, ruleConfig }) => {
  const questionCode = typeof ruleConfig.questionCode === "string" ? ruleConfig.questionCode.trim() : "";
  const notEqualsValue = typeof ruleConfig.notEqualsValue === "string" ? ruleConfig.notEqualsValue.trim() : "";
  const equalsValue = typeof ruleConfig.equalsValue === "string" ? ruleConfig.equalsValue.trim() : "";
  const containsValue = typeof ruleConfig.containsValue === "string" ? ruleConfig.containsValue.trim() : "";
  const detailQuestionCode =
    typeof ruleConfig.detailQuestionCode === "string" ? ruleConfig.detailQuestionCode.trim() : "";
  if (!questionCode || !detailQuestionCode || (!notEqualsValue && !equalsValue && !containsValue)) return [];

  const value = findAnswerByQuestionCode(visitData, questionCode);
  if (value === undefined || value === null || String(value).trim() === "") return [];

  const normalized = stripAnswerOptionPrefix(String(value).trim());

  let triggered: boolean;
  let triggerDescription: string;
  if (equalsValue) {
    triggered = normalized.toLowerCase() === equalsValue.toLowerCase();
    triggerDescription = `je "${equalsValue}"`;
  } else if (containsValue) {
    triggered = normalized.toLowerCase().includes(containsValue.toLowerCase());
    triggerDescription = `obsahuje "${containsValue}"`;
  } else {
    triggered = normalized.toLowerCase() !== notEqualsValue.toLowerCase();
    triggerDescription = `není "${notEqualsValue}"`;
  }
  if (!triggered) return [];

  const detailValue = findAnswerByQuestionCode(visitData, detailQuestionCode);
  const detailEmpty = detailValue === undefined || detailValue === null || String(detailValue).trim() === "";

  const results: RuleCheckResult[] = [];
  if (detailEmpty) {
    results.push({
      severity: FindingSeverity.HIGH,
      message: `Odpověď na otázku "${questionCode}" ("${normalized}") ${triggerDescription}, ale doplňující otázka "${detailQuestionCode}" je prázdná.`,
      details: { questionCode, value: normalized, notEqualsValue: notEqualsValue || undefined, equalsValue: equalsValue || undefined, containsValue: containsValue || undefined, detailQuestionCode },
    });
  }
  return results;
};
