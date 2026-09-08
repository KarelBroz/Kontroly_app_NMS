import { prisma } from "@/lib/prisma";
import { checkCompleteness } from "./completeness";
import { checkScenario } from "./scenario";
import { checkAttachments } from "./attachments";
import type { RuleChecker, ScenarioData } from "./types";
import { RuleType } from "@prisma/client";

const CHECKERS: Record<RuleType, RuleChecker> = {
  [RuleType.COMPLETENESS]: checkCompleteness,
  [RuleType.SCENARIO]: checkScenario,
  [RuleType.ATTACHMENTS]: checkAttachments,
};

/** Spustí všechna aktivní pravidla vlny nad jednou návštěvou a uloží nálezy. */
export async function runRulesForVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { wave: { include: { rules: { where: { isActive: true } } } } },
  });
  if (!visit) return;

  const scenario = (visit.wave.scenario as ScenarioData | null) ?? null;
  const visitData = visit.data as Record<string, unknown>;

  for (const rule of visit.wave.rules) {
    const checker = CHECKERS[rule.type];
    const config = (rule.config as Record<string, unknown>) ?? {};
    const results = checker({ visitData, ruleConfig: config, scenario });

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
}

/** Ručně spustí kontrolu znovu nad všemi návštěvami celé vlny (staré nálezy se nahradí). */
export async function rerunRulesForWave(waveId: string) {
  const visits = await prisma.visit.findMany({ where: { waveId }, select: { id: true } });
  for (const visit of visits) {
    await prisma.finding.deleteMany({ where: { visitId: visit.id } });
    await runRulesForVisit(visit.id);
  }
}
