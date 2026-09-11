import { prisma } from "@/lib/prisma";

/**
 * Pro každý projekt najde "poslední aktivní vlnu" — tu s nejnovějším
 * importem dat, nebo (když u projektu ještě žádný import neproběhl)
 * nejnověji založenou vlnu. Používá se pro proklik z přehledů projektů
 * (homepage, seznam projektů, statistiky) rovnou na vlnu, se kterou se
 * zrovna pracuje, místo na detail projektu.
 */
export async function getLastActiveWaveIdsByProject(projectIds?: string[]): Promise<Map<string, string>> {
  const [latestBatches, projects] = await Promise.all([
    prisma.importBatch.findMany({
      where: projectIds ? { wave: { projectId: { in: projectIds } } } : undefined,
      orderBy: { createdAt: "desc" },
      select: { waveId: true, wave: { select: { projectId: true } } },
    }),
    prisma.project.findMany({
      where: projectIds ? { id: { in: projectIds } } : undefined,
      select: { id: true, waves: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
    }),
  ]);

  const result = new Map<string, string>();
  for (const batch of latestBatches) {
    if (!result.has(batch.wave.projectId)) result.set(batch.wave.projectId, batch.waveId);
  }
  for (const project of projects) {
    if (!result.has(project.id) && project.waves[0]) result.set(project.id, project.waves[0].id);
  }
  return result;
}

/** Odkaz na "poslední aktivní vlnu" projektu, nebo na detail projektu, když ještě žádnou vlnu nemá. */
export function projectQuickLink(projectId: string, lastActiveWaveIds: Map<string, string>): string {
  const waveId = lastActiveWaveIds.get(projectId);
  return waveId ? `/projects/${projectId}/waves/${waveId}` : `/projects/${projectId}`;
}
