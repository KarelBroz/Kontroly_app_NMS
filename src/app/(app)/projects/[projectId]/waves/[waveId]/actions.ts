"use server";

import { prisma } from "@/lib/prisma";
import { Prisma, RuleType, FindingStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importVisitsFromFile } from "@/lib/import/importVisits";
import { rerunRulesForWave, rerunRulesForScenario } from "@/lib/rules/runRules";
import { RULE_TYPE_LABELS } from "@/lib/rules/labels";
import { fixMojibakeFileName } from "@/lib/fixMojibakeFileName";

function wavePath(projectId: string, waveId: string) {
  return `/projects/${projectId}/waves/${waveId}`;
}

function settingsPath(projectId: string, waveId: string) {
  return `/projects/${projectId}/waves/${waveId}/settings`;
}

// ---------- Hlavní stránka vlny: import dat a nálezy ----------

export async function importWaveFile(projectId: string, waveId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  const scenarioId = String(formData.get("scenarioId") || "").trim();
  const file = formData.get("file");

  if (!scenarioId) {
    redirect(
      `${wavePath(projectId, waveId)}?error=${encodeURIComponent("Vyber scénář, ke kterému import patří.")}`
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${wavePath(projectId, waveId)}?error=${encodeURIComponent("Vyber soubor (.xlsx nebo .csv).")}`);
  }

  const arrayBuffer = await (file as File).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await importVisitsFromFile({
    waveId,
    scenarioId,
    fileName: fixMojibakeFileName((file as File).name),
    buffer,
    uploadedById: session?.user?.id,
  });

  revalidatePath(wavePath(projectId, waveId));
  redirect(
    `${wavePath(projectId, waveId)}?imported=${result.rowsNew}-${result.rowsSkipped}-${result.rowsRechecked}`
  );
}

/**
 * Smaže celý import (a s ním i všechny návštěvy, které tenhle konkrétní
 * soubor naposledy přinesl/změnil — Visit.lastImportBatchId) — ochrana
 * proti omylem nahranému špatnému souboru. Návštěvy, které mezitím
 * přepsal NOVĚJŠÍ import, zůstanou beze změny (nejsou to už "data téhle
 * dávky").
 */
export async function deleteImportBatch(projectId: string, waveId: string, batchId: string, _formData: FormData) {
  await prisma.visit.deleteMany({ where: { lastImportBatchId: batchId } });
  await prisma.importBatch.delete({ where: { id: batchId } });
  revalidatePath(wavePath(projectId, waveId));
  redirect(`${wavePath(projectId, waveId)}?saved=${encodeURIComponent("Import smazán")}`);
}

export async function rerunWave(projectId: string, waveId: string) {
  await rerunRulesForWave(waveId);
  revalidatePath(wavePath(projectId, waveId));
  redirect(`${wavePath(projectId, waveId)}?saved=${encodeURIComponent("Zkontrolováno")}`);
}

export async function updateFindingStatus(
  projectId: string,
  waveId: string,
  findingId: string,
  status: FindingStatus
) {
  const session = await getServerSession(authOptions);
  await prisma.finding.update({
    where: { id: findingId },
    data: {
      status,
      resolvedAt: status === FindingStatus.OPEN ? null : new Date(),
      reviewedById: session?.user?.id,
    },
  });
  revalidatePath(wavePath(projectId, waveId));
  const message = status === FindingStatus.RESOLVED ? "Vyřešeno" : "Ignorováno";
  redirect(`${wavePath(projectId, waveId)}?saved=${encodeURIComponent(message)}`);
}

// ---------- Nastavení vlny: základní údaje ----------

export async function updateWaveInfo(projectId: string, waveId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const months = formData
    .getAll("months")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12)
    .sort((a, b) => a - b);

  if (!name) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Vyplňte název vlny.")}`);
  }

  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Rok vlny není platný.")}`);
  }

  await prisma.wave.update({ where: { id: waveId }, data: { name, year, months } });

  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(wavePath(projectId, waveId));
  revalidatePath(`/projects/${projectId}`);
  redirect(`${settingsPath(projectId, waveId)}?saved=1`);
}

// ---------- Nastavení vlny: scénáře ----------

async function copyRulesToScenario(sourceScenarioId: string, targetScenarioId: string) {
  const sourceRules = await prisma.rule.findMany({ where: { scenarioId: sourceScenarioId } });
  if (sourceRules.length === 0) return;

  await prisma.rule.createMany({
    data: sourceRules.map((rule) => ({
      scenarioId: targetScenarioId,
      type: rule.type,
      name: rule.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: rule.config as any,
      isActive: rule.isActive,
    })),
  });
}

export async function addScenario(projectId: string, waveId: string, formData: FormData) {
  const scenarioTemplateId = String(formData.get("scenarioTemplateId") || "").trim();
  const copyFromScenarioId = String(formData.get("copyFromScenarioId") || "").trim();

  if (!scenarioTemplateId) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Vyber šablonu scénáře.")}`);
  }

  let scenario;
  try {
    scenario = await prisma.scenario.create({ data: { waveId, scenarioTemplateId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(
        `${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Tenhle scénář už je ve vlně přidaný.")}`
      );
    }
    throw error;
  }

  if (copyFromScenarioId) {
    await copyRulesToScenario(copyFromScenarioId, scenario.id);
  }

  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(`/projects/${projectId}`);
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Scénář přidán")}`);
}

export async function createTemplateAndAddScenario(projectId: string, waveId: string, formData: FormData) {
  const templateName = String(formData.get("templateName") || "").trim();
  const copyFromScenarioId = String(formData.get("copyFromScenarioId") || "").trim();

  if (!templateName) {
    redirect(
      `${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Vyplňte název nové šablony scénáře.")}`
    );
  }

  let template;
  try {
    template = await prisma.scenarioTemplate.create({ data: { projectId, name: templateName } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(
        `${settingsPath(projectId, waveId)}?error=${encodeURIComponent(
          "Šablona s tímto názvem už v projektu existuje."
        )}`
      );
    }
    throw error;
  }

  const scenario = await prisma.scenario.create({ data: { waveId, scenarioTemplateId: template.id } });

  if (copyFromScenarioId) {
    await copyRulesToScenario(copyFromScenarioId, scenario.id);
  }

  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(`/projects/${projectId}`);
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Scénář přidán")}`);
}

/**
 * Uloží okno terénu SCÉNÁŘE a zároveň aktivitu všech jeho existujících
 * pravidel (checkboxy "Aktivní" v UI) v jednom submitu — ať se nemusí
 * ukládat každá drobná změna zvlášť. Přidání nového pravidla / smazání
 * existujícího jde přes formAction stejného formuláře na jiné akce
 * (createRule / deleteRule), viz WaveSettingsPage.
 */
export async function updateScenarioSettings(
  projectId: string,
  waveId: string,
  scenarioId: string,
  formData: FormData
) {
  const windowStart = String(formData.get("windowStart") || "").trim();
  const windowEnd = String(formData.get("windowEnd") || "").trim();

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: {
      data: {
        windowStart: windowStart || undefined,
        windowEnd: windowEnd || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
  });

  const rules = await prisma.rule.findMany({ where: { scenarioId }, select: { id: true } });
  await Promise.all(
    rules.map((rule) =>
      prisma.rule.update({
        where: { id: rule.id },
        data: { isActive: formData.has(`active_${rule.id}`) },
      })
    )
  );

  // okno terénu i (de)aktivace pravidel ovlivňuje kontrolu už naimportovaných návštěv
  await rerunRulesForScenario(scenarioId);

  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(wavePath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=1`);
}

export async function removeScenario(projectId: string, waveId: string, scenarioId: string) {
  const visitCount = await prisma.visit.count({ where: { scenarioId } });
  if (visitCount > 0) {
    redirect(
      `${settingsPath(projectId, waveId)}?error=${encodeURIComponent(
        "Tenhle scénář nejde smazat, mají k němu naimportované návštěvy."
      )}`
    );
  }

  await prisma.scenario.delete({ where: { id: scenarioId } });
  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(`/projects/${projectId}`);
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Scénář smazán")}`);
}

// ---------- Nastavení vlny: pravidla (per scénář) ----------

export async function createRule(projectId: string, waveId: string, scenarioId: string, formData: FormData) {
  const questionCode = String(formData.get("questionCode") || "").trim();
  const typeRaw = String(formData.get("type") || "");
  const allowedValueRaw = String(formData.get("allowedValue") || "").trim();

  if (!questionCode || !typeRaw) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Vyplňte kód otázky a typ.")}`);
  }

  if (!Object.values(RuleType).includes(typeRaw as RuleType)) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Neplatný typ pravidla.")}`);
  }
  const type = typeRaw as RuleType;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<string, any> = { questionCode };

  if (type === RuleType.ALLOWED_VALUES) {
    const values = allowedValueRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) {
      redirect(
        `${settingsPath(projectId, waveId)}?error=${encodeURIComponent(
          "U typu \"Povolené hodnoty\" zadej alespoň jednu hodnotu (odděl čárkou)."
        )}`
      );
    }
    config.allowedValues = values;
  }

  if (type === RuleType.NUMERIC_RANGE) {
    const match = allowedValueRaw.match(/^(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!match) {
      redirect(
        `${settingsPath(projectId, waveId)}?error=${encodeURIComponent(
          'U typu "Číselný rozsah" zadej rozsah ve formátu min-max, např. 0-180.'
        )}`
      );
    }
    config.min = Number(match[1].replace(",", "."));
    config.max = Number(match[2].replace(",", "."));
  }

  const name = `${questionCode} — ${RULE_TYPE_LABELS[type]}`;

  await prisma.rule.create({
    data: {
      scenarioId,
      type,
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: config as any,
    },
  });

  await rerunRulesForScenario(scenarioId);

  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(wavePath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Pravidlo přidáno")}`);
}

// Explicitní `_formData` parametr (i když se nečte) — použité přes `formAction`
// na tlačítku uvnitř společného formuláře se scénářem; bez tohoto parametru
// (0 zbývajících argumentů po .bind) se v testu ukázalo, že se akce
// přes formAction nespustí správně.
export async function deleteRule(projectId: string, waveId: string, ruleId: string, _formData: FormData) {
  await prisma.rule.delete({ where: { id: ruleId } });
  revalidatePath(settingsPath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Smazáno")}`);
}
