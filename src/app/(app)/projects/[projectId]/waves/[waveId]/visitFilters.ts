import { RuleType, SystemCheckType, type Prisma } from "@prisma/client";

/** Filtry nad seznamem návštěv vlny — sdílené mezi stránkou vlny (zobrazení) a exportem do Excelu. */
export interface VisitFilterParams {
  scenario?: string;
  reviewer?: string;
  q?: string;
  // Typ chyby — hodnota RuleType (např. "REQUIRED"), nebo systémová kontrola
  // s předponou "SYS_" (např. "SYS_GRAMMAR") — viz encodeFindingTypeValue/
  // FINDING_TYPE_OPTIONS v page.tsx.
  findingType?: string;
}

const SYS_PREFIX = "SYS_";

/** Sestaví Prisma "where" pro Visit z URL parametrů — "all"/prázdné = bez omezení. */
export function buildVisitWhere(waveId: string, params: VisitFilterParams): Prisma.VisitWhereInput {
  const where: Prisma.VisitWhereInput = { waveId: waveId };

  if (params.scenario && params.scenario !== "all") {
    where.scenarioId = params.scenario;
  }
  if (params.reviewer && params.reviewer !== "all") {
    where.reviewerId = params.reviewer;
  }
  const q = params.q ? params.q.trim() : "";
  if (q) {
    where.inspectionId = { contains: q, mode: "insensitive" };
  }

  const findingType = params.findingType && params.findingType !== "all" ? params.findingType : "";
  // Neznámá hodnota z URL (překlep, stará záložka) se ignoruje — jinak by
  // Prisma vyhodila chybu a stránka i export spadly.
  if (findingType) {
    if (findingType.startsWith(SYS_PREFIX)) {
      const systemCheck = findingType.slice(SYS_PREFIX.length);
      if ((Object.values(SystemCheckType) as string[]).includes(systemCheck)) {
        where.findings = { some: { systemCheck: systemCheck as SystemCheckType } };
      }
    } else if ((Object.values(RuleType) as string[]).includes(findingType)) {
      where.findings = { some: { rule: { type: findingType as RuleType } } };
    }
  }

  return where;
}
