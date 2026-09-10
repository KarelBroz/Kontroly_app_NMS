"use server";

import { prisma } from "@/lib/prisma";
import { Prisma, RuleType, FindingStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importVisitsFromFile } from "@/lib/import/importVisits";
import { rerunRulesForWave } from "@/lib/rules/runRules";

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
    fileName: (file as File).name,
    buffer,
    uploadedById: session?.user?.id,
  });

  revalidatePath(wavePath(projectId, waveId));
  redirect(
    `${wavePath(projectId, waveId)}?imported=${result.rowsNew}-${result.rowsSkipped}-${result.rowsRechecked}`
  );
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
  await prisma.finding.update({
    where: { id: findingId },
    data: { status, resolvedAt: status === FindingStatus.OPEN ? null : new Date() },
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

export async function updateScenarioData(
  projectId: string,
  waveId: string,
  scenarioId: string,
  formData: FormData
) {
  const expectedBranch = String(formData.get("expectedBranch") || "").trim();
  const windowStart = String(formData.get("windowStart") || "").trim();
  const windowEnd = String(formData.get("windowEnd") || "").trim();
  const keyQuestionsRaw = String(formData.get("keyQuestions") || "").trim();

  const keyQuestions = keyQuestionsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [question, expectedAnswer] = line.split("|").map((part) => part?.trim() ?? "");
      return { question, expectedAnswer: expectedAnswer ?? "" };
    })
    .filter((item) => item.question);

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: {
      data: {
        expectedBranch: expectedBranch || undefined,
        windowStart: windowStart || undefined,
        windowEnd: windowEnd || undefined,
        keyQuestions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
  });

  revalidatePath(settingsPath(projectId, waveId));
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
  const typeRaw = String(formData.get("type") || "");
  const name = String(formData.get("name") || "").trim();
  const configRaw = String(formData.get("config") || "{}").trim();

  if (!name || !typeRaw) {
    redirect(`${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Vyplňte název a typ pravidla.")}`);
  }

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(configRaw || "{}");
  } catch {
    redirect(
      `${settingsPath(projectId, waveId)}?error=${encodeURIComponent("Konfigurace pravidla není platný JSON.")}`
    );
  }

  await prisma.rule.create({
    data: {
      scenarioId,
      type: typeRaw as RuleType,
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: config as any,
    },
  });

  revalidatePath(settingsPath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Pravidlo přidáno")}`);
}

export async function toggleRule(projectId: string, waveId: string, ruleId: string, isActive: boolean) {
  await prisma.rule.update({ where: { id: ruleId }, data: { isActive } });
  revalidatePath(settingsPath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=1`);
}

export async function deleteRule(projectId: string, waveId: string, ruleId: string) {
  await prisma.rule.delete({ where: { id: ruleId } });
  revalidatePath(settingsPath(projectId, waveId));
  redirect(`${settingsPath(projectId, waveId)}?saved=${encodeURIComponent("Smazáno")}`);
}
