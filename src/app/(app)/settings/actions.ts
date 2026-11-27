"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { anonymizeVisitData, isAnonymizedEmail, reviewerPseudonym } from "@/lib/anonymize/anonymize";
import { hashRowData } from "@/lib/import/hash";
import { rerunRulesForWave } from "@/lib/rules/runRules";

// Jedno spuštění běží nejvýš ~20 s (limit funkce na Vercelu); zbytek
// dokončí další kliknutí. Převod je bezpečné spouštět opakovaně.
const TIME_BUDGET_MS = 20_000;
const BATCH_SIZE = 50;

/**
 * Jednorázový převod už nahraných dat na anonymní podobu (nové importy se
 * anonymizují samy). Kontroloři v Databázi kontrolorů dostanou pseudonym,
 * návštěvy bez Visit.anonymizedAt se převedou a nakonec se přepočítají
 * nálezy, aby ani ve zprávách nálezů nezůstaly původní hodnoty.
 */
export async function anonymizeExistingData() {
  await requireAdmin();
  const started = Date.now();

  // 1) kontroloři — skutečný e-mail → pseudonym (stejný jako při importu)
  const reviewers = await prisma.reviewer.findMany();
  for (const r of reviewers) {
    if (isAnonymizedEmail(r.email)) continue;
    const pseudo = reviewerPseudonym(r.email);
    const existing = await prisma.reviewer.findUnique({ where: { email: pseudo.email } });
    if (existing) {
      // pseudonymní profil už vznikl novým importem — sloučit
      await prisma.$transaction([
        prisma.visit.updateMany({ where: { reviewerId: r.id }, data: { reviewerId: existing.id } }),
        prisma.reviewer.delete({ where: { id: r.id } }),
      ]);
    } else {
      await prisma.reviewer.update({ where: { id: r.id }, data: pseudo });
    }
  }

  // 2) návštěvy po dávkách, dokud zbývá čas
  while (Date.now() - started < TIME_BUDGET_MS) {
    const visits = await prisma.visit.findMany({
      where: { anonymizedAt: null },
      select: { id: true, data: true },
      take: BATCH_SIZE,
    });
    if (visits.length === 0) break;
    const now = new Date();
    await prisma.$transaction(
      visits.map((v) => {
        const data = anonymizeVisitData(v.data as Record<string, unknown>);
        return prisma.visit.update({
          where: { id: v.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { data: data as any, contentHash: hashRowData(data), anonymizedAt: now },
        });
      })
    );
  }

  const remaining = await prisma.visit.count({ where: { anonymizedAt: null } });
  if (remaining > 0) {
    revalidatePath("/settings");
    redirect(`/settings?anonymized=${encodeURIComponent(`Hotová část, zbývá ${remaining} návštěv — klikni prosím znovu.`)}`);
  }

  // 3) nálezy znovu z anonymních dat (stav nálezů se zachová, viz replaceFindings)
  const waves = await prisma.wave.findMany({ where: { visits: { some: {} } }, select: { id: true } });
  for (const w of waves) await rerunRulesForWave(w.id);

  revalidatePath("/", "layout");
  redirect(`/settings?anonymized=${encodeURIComponent("Hotovo — všechna nahraná data jsou anonymní.")}`);
}
