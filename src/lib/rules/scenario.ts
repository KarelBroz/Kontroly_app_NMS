import { FindingSeverity } from "@prisma/client";
import type { RuleChecker, RuleCheckResult } from "./types";

/**
 * config = { branchField?: string, timeField?: string, questionFieldMap?: Record<string, string> }
 * Porovnává data návštěvy proti strukturovanému scénáři vlny (pobočka,
 * časové okno, klíčové otázky/odpovědi).
 */
export const checkScenario: RuleChecker = ({ visitData, ruleConfig, scenario }) => {
  const results: RuleCheckResult[] = [];
  if (!scenario) return results;

  const branchField = typeof ruleConfig.branchField === "string" ? ruleConfig.branchField : null;
  if (branchField && scenario.expectedBranch) {
    const actualBranch = visitData[branchField];
    if (String(actualBranch ?? "").trim() !== scenario.expectedBranch.trim()) {
      results.push({
        severity: FindingSeverity.MEDIUM,
        message: `Pobočka neodpovídá scénáři (očekáváno "${scenario.expectedBranch}", nalezeno "${
          actualBranch ?? "—"
        }").`,
        details: { field: branchField, expected: scenario.expectedBranch, actual: actualBranch },
      });
    }
  }

  const timeField = typeof ruleConfig.timeField === "string" ? ruleConfig.timeField : null;
  if (timeField && (scenario.windowStart || scenario.windowEnd)) {
    const rawValue = visitData[timeField];
    const visitTime = rawValue ? new Date(String(rawValue)) : null;
    if (visitTime && !Number.isNaN(visitTime.getTime())) {
      const start = scenario.windowStart ? new Date(scenario.windowStart) : null;
      const end = scenario.windowEnd ? new Date(scenario.windowEnd) : null;
      const outOfWindow = (start !== null && visitTime < start) || (end !== null && visitTime > end);
      if (outOfWindow) {
        results.push({
          severity: FindingSeverity.MEDIUM,
          message: "Návštěva proběhla mimo očekávané časové okno scénáře.",
          details: {
            field: timeField,
            value: rawValue,
            windowStart: scenario.windowStart,
            windowEnd: scenario.windowEnd,
          },
        });
      }
    }
  }

  const questionFieldMap =
    ruleConfig.questionFieldMap && typeof ruleConfig.questionFieldMap === "object"
      ? (ruleConfig.questionFieldMap as Record<string, string>)
      : {};

  for (const keyQuestion of scenario.keyQuestions ?? []) {
    const field = questionFieldMap[keyQuestion.question];
    if (!field) continue;
    const actualAnswer = visitData[field];
    if (String(actualAnswer ?? "").trim() !== keyQuestion.expectedAnswer.trim()) {
      results.push({
        severity: FindingSeverity.HIGH,
        message: `Odpověď na otázku "${keyQuestion.question}" neodpovídá scénáři (očekáváno "${
          keyQuestion.expectedAnswer
        }", nalezeno "${actualAnswer ?? "—"}").`,
        details: { field, expected: keyQuestion.expectedAnswer, actual: actualAnswer },
      });
    }
  }

  return results;
};
