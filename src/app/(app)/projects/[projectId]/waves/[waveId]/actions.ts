"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importVisitsFromFile } from "@/lib/import/importVisits";
import { rerunRulesForWave } from "@/lib/rules/runRules";
import { RuleType, FindingStatus } from "@prisma/client";

function wavePath(projectId: string, waveId: string) {
  return `/projects/${projectId}/waves/${waveId}`;
}

export async function updateScenario(projectId: string, waveId: string, formData: FormData) {
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

  await prisma.wave.update({
    where: { id: waveId },
    data: {
      scenario: {
        expectedBranch: expectedBranch || undefined,
        windowStart: windowStart || undefined,
        windowEnd: windowEnd || undefined,
        keyQuestions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
  });

  revalidatePath(wavePath(projectId, waveId));
}

export async function importWaveFile(projectId: string, waveId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${wavePath(projectId, waveId)}?error=${encodeURIComponent("Vyber soubor (.xlsx nebo .csv).")}`);
  }

  const arrayBuffer = await (file as File).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await importVisitsFromFile({
    waveId,
    fileName: (file as File).name,
    buffer,
    uploadedById: session?.user?.id,
  });

  revalidatePath(wavePath(projectId, waveId));
  redirect(
    `${wavePath(projectId, waveId)}?imported=${result.rowsNew}-${result.rowsSkipped}-${result.rowsRechecked}`
  );
}

export async function createRule(projectId: string, waveId: string, formData: FormData) {
  const typeRaw = String(formData.get("type") || "");
  const name = String(formData.get("name") || "").trim();
  const configRaw = String(formData.get("config") || "{}").trim();

  if (!name || !typeRaw) {
    redirect(`${wavePath(projectId, waveId)}?error=${encodeURIComponent("Vyplňte název a typ pravidla.")}`);
  }

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(configRaw || "{}");
  } catch {
    redirect(`${wavePath(projectId, waveId)}?error=${encodeURIComponent("Konfigurace pravidla není platný JSON.")}`);
  }

  await prisma.rule.create({
    data: {
      waveId,
      type: typeRaw as RuleType,
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: config as any,
    },
  });

  revalidatePath(wavePath(projectId, waveId));
}

export async function toggleRule(projectId: string, waveId: string, ruleId: string, isActive: boolean) {
  await prisma.rule.update({ where: { id: ruleId }, data: { isActive } });
  revalidatePath(wavePath(projectId, waveId));
}

export async function deleteRule(projectId: string, waveId: string, ruleId: string) {
  await prisma.rule.delete({ where: { id: ruleId } });
  revalidatePath(wavePath(projectId, waveId));
}

export async function rerunWave(projectId: string, waveId: string) {
  await rerunRulesForWave(waveId);
  revalidatePath(wavePath(projectId, waveId));
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
}
