import { prisma } from "@/lib/prisma";
import { checkRequired } from "./required";
import { checkAllowedValues } from "./allowedValues";
import { checkNumericRange } from "./numericRange";
import { checkConditionalRequired } from "./conditionalRequired";
import { checkProductAllowlist } from "./productAllowlist";
import { checkNumericThresholdConsistency } from "./numericThresholdConsistency";
import { checkRealDateWindow, buildRealDateMessage } from "./realDateWindow";
import { checkTextForIssues } from "./grammarCheck";
import { isQuestionColumn } from "./matchQuestion";
import type { RuleChecker, ScenarioData } from "./types";
import { RuleType, FindingSeverity, SystemCheckType, type Rule } from "@prisma/client";

const CHECKERS: Record<RuleType, RuleChecker> = {
  [RuleType.REQUIRED]: checkRequired,
  [RuleType.ALLOWED_VALUES]: checkAllowedValues,
  [RuleType.NUMERIC_RANGE]: checkNumericRange,
  [RuleType.CONDITIONAL_REQUIRED]: checkConditionalRequired,
  [RuleType.PRODUCT_ALLOWLIST]: checkProductAllowlist,
  [RuleType.NUMERIC_THRESHOLD_CONSISTENCY]: checkNumericThresholdConsistency,
};

/** Jedna "zamýšlená" řádka do tabulky Finding — ještě neuložená (viz computeFindingsForVisit). */
export interface FindingDraft {
  visitId: string;
  ruleId?: string;
  systemCheck?: SystemCheckType;
  severity: FindingSeverity;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
}

export type VisitForRules = {
  id: string;
  data: unknown;
  scenario: { data: unknown; rules: Rule[] };
};

/**
 * Spočítá VŠECHNY nálezy jedné návštěvy (ručně nastavená pravidla scénáře +
 * dvě automatické kontroly, co běží vždy) — čistá funkce beze čtení/zápisu
 * do databáze, aby šla použít jak pro kontrolu jedné návštěvy, tak hromadně
 * nad celou vlnou/scénářem beze zbytečných dotazů navíc (viz
 * runRulesForVisit/rerunRulesForWave/rerunRulesForScenario níže).
 */
export function computeFindingsForVisit(visit: VisitForRules): FindingDraft[] {
  const scenarioData = (visit.scenario.data as ScenarioData | null) ?? null;
  const visitData = visit.data as Record<string, unknown>;
  const drafts: FindingDraft[] = [];

  // Neúspěšná návštěva (chybí RealDate) — podle nastavení scénáře se vůbec
  // nekontroluje, žádná pravidla ani systémové kontroly (viz ScenarioData.skipIfNoRealDate).
  if (scenarioData?.skipIfNoRealDate) {
    const realDateRaw = visitData["RealDate"];
    const realDateMissing = realDateRaw === undefined || realDateRaw === null || String(realDateRaw).trim() === "";
    if (realDateMissing) return drafts;
  }

  // 1) ručně nastavená pravidla scénáře
  for (const rule of visit.scenario.rules) {
    const checker = CHECKERS[rule.type];
    const config = (rule.config as Record<string, unknown>) ?? {};
    const results = checker({ visitData, ruleConfig: config });

    for (const result of results) {
      drafts.push({
        visitId: visit.id,
        ruleId: rule.id,
        severity: result.severity,
        message: result.message,
        details: result.details ?? {},
      });
    }
  }

  // 2) automatická kontrola data návštěvy (RealDate vs. Start/Konec terénu)
  const dateIssue = checkRealDateWindow(visitData, scenarioData);
  if (dateIssue) {
    drafts.push({
      visitId: visit.id,
      systemCheck: SystemCheckType.REAL_DATE_WINDOW,
      severity: FindingSeverity.MEDIUM,
      message: buildRealDateMessage(dateIssue, scenarioData),
      details: dateIssue,
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

    drafts.push({
      visitId: visit.id,
      systemCheck: SystemCheckType.GRAMMAR,
      severity: FindingSeverity.MEDIUM,
      message: `Možný překlep v odpovědi "${field}" — ${issue.reason}`,
      details: { field, ...issue },
    });
  }

  return drafts;
}

/** Uloží nálezy najednou (`createMany`) — po dávkách, ať jedno hromadné
 * spuštění nad velkou vlnou neposílá do databáze jeden obří dotaz. */
export async function saveFindings(drafts: FindingDraft[]): Promise<void> {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < drafts.length; i += CHUNK_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.finding.createMany({ data: drafts.slice(i, i + CHUNK_SIZE) as any });
  }
}

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

  const drafts = computeFindingsForVisit(visit);
  await saveFindings(drafts);
}

/** Ručně spustí kontrolu znovu nad všemi návštěvami celé vlny (staré nálezy se nahradí). */
export async function rerunRulesForWave(waveId: string) {
  await prisma.finding.deleteMany({ where: { visit: { waveId } } });
  const visits = await prisma.visit.findMany({
    where: { waveId },
    include: { scenario: { include: { rules: { where: { isActive: true } } } } },
  });
  const drafts = visits.flatMap((visit) => computeFindingsForVisit(visit));
  await saveFindings(drafts);
}

/** Ručně spustí kontrolu znovu jen nad návštěvami jednoho scénáře. */
export async function rerunRulesForScenario(scenarioId: string) {
  await prisma.finding.deleteMany({ where: { visit: { scenarioId } } });
  const visits = await prisma.visit.findMany({
    where: { scenarioId },
    include: { scenario: { include: { rules: { where: { isActive: true } } } } },
  });
  const drafts = visits.flatMap((visit) => computeFindingsForVisit(visit));
  await saveFindings(drafts);
}
