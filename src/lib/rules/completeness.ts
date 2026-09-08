import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";

/**
 * config = { requiredFields: string[] }
 * Kontroluje, že požadovaná pole nejsou prázdná/null/undefined.
 */
export const checkCompleteness: RuleChecker = ({ visitData, ruleConfig }) => {
  const requiredFields = Array.isArray(ruleConfig.requiredFields)
    ? (ruleConfig.requiredFields as string[])
    : [];

  const results: RuleCheckResult[] = [];
  for (const field of requiredFields) {
    const value = visitData[field];
    const isEmpty = value === null || value === undefined || value === "";
    if (isEmpty) {
      results.push({
        severity: FindingSeverity.HIGH,
        message: `Povinné pole "${field}" je prázdné.`,
        details: { field },
      });
    }
  }
  return results;
};
