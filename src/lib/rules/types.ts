import { FindingSeverity } from "@prisma/client";

// Scénář teď nese jen okno terénu ("Start terénu" / "Konec terénu").
// Zobrazovaná pobočka a klíčové otázky byly odstraněny — kontrola odpovědí
// se řeší přes pravidla navázaná na "Kód otázky" (viz matchQuestion.ts).
export interface ScenarioData {
  windowStart?: string;
  windowEnd?: string;
}

export interface RuleCheckInput {
  visitData: Record<string, unknown>;
  ruleConfig: Record<string, unknown>;
}

export interface RuleCheckResult {
  severity: FindingSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export type RuleChecker = (input: RuleCheckInput) => RuleCheckResult[];
