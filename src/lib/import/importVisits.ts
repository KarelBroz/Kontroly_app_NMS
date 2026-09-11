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

/**
 * Spustí pravidla nad návštěvou a hned nato "zmrazí" počet nálezů, co z
 * toho vzešel — výkon (externího) kontrolora v okamžiku, kdy tahle data
 * přišla. Použít JEN v importu — ruční "Spustit kontrolu znovu" volá
 * runRulesForVisit přímo, bez dotyku na tenhle snapshot (viz
 * src/lib/rules/runRules.ts).
 */
async function checkVisitAndFreezeCount(visitId: string): Promise<void> {
  await runRulesForVisit(visitId);
  const initialFindingsCount = await prisma.finding.count({ where: { visitId } });
  await prisma.visit.update({ where: { id: visitId }, data: { initialFindingsCount } });
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
      await checkVisitAndFreezeCount(visit.id);
      rowsNew++;
      continue;
    }

    if (existing.contentHash === contentHash && existing.scenarioId === scenarioId) {
      // beze změny obsahu se přeskakuje, ale doplníme, co u návštěvy ještě
      // chybí ze starších importů (před zavedením Databáze kontrolorů/
      // statistiky úspěšnosti) — kontrolora, a "zmrazený" počet nálezů. Ten
      // se u takové staré návštěvy počítá z AKTUÁLNÍCH nálezů — beze změny
      // obsahu nikdo nic nesmazal ani nepřidal (ruční vyřešení mění jen
      // stav, ne počet), takže je to spolehlivě stejné číslo jako při
      // původním importu — pokud mezitím neproběhlo ruční "Spustit
      // kontrolu znovu" nad jinak nastavenými pravidly.
      const patch: { reviewerId?: string; initialFindingsCount?: number } = {};
      if (reviewerId && existing.reviewerId !== reviewerId) patch.reviewerId = reviewerId;
      if (existing.initialFindingsCount === null) {
        patch.initialFindingsCount = await prisma.finding.count({ where: { visitId: existing.id } });
      }
      if (Object.keys(patch).length > 0) {
        await prisma.visit.update({ where: { id: existing.id }, data: patch });
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
    await checkVisitAndFreezeCount(existing.id);
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
