import { prisma } from "@/lib/prisma";
import { checkRequired } from "./required";
import { checkAllowedValues } from "./allowedValues";
import { checkNumericRange } from "./numericRange";
import { checkRealDateWindow, buildRealDateMessage } from "./realDateWindow";
import { checkTextForIssues } from "./grammarCheck";
import { isQuestionColumn } from "./matchQuestion";
import type { RuleChecker, ScenarioData } from "./types";
import { RuleType, FindingSeverity, SystemCheckType } from "@prisma/client";

const CHECKERS: Record<RuleType, RuleChecker> = {
  [RuleType.REQUIRED]: checkRequired,
  [RuleType.ALLOWED_VALUES]: checkAllowedValues,
  [RuleType.NUMERIC_RANGE]: checkNumericRange,
};

/**
 * Spustí kontrolu jedné návštěvy: (1) ručně nastavená pravidla scénáře,
 * ke kterému návštěva patří (viz Visit.scenarioId — nastavuje se při
 * importu), a (2) dvě automatické kontroly, které běží VŽDY A VŠUDE
 * napříč celou appkou bez ohledu na nastavená pravidla — datum návštěvy
 * (RealDate vs. okno terénu scénáře) a možné překlepy v odpovědích.
 */
export async function runRulesForVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { scenario: { include: { rules: { where: { isActive: true } } } } },
  });
  if (!visit) return;

  const scenarioData = (visit.scenario.data as ScenarioData | null) ?? null;
  const visitData = visit.data as Record<string, unknown>;

  // 1) ručně nastavená pravidla scénáře
  for (const rule of visit.scenario.rules) {
    const checker = CHECKERS[rule.type];
    const config = (rule.config as Record<string, unknown>) ?? {};
    const results = checker({ visitData, ruleConfig: config });

    for (const result of results) {
      await prisma.finding.create({
        data: {
          visitId: visit.id,
          ruleId: rule.id,
          severity: result.severity,
          message: result.message,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: (result.details ?? {}) as any,
        },
      });
    }
  }

  // 2) automatická kontrola data návštěvy (RealDate vs. Start/Konec terénu)
  const dateIssue = checkRealDateWindow(visitData, scenarioData);
  if (dateIssue) {
    await prisma.finding.create({
      data: {
        visitId: visit.id,
        systemCheck: SystemCheckType.REAL_DATE_WINDOW,
        severity: FindingSeverity.MEDIUM,
        message: buildRealDateMessage(dateIssue, scenarioData),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: dateIssue as any,
      },
    });
  }

  // 3) automatická kontrola překlepů — jen ve skutečných odpovědích na otázky
  // (sloupce ve tvaru "KÓD: textace", např. "X20: ..."), ne v pomocných
  // sloupcích jako "Control:", "Email:", "Note_2:" nebo "RealDate".
  for (const [field, value] of Object.entries(visitData)) {
    if (typeof value !== "string") continue;
    if (!isQuestionColumn(field)) continue;
    const issue = checkTextForIssues(value);
    if (!issue) continue;

    await prisma.finding.create({
      data: {
        visitId: visit.id,
        systemCheck: SystemCheckType.GRAMMAR,
        severity: FindingSeverity.MEDIUM,
        message: `Možný překlep v odpovědi "${field}" — ${issue.reason}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: { field, ...issue } as any,
      },
    });
  }
}

/** Ručně spustí kontrolu znovu nad všemi návštěvami celé vlny (staré nálezy se nahradí). */
export async function rerunRulesForWave(waveId: string) {
  const visits = await prisma.visit.findMany({ where: { waveId }, select: { id: true } });
  for (const visit of visits) {
    await prisma.finding.deleteMany({ where: { visitId: visit.id } });
    await runRulesForVisit(visit.id);
  }
}

/** Ručně spustí kontrolu znovu jen nad návštěvami jednoho scénáře. */
export async function rerunRulesForScenario(scenarioId: string) {
  const visits = await prisma.visit.findMany({ where: { scenarioId }, select: { id: true } });
  for (const visit of visits) {
    await prisma.finding.deleteMany({ where: { visitId: visit.id } });
    await runRulesForVisit(visit.id);
  }
}
