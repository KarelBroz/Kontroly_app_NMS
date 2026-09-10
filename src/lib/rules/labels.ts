import { RuleType } from "@prisma/client";

/** Popisky pro RuleType — sdílené mezi formulářem na tvorbu pravidla a přehledem nálezů. */
export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  [RuleType.REQUIRED]: "Povinné pole",
  [RuleType.ALLOWED_VALUES]: "Povolené hodnoty",
  [RuleType.NUMERIC_RANGE]: "Číselný rozsah",
};

/** Popisky pro automatické systémové kontroly (běží vždy, bez ruční konfigurace). */
export const SYSTEM_CHECK_LABELS: Record<string, string> = {
  REAL_DATE_WINDOW: "Datum návštěvy",
  GRAMMAR: "Překlep / pravopis",
};
