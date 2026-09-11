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

  // Opakující se týdenní rozvrh (mimo špička / špička apod.) — den 1-7
  // (po-ne), zaškrtnutý přes weeklyDay_<den>, s hodinovým rozmezím
  // weeklyStart_<den>/weeklyEnd_<den>. Nezaškrtnuté dny (např. neděle)
  // se do rozvrhu vůbec nedostanou — návštěva v ten den tak vždy spadne
  // mimo okno, viz checkRealDateWindow.
  const weeklyWindows: { day: number; startHour: number; endHour: number }[] = [];
  for (let day = 1; day <= 7; day++) {
    if (!formData.has(`weeklyDay_${day}`)) continue;
    const startHour = Number(formData.get(`weeklyStart_${day}`));
    const endHour = Number(formData.get(`weeklyEnd_${day}`));
    if (Number.isFinite(startHour) && Number.isFinite(endHour) && endHour > startHour) {
      weeklyWindows.push({ day, startHour, endHour });
    }
  }

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: {
      data: {
        windowStart: windowStart || undefined,
        windowEnd: windowEnd || undefined,
        weeklyWindows: weeklyWindows.length > 0 ? weeklyWindows : undefined,
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

/**
 * Sestaví config pro dané RuleType z jednoho textového pole "hodnota" —
 * formát pole se liší podle typu (viz dynamická nápověda v RuleTypeField):
 * - ALLOWED_VALUES / PRODUCT_ALLOWLIST: "hodnota1, hodnota2, ..."
 * - NUMERIC_RANGE: "min-max", např. "0-180"
 * - CONDITIONAL_REQUIRED: "hodnota -> KÓD_DOPLŇUJÍCÍ_OTÁZKY", např. "Ano -> SCO1j"
 * Sdílené mezi createRule (jedno pravidlo přes formulář) a bulkCreateRules
 * (víc pravidel najednou přes vložený seznam řádků).
 */
function buildRuleConfig(
  type: RuleType,
  questionCode: string,
  valueRaw: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { config: Record<string, any>; error: string | null } {
  const config: Record<string, unknown> = { questionCode };

  if (type === RuleType.ALLOWED_VALUES || type === RuleType.PRODUCT_ALLOWLIST) {
    const values = valueRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) {
      const label = type === RuleType.ALLOWED_VALUES ? "Povolené hodnoty" : "Povolený seznam artiklů";
      return { config, error: `U typu "${label}" zadej alespoň jednu hodnotu (odděl čárkou).` };
    }
    if (type === RuleType.ALLOWED_VALUES) config.allowedValues = values;
    else config.allowedProducts = values;
  }

  if (type === RuleType.NUMERIC_RANGE) {
    const match = valueRaw.match(/^(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!match) {
      return { config, error: 'U typu "Číselný rozsah" zadej rozsah ve formátu min-max, např. 0-180.' };
    }
    config.min = Number(match[1].replace(",", "."));
    config.max = Number(match[2].replace(",", "."));
  }

  if (type === RuleType.CONDITIONAL_REQUIRED) {
    const match = valueRaw.match(/^(.+?)\s*->\s*(.+)$/);
    if (!match) {
      return {
        config,
        error: 'U typu "Podmíněně povinné" zadej ve formátu hodnota -> KÓD_OTÁZKY, např. "Ano -> SCO1j".',
      };
    }
    config.notEqualsValue = match[1].trim();
    config.detailQuestionCode = match[2].trim();
  }

  if (type === RuleType.NUMERIC_THRESHOLD_CONSISTENCY) {
    const match = valueRaw.match(/^(-?\d+(?:[.,]\d+)?)\s*->\s*([^:]+):\s*(.+?)\s*\/\s*(.+)$/);
    if (!match) {
      return {
        config,
        error:
          'U typu "Prahová shoda čísla a odpovědi" zadej ve formátu práh -> KÓD_OTÁZKY: hodnota_do_prahu / hodnota_nad_prahem, např. "3 -> I07: Ano / Ne".',
      };
    }
    config.threshold = Number(match[1].replace(",", "."));
    config.booleanQuestionCode = match[2].trim();
    config.valueAtOrBelow = match[3].trim();
    config.valueAbove = match[4].trim();
  }

  return { config, error: null };
}

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

  const { config, error } = buildRuleConfig(type, questionCode, allowedValueRaw);
  if (error) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent(error)}`);
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

/**
 * Hromadné přidání víc pravidel najednou — jeden řádek = jedno pravidlo,
 * formát "TYP|KÓD_OTÁZKY|hodnota" (hodnota podle typu, viz buildRuleConfig).
 * Typ je název RuleType (REQUIRED/ALLOWED_VALUES/NUMERIC_RANGE/
 * CONDITIONAL_REQUIRED/PRODUCT_ALLOWLIST). Pro REQUIRED se třetí část
 * ignoruje/vynechává.
 */
export async function bulkCreateRules(projectId: string, waveId: string, scenarioId: string, formData: FormData) {
  const raw = String(formData.get("bulkRules") || "").trim();
  if (!raw) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Vlož alespoň jeden řádek pravidla.")}`);
  }

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toCreate: { scenarioId: string; type: RuleType; name: string; config: any }[] = [];
  const errors: string[] = [];

  lines.forEach((line, i) => {
    const parts = line.split("|").map((p) => p.trim());
    const [typeRaw, questionCode, valueRaw = ""] = parts;
    if (!typeRaw || !questionCode) {
      errors.push(`Řádek ${i + 1}: chybí typ nebo kód otázky.`);
      return;
    }
    if (!Object.values(RuleType).includes(typeRaw as RuleType)) {
      errors.push(`Řádek ${i + 1}: neplatný typ "${typeRaw}".`);
      return;
    }
    const type = typeRaw as RuleType;
    const { config, error } = buildRuleConfig(type, questionCode, valueRaw);
    if (error) {
      errors.push(`Řádek ${i + 1} (${questionCode}): ${error}`);
      return;
    }
    toCreate.push({ scenarioId, type, name: `${questionCode} — ${RULE_TYPE_LABELS[type]}`, config });
  });

  if (errors.length > 0) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent(errors.join(" | "))}`);
  }

  await prisma.rule.createMany({ data: toCreate });
  await rerunRulesForScenario(scenarioId);

  revalidatePath(settingsPath(projectId, waveId));
  revalidatePath(wavePath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent(`${toCreate.length} pravidel přidáno`)}`);
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
