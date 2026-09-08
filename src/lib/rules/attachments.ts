import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";

/**
 * config = { requiredAttachmentFields: string[] }
 * Ověřuje, že pole s přílohami (odkaz/název souboru fotky, audia...) nejsou prázdná.
 */
export const checkAttachments: RuleChecker = ({ visitData, ruleConfig }) => {
  const requiredFields = Array.isArray(ruleConfig.requiredAttachmentFields)
    ? (ruleConfig.requiredAttachmentFields as string[])
    : [];

  const results: RuleCheckResult[] = [];
  for (const field of requiredFields) {
    const value = visitData[field];
    const isEmpty = value === null || value === undefined || value === "";
    if (isEmpty) {
      results.push({
        severity: FindingSeverity.HIGH,
        message: `Chybí požadovaná příloha "${field}".`,
        details: { field },
      });
    }
  }
  return results;
};
