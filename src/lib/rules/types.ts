import { FindingSeverity } from "@prisma/client";

export interface ScenarioData {
  expectedBranch?: string;
  windowStart?: string;
  windowEnd?: string;
  keyQuestions?: Array<{ question: string; expectedAnswer: string }>;
}

export interface RuleCheckInput {
  visitData: Record<string, unknown>;
  ruleConfig: Record<string, unknown>;
  scenario: ScenarioData | null;
}

export interface RuleCheckResult {
  severity: FindingSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export type RuleChecker = (input: RuleCheckInput) => RuleCheckResult[];
