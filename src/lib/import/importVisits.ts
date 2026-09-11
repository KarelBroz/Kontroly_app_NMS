import { prisma } from "@/lib/prisma";
import { ExcelCsvImportSource } from "./excelCsvImportSource";
import { hashRowData } from "./hash";
import { readControlReviewer } from "./controlFields";
import { runRulesForVisit } from "@/lib/rules/runRules";

/**
 * Podle Control: sloupců řádku najde existujícího kontrolora (podle
 * e-mailu), nebo ho rovnou založí do Databáze kontrolorů. Jméno/příjmení se
 * u už existujícího profilu nepřepisuje (drobné odchylky mezi importy ať
 * nešustí historii) — jen se ověří, že profil vůbec existuje.
 */
async function resolveReviewerId(data: Record<string, unknown>): Promise<string | undefined> {
  const control = readControlReviewer(data);
  if (!control) return undefined;
  const reviewer = await prisma.reviewer.upsert({
    where: { email: control.email },
    update: {},
    create: control,
  });
  return reviewer.id;
}

export interface ImportResult {
  batchId: string;
  rowsTotal: number;
  rowsNew: number;
  rowsSkipped: number;
  rowsRechecked: number;
}

/**
 * Naimportuje soubor do vlny pod ZVOLENÝ SCÉNÁŘ (celý soubor patří jednomu
 * scénáři — vybírá se ručně při potvrzení importu). Pro každý řádek podle
 * InspectionId buď založí novou návštěvu (+ rovnou zkontroluje pravidly
 * daného scénáře), přeskočí ji (beze změny obsahu), nebo aktualizuje a
 * zkontroluje znovu (obsah, případně i scénář, se změnil).
 */
export async function importVisitsFromFile(params: {
  waveId: string;
  scenarioId: string;
  fileName: string;
  buffer: Buffer;
  uploadedById?: string;
}): Promise<ImportResult> {
  const { waveId, scenarioId, fileName, buffer, uploadedById } = params;

  const source = new ExcelCsvImportSource();
  const rows = await source.parse(buffer, fileName);

  const batch = await prisma.importBatch.create({
    data: { waveId, scenarioId, fileName, uploadedById, rowsTotal: rows.length },
  });

  let rowsNew = 0;
  let rowsSkipped = 0;
  let rowsRechecked = 0;

  for (const row of rows) {
    const contentHash = hashRowData(row.data);
    const reviewerId = await resolveReviewerId(row.data);

    const existing = await prisma.visit.findUnique({
      where: { waveId_inspectionId: { waveId, inspectionId: row.inspectionId } },
    });

    if (!existing) {
      const visit = await prisma.visit.create({
        data: {
          waveId,
          scenarioId,
          inspectionId: row.inspectionId,
          contentHash,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: row.data as any,
          lastImportBatchId: batch.id,
          reviewerId,
        },
      });
      await runRulesForVisit(visit.id);
      rowsNew++;
      continue;
    }

    if (existing.contentHash === contentHash && existing.scenarioId === scenarioId) {
      // beze změny obsahu se přeskakuje, ale kontrolora (pokud u návštěvy
      // ještě chybí — např. import proběhl ještě před zavedením Databáze
      // kontrolorů) doplníme i tak, ať se doplní i zpětně
      if (reviewerId && existing.reviewerId !== reviewerId) {
        await prisma.visit.update({ where: { id: existing.id }, data: { reviewerId } });
      }
      rowsSkipped++;
      continue;
    }

    await prisma.visit.update({
      where: { id: existing.id },
      data: {
        scenarioId,
        contentHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: row.data as any,
        lastImportBatchId: batch.id,
        reviewerId,
      },
    });
    await prisma.finding.deleteMany({ where: { visitId: existing.id } });
    await runRulesForVisit(existing.id);
    rowsRechecked++;
  }

  const updatedBatch = await prisma.importBatch.update({
    where: { id: batch.id },
    data: { rowsNew, rowsSkipped, rowsRechecked },
  });

  return {
    batchId: updatedBatch.id,
    rowsTotal: updatedBatch.rowsTotal,
    rowsNew,
    rowsSkipped,
    rowsRechecked,
  };
}
