import type { Prisma } from "@prisma/client";

/** Filtry nad seznamem návštěv vlny — sdílené mezi stránkou vlny (zobrazení) a exportem do Excelu. */
export interface VisitFilterParams {
  scenario?: string;
  reviewer?: string;
  q?: string;
}

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

  return where;
}
