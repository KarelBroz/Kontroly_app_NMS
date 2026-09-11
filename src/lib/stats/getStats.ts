import { prisma } from "@/lib/prisma";
import { FindingStatus } from "@prisma/client";
import type { DateRange } from "./dateRange";

export interface ProjectCount {
  projectId: string;
  projectName: string;
  count: number;
}

export interface ReviewerCount {
  userId: string;
  name: string;
  count: number;
}

export interface MonthlyActivity {
  activeProjects: { total: number; ranked: ProjectCount[] }; // "aktivní" = má tolik různých vln s návštěvou v období
  visits: { total: number; ranked: ProjectCount[] };
}

/**
 * Návštěvy naimportované v daném období (Visit.createdAt), rozpadlé podle
 * projektu — dává dohromady jak dlaždici "Aktivní projekty" (kolik různých
 * vln mělo aktivitu), tak "Návštěvy" (celkový počet), z jednoho dotazu.
 */
export async function getMonthlyActivity(range: DateRange): Promise<MonthlyActivity> {
  const visits = await prisma.visit.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: { waveId: true, wave: { select: { projectId: true, project: { select: { name: true } } } } },
  });

  const perProject = new Map<string, { name: string; visitCount: number; waveIds: Set<string> }>();
  for (const v of visits) {
    const pid = v.wave.projectId;
    const entry = perProject.get(pid) ?? { name: v.wave.project.name, visitCount: 0, waveIds: new Set<string>() };
    entry.visitCount += 1;
    entry.waveIds.add(v.waveId);
    perProject.set(pid, entry);
  }

  const byVisits = [...perProject.entries()]
    .map(([projectId, e]) => ({ projectId, projectName: e.name, count: e.visitCount }))
    .sort((a, b) => b.count - a.count);
  const byWaves = [...perProject.entries()]
    .map(([projectId, e]) => ({ projectId, projectName: e.name, count: e.waveIds.size }))
    .sort((a, b) => b.count - a.count);

  return {
    activeProjects: { total: perProject.size, ranked: byWaves },
    visits: { total: visits.length, ranked: byVisits },
  };
}

/**
 * Aktuální "dluh" nezkontrolovaných nálezů podle projektu — vždy živé číslo
 * (kolik čeká PRÁVĚ TEĎ), netýká se historie/měsíční navigace.
 */
export async function getOpenFindingsByProject(): Promise<{ total: number; ranked: ProjectCount[] }> {
  const findings = await prisma.finding.findMany({
    where: { status: FindingStatus.OPEN },
    select: { visit: { select: { wave: { select: { projectId: true, project: { select: { name: true } } } } } } },
  });

  const perProject = new Map<string, { name: string; count: number }>();
  for (const f of findings) {
    const pid = f.visit.wave.projectId;
    const entry = perProject.get(pid) ?? { name: f.visit.wave.project.name, count: 0 };
    entry.count += 1;
    perProject.set(pid, entry);
  }

  const ranked = [...perProject.entries()]
    .map(([projectId, e]) => ({ projectId, projectName: e.name, count: e.count }))
    .sort((a, b) => b.count - a.count);

  return { total: findings.length, ranked };
}

/**
 * Žebříček kontrolorů podle počtu vyřešených nálezů v období (podle
 * Finding.resolvedAt) — "nejpilnější kontroloři".
 */
export interface WaveAttention {
  waveId: string;
  waveName: string;
  projectId: string;
  projectName: string;
  openFindingsCount: number;
  earliestWindowEnd: Date;
  isOverdue: boolean;
}

/**
 * Vlny, které "vyžadují pozornost" — mají u některého scénáře Konec terénu
 * už uplynulý nebo blízko (do `withinDays` dnů) A ZÁROVEŇ ještě mají
 * otevřené nálezy. Pro widget na homepage ("neztratit ze zřetele" vlny,
 * co se blíží ke konci terénu a ještě nejsou hotové).
 */
export async function getWavesNeedingAttention(withinDays = 3): Promise<WaveAttention[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const [openFindings, scenarios] = await Promise.all([
    prisma.finding.findMany({
      where: { status: FindingStatus.OPEN },
      select: { visit: { select: { waveId: true } } },
    }),
    prisma.scenario.findMany({
      select: {
        data: true,
        wave: { select: { id: true, name: true, projectId: true, project: { select: { name: true } } } },
      },
    }),
  ]);

  const openCountByWave = new Map<string, number>();
  for (const f of openFindings) {
    openCountByWave.set(f.visit.waveId, (openCountByWave.get(f.visit.waveId) ?? 0) + 1);
  }

  const earliestEndByWave = new Map<
    string,
    { end: Date; waveName: string; projectId: string; projectName: string }
  >();
  for (const s of scenarios) {
    const data = s.data as { windowEnd?: string } | null;
    if (!data?.windowEnd) continue;
    const end = new Date(data.windowEnd);
    if (Number.isNaN(end.getTime())) continue;
    const existing = earliestEndByWave.get(s.wave.id);
    if (!existing || end < existing.end) {
      earliestEndByWave.set(s.wave.id, {
        end,
        waveName: s.wave.name,
        projectId: s.wave.projectId,
        projectName: s.wave.project.name,
      });
    }
  }

  const result: WaveAttention[] = [];
  for (const [waveId, info] of earliestEndByWave) {
    const openFindingsCount = openCountByWave.get(waveId) ?? 0;
    if (openFindingsCount === 0) continue;
    if (info.end > horizon) continue;
    result.push({
      waveId,
      waveName: info.waveName,
      projectId: info.projectId,
      projectName: info.projectName,
      openFindingsCount,
      earliestWindowEnd: info.end,
      isOverdue: info.end < now,
    });
  }

  result.sort((a, b) => a.earliestWindowEnd.getTime() - b.earliestWindowEnd.getTime());
  return result;
}

export async function getTopReviewers(range: DateRange): Promise<ReviewerCount[]> {
  const findings = await prisma.finding.findMany({
    where: {
      status: FindingStatus.RESOLVED,
      reviewedById: { not: null },
      resolvedAt: { gte: range.start, lt: range.end },
    },
    select: { reviewedById: true, reviewedBy: { select: { name: true, email: true } } },
  });

  const perUser = new Map<string, { name: string; count: number }>();
  for (const f of findings) {
    if (!f.reviewedById) continue;
    const label = f.reviewedBy?.name ?? f.reviewedBy?.email ?? "Neznámý";
    const entry = perUser.get(f.reviewedById) ?? { name: label, count: 0 };
    entry.count += 1;
    perUser.set(f.reviewedById, entry);
  }

  return [...perUser.entries()]
    .map(([userId, e]) => ({ userId, name: e.name, count: e.count }))
    .sort((a, b) => b.count - a.count);
}
