import { prisma } from "@/lib/prisma";
import { ExcelCsvImportSource } from "./excelCsvImportSource";
import { hashRowData } from "./hash";
import { runRulesForVisit } from "@/lib/rules/runRules";

export interface ImportResult {
  batchId: string;
  rowsTotal: number;
  rowsNew: number;
  rowsSkipped: number;
  rowsRechecked: number;
}

/**
 * Naimportuje soubor do vlny: pro každý řádek podle InspectionId buď
 * založí novou návštěvu (+ rovnou zkontroluje), přeskočí ji (beze změny
 * obsahu), nebo aktualizuje a zkontroluje znovu (obsah se změnil).
 */
export async function importVisitsFromFile(params: {
  waveId: string;
  fileName: string;
  buffer: Buffer;
  uploadedById?: string;
}): Promise<ImportResult> {
  const { waveId, fileName, buffer, uploadedById } = params;

  const source = new ExcelCsvImportSource();
  const rows = await source.parse(buffer, fileName);

  const batch = await prisma.importBatch.create({
    data: { waveId, fileName, uploadedById, rowsTotal: rows.length },
  });

  let rowsNew = 0;
  let rowsSkipped = 0;
  let rowsRechecked = 0;

  for (const row of rows) {
    const contentHash = hashRowData(row.data);

    const existing = await prisma.visit.findUnique({
      where: { waveId_inspectionId: { waveId, inspectionId: row.inspectionId } },
    });

    if (!existing) {
      const visit = await prisma.visit.create({
        data: {
          waveId,
          inspectionId: row.inspectionId,
          contentHash,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: row.data as any,
          lastImportBatchId: batch.id,
        },
      });
      await runRulesForVisit(visit.id);
      rowsNew++;
      continue;
    }

    if (existing.contentHash === contentHash) {
      rowsSkipped++;
      continue;
    }

    await prisma.visit.update({
      where: { id: existing.id },
      data: {
        contentHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: row.data as any,
        lastImportBatchId: batch.id,
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
