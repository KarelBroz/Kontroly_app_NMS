import { prisma } from "@/lib/prisma";

/**
 * Výkon kontrolora se počítá z Visit.initialFindingsCount — "zmrazeného"
 * počtu nálezů hned po (pře)importu (viz src/lib/import/importVisits.ts).
 * Pozdější ruční vyřešení nálezů v appce (kolegou z NMS) do toho
 * NEZASAHUJE — hodnotí se výkon kontrolora v okamžiku, kdy data přišla.
 */
export interface ReviewerPerformance {
  totalChecks: number;
  cleanChecks: number;
  /** % kontrol bez jediného nálezu; null když zatím nemáme žádná data */
  successRate: number | null;
  /** průměrný počet nálezů na kontrolu; null když zatím nemáme žádná data */
  avgErrorsPerCheck: number | null;
}

function summarize(counts: number[]): ReviewerPerformance {
  const totalChecks = counts.length;
  if (totalChecks === 0) {
    return { totalChecks: 0, cleanChecks: 0, successRate: null, avgErrorsPerCheck: null };
  }
  const cleanChecks = counts.filter((c) => c === 0).length;
  const totalErrors = counts.reduce((sum, c) => sum + c, 0);
  return {
    totalChecks,
    cleanChecks,
    successRate: (cleanChecks / totalChecks) * 100,
    avgErrorsPerCheck: totalErrors / totalChecks,
  };
}

/** Souhrn (celkem + podle projektu) pro detail jednoho kontrolora. */
export async function getReviewerPerformance(reviewerId: string): Promise<{
  overall: ReviewerPerformance;
  byProject: (ReviewerPerformance & { projectId: string; projectName: string })[];
}> {
  const visits = await prisma.visit.findMany({
    where: { reviewerId, initialFindingsCount: { not: null } },
    select: {
      initialFindingsCount: true,
      wave: { select: { projectId: true, project: { select: { name: true } } } },
    },
  });

  const overall = summarize(visits.map((v) => v.initialFindingsCount ?? 0));

  const perProject = new Map<string, { name: string; counts: number[] }>();
  for (const v of visits) {
    const pid = v.wave.projectId;
    const entry = perProject.get(pid) ?? { name: v.wave.project.name, counts: [] };
    entry.counts.push(v.initialFindingsCount ?? 0);
    perProject.set(pid, entry);
  }
  const byProject = [...perProject.entries()]
    .map(([projectId, e]) => ({ projectId, projectName: e.name, ...summarize(e.counts) }))
    .sort((a, b) => b.totalChecks - a.totalChecks);

  return { overall, byProject };
}

/** Rychlý souhrn (počet kontrol + % úspěšnost) pro všechny kontrolory najednou — pro seznam v Databázi kontrolorů. */
export async function getReviewerSuccessRates(): Promise<Map<string, ReviewerPerformance>> {
  const visits = await prisma.visit.findMany({
    where: { reviewerId: { not: null }, initialFindingsCount: { not: null } },
    select: { reviewerId: true, initialFindingsCount: true },
  });

  const perReviewer = new Map<string, number[]>();
  for (const v of visits) {
    if (!v.reviewerId) continue;
    const counts = perReviewer.get(v.reviewerId) ?? [];
    counts.push(v.initialFindingsCount ?? 0);
    perReviewer.set(v.reviewerId, counts);
  }

  const result = new Map<string, ReviewerPerformance>();
  for (const [reviewerId, counts] of perReviewer) {
    result.set(reviewerId, summarize(counts));
  }
  return result;
}
