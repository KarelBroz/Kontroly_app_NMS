import { prisma } from "@/lib/prisma";
import { ExcelCsvImportSource } from "./excelCsvImportSource";
import { hashRowData, legacyHashRowData, stableStringify } from "./hash";
import { anonymizeVisitData, isAnonymizationEnabled } from "@/lib/anonymize/anonymize";
import { readControlReviewer } from "./controlFields";
import { computeFindingsForVisit, replaceFindings, saveFindings } from "@/lib/rules/runRules";

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
 *
 * Výkonově dávkově: kontroloři a existující návštěvy se načtou/založí
 * NAJEDNOU (ne dotaz na každý řádek zvlášť) a nálezy se počítají v paměti a
 * ukládají přes createMany (ne jeden INSERT na každý nález) — u vlny s
 * stovkami návštěv jde o řádově méně dotazů do databáze.
 *
 * Pozn.: pokud by stejný InspectionId byl ve stejném souboru víckrát (v praxi
 * by nemělo nastat — InspectionId generuje mystery-shoppingová platforma a
 * je to stabilní klíč jedné návštěvy), použije se poslední výskyt; součty
 * rowsNew/rowsSkipped/rowsRechecked pak počítají tenhle poslední výskyt
 * jedním záznamem (ne každý duplicitní řádek zvlášť).
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
  const parsedRows = await source.parse(buffer, fileName);

  // Osobní údaje (shopper, kontrolor, jména v odpovědích, e-maily a telefony
  // v textech) se odstraní hned po načtení — do databáze ani do nálezů se
  // vůbec nedostanou. Viz src/lib/anonymize/anonymize.ts.
  const anonymize = isAnonymizationEnabled();
  const rows = anonymize ? parsedRows.map((row) => ({ ...row, data: anonymizeVisitData(row.data) })) : parsedRows;
  const anonymizedAt = anonymize ? new Date() : null;

  const batch = await prisma.importBatch.create({
    data: { waveId, scenarioId, fileName, uploadedById, rowsTotal: rows.length },
  });

  // Poslední výskyt vyhrává, viz pozn. výše.
  const rowsByInspectionId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) rowsByInspectionId.set(row.inspectionId, row);
  const dedupedRows = [...rowsByInspectionId.values()];

  // --- 1) kontroloři: najít/založit VŠECHNY najednou (místo dotazu na řádek) ---
  const controlByInspectionId = new Map<string, ReturnType<typeof readControlReviewer>>();
  const uniqueControls = new Map<string, { firstName: string; lastName: string; email: string }>();
  for (const row of dedupedRows) {
    const control = readControlReviewer(row.data);
    controlByInspectionId.set(row.inspectionId, control);
    if (control && !uniqueControls.has(control.email)) uniqueControls.set(control.email, control);
  }
  const reviewerIdByEmail = new Map<string, string>();
  if (uniqueControls.size > 0) {
    const emails = [...uniqueControls.keys()];
    const existingReviewers = await prisma.reviewer.findMany({ where: { email: { in: emails } } });
    for (const r of existingReviewers) reviewerIdByEmail.set(r.email, r.id);
    const missing = emails.filter((e) => !reviewerIdByEmail.has(e));
    if (missing.length > 0) {
      await prisma.reviewer.createMany({
        data: missing.map((e) => uniqueControls.get(e)!),
        skipDuplicates: true,
      });
      const created = await prisma.reviewer.findMany({ where: { email: { in: missing } } });
      for (const r of created) reviewerIdByEmail.set(r.email, r.id);
    }
  }

  // --- 2) existující návštěvy téhle vlny NAJEDNOU (místo dotazu na řádek) ---
  const inspectionIds = dedupedRows.map((r) => r.inspectionId);
  const existingVisits = await prisma.visit.findMany({ where: { waveId, inspectionId: { in: inspectionIds } } });
  const existingByInspectionId = new Map(existingVisits.map((v) => [v.inspectionId, v]));

  // --- 3) rozhodnout akci pro každý řádek (v paměti, beze čtení z DB) ---
  const toCreate: { inspectionId: string; contentHash: string; data: Record<string, unknown>; reviewerId?: string }[] =
    [];
  const toRecheck: { id: string; contentHash: string; data: Record<string, unknown>; reviewerId?: string }[] = [];
  const skipPatches: { id: string; reviewerId?: string; needsCount: boolean; contentHash?: string }[] = [];
  let rowsSkipped = 0;

  for (const row of dedupedRows) {
    // Data přes JSON = přesně to, co se uloží do DB a co z ní při
    // "Zkontrolovat znovu" přijde (datumy jako ISO řetězce, ne Date) — kontroly
    // i hash tak vidí u nových, změněných i přepočítaných návštěv totéž.
    const data = JSON.parse(JSON.stringify(row.data)) as Record<string, unknown>;
    const contentHash = hashRowData(data);
    const control = controlByInspectionId.get(row.inspectionId);
    const reviewerId = control ? reviewerIdByEmail.get(control.email) : undefined;
    const existing = existingByInspectionId.get(row.inspectionId);

    if (!existing) {
      toCreate.push({ inspectionId: row.inspectionId, contentHash, data, reviewerId });
      continue;
    }

    // Návštěva naimportovaná se starým hashem (datumy se do něj nepočítaly):
    // když se obsah opravdu nezměnil, jen se jí přepíše hash na nový.
    const unchangedLegacy =
      existing.contentHash !== contentHash &&
      existing.contentHash === legacyHashRowData(row.data) &&
      stableStringify(existing.data) === stableStringify(data);

    if ((existing.contentHash === contentHash || unchangedLegacy) && existing.scenarioId === scenarioId) {
      // beze změny obsahu se přeskakuje, ale doplníme, co u návštěvy ještě
      // chybí ze starších importů (před zavedením Databáze kontrolorů/
      // statistiky úspěšnosti) — kontrolora, a "zmrazený" počet nálezů.
      const needsReviewerPatch = !!(reviewerId && existing.reviewerId !== reviewerId);
      const needsCount = existing.initialFindingsCount === null;
      if (needsReviewerPatch || needsCount || unchangedLegacy) {
        skipPatches.push({
          id: existing.id,
          reviewerId: needsReviewerPatch ? reviewerId : undefined,
          needsCount,
          contentHash: unchangedLegacy ? contentHash : undefined,
        });
      }
      rowsSkipped++;
      continue;
    }

    toRecheck.push({ id: existing.id, contentHash, data, reviewerId });
  }

  const rowsNew = toCreate.length;
  const rowsRechecked = toRecheck.length;

  // Pravidla scénáře se pro celý soubor načtou JEDNOU (celý soubor patří
  // jednomu scénáři) — ne pro každou návštěvu zvlášť. Jen když je vůbec co
  // (pře)kontrolovat (u čistě přeskočeného re-importu se to nepotřebuje).
  const scenario =
    toCreate.length > 0 || toRecheck.length > 0
      ? await prisma.scenario.findUnique({
          where: { id: scenarioId },
          include: { rules: { where: { isActive: true } } },
        })
      : null;

  // --- 4) nové návštěvy: hromadně vytvořit, spočítat nálezy, hromadně uložit ---
  if (toCreate.length > 0) {
    await prisma.visit.createMany({
      data: toCreate.map((r) => ({
        waveId,
        scenarioId,
        inspectionId: r.inspectionId,
        contentHash: r.contentHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: r.data as any,
        lastImportBatchId: batch.id,
        reviewerId: r.reviewerId,
        anonymizedAt,
      })),
    });

    const created = await prisma.visit.findMany({
      where: { waveId, inspectionId: { in: toCreate.map((r) => r.inspectionId) } },
      select: { id: true, data: true },
    });

    if (scenario) {
      const allDrafts = created.flatMap((v) =>
        computeFindingsForVisit({ id: v.id, data: v.data, scenario: { data: scenario.data, rules: scenario.rules } })
      );
      await saveFindings(allDrafts);

      const countByVisitId = new Map<string, number>();
      for (const d of allDrafts) countByVisitId.set(d.visitId, (countByVisitId.get(d.visitId) ?? 0) + 1);
      await Promise.all(
        created.map((v) =>
          prisma.visit.update({
            where: { id: v.id },
            data: { initialFindingsCount: countByVisitId.get(v.id) ?? 0 },
          })
        )
      );
    }
  }

  // --- 5) změněné návštěvy: aktualizovat data (různá u každé, nejde dávkově),
  // pak hromadně smazat staré a spočítat/uložit nové nálezy ---
  if (toRecheck.length > 0) {
    await Promise.all(
      toRecheck.map((r) =>
        prisma.visit.update({
          where: { id: r.id },
          data: {
            scenarioId,
            contentHash: r.contentHash,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: r.data as any,
            lastImportBatchId: batch.id,
            reviewerId: r.reviewerId,
            anonymizedAt,
          },
        })
      )
    );

    // Stav nálezů, které po změně vyjdou znovu stejně, se zachová (viz replaceFindings).
    const allDrafts = scenario
      ? toRecheck.flatMap((r) =>
          computeFindingsForVisit({ id: r.id, data: r.data, scenario: { data: scenario.data, rules: scenario.rules } })
        )
      : [];
    await replaceFindings({ waveId, where: { visitId: { in: toRecheck.map((r) => r.id) } } }, allDrafts);

    if (scenario) {
      const countByVisitId = new Map<string, number>();
      for (const d of allDrafts) countByVisitId.set(d.visitId, (countByVisitId.get(d.visitId) ?? 0) + 1);
      await Promise.all(
        toRecheck.map((r) =>
          prisma.visit.update({
            where: { id: r.id },
            data: { initialFindingsCount: countByVisitId.get(r.id) ?? 0 },
          })
        )
      );
    }
  }

  // --- 6) přeskočené návštěvy s chybějícím doplněním (viz krok 3) ---
  if (skipPatches.length > 0) {
    await Promise.all(
      skipPatches.map(async (p) => {
        const patch: { reviewerId?: string; initialFindingsCount?: number; contentHash?: string } = {};
        if (p.reviewerId) patch.reviewerId = p.reviewerId;
        if (p.contentHash) patch.contentHash = p.contentHash;
        if (p.needsCount) {
          patch.initialFindingsCount = await prisma.finding.count({ where: { visitId: p.id } });
        }
        await prisma.visit.update({ where: { id: p.id }, data: patch });
      })
    );
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
