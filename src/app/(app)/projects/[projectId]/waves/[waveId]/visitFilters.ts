import type { Prisma } from "@prisma/client";

/** Filtry nad seznamem návštěv vlny — sdílené mezi stránkou vlny (zobrazení) a exportem do Excelu. */
export interface VisitFilterParams {
  scenario?: string;
  reviewer?: string;
  q?: string;
}

/** Sestaví Prisma "where" pro Visit z URL parametrů — "all"/prázdné = bez omezení. */
export function buildVisitWhere(waveId: string, params: VisitFilterParams): Prisma.VisitWhereInput {
  const scenarioFilter = params.scenario && params.scenario !== "all" ? params.scenario : undefined;
  const reviewerFilter = params.reviewer && params.reviewer !== "all" ? params.reviewer : undefined;
  const qFilter = params.q?.trim() || undefined;

  return {
    waveId,
    ...(scenarioFilter ? { scenarioId: scenarioFilter } : {}),
    ...(reviewerFilter ? { reviewerId: reviewerFilter } : {}),
    ...(qFilter ? { inspectionId: { contains: qFilter, mode: "insensitive" } } : {}),
  };
}
