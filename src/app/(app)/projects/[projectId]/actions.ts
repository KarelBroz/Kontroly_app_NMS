"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidProjectCode } from "@/lib/projectCode";

export async function createWave(projectId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const months = formData
    .getAll("months")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12)
    .sort((a, b) => a - b);

  if (!name) {
    redirect(`/projects/${projectId}?error=${encodeURIComponent("Vyplňte název vlny.")}`);
  }

  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    redirect(`/projects/${projectId}?error=${encodeURIComponent("Rok vlny není platný.")}`);
  }

  const wave = await prisma.wave.create({ data: { projectId, name, year, months } });

  revalidatePath(`/projects/${projectId}`);
  // Po založení vlny je potřeba nejdřív nastavit scénář(e) - bez něj nejde nic importovat.
  redirect(`/projects/${projectId}/waves/${wave.id}/settings`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const client = String(formData.get("client") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const projectManager = String(formData.get("projectManager") || "").trim();
  const accountManager = String(formData.get("accountManager") || "").trim();

  if (!name || !client || !code || !projectManager || !accountManager) {
    redirect(
      `/projects/${projectId}?error=${encodeURIComponent(
        "Vyplňte název projektu, klienta, kód projektu, projektového manažera a account manažera."
      )}`
    );
  }

  if (!isValidProjectCode(code)) {
    redirect(
      `/projects/${projectId}?error=${encodeURIComponent(
        "Kód projektu musí být ve formátu CZ26222 (písmena + rok + číslo)."
      )}`
    );
  }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { name, client, description: description || null, code, projectManager, accountManager },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(
        `/projects/${projectId}?error=${encodeURIComponent("Tento kód projektu už existuje u jiného projektu.")}`
      );
    }
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function createScenarioTemplate(projectId: string, formData: FormData) {
  const name = String(formData.get("templateName") || "").trim();

  if (!name) {
    redirect(`/projects/${projectId}?error=${encodeURIComponent("Vyplňte název šablony scénáře.")}`);
  }

  try {
    await prisma.scenarioTemplate.create({ data: { projectId, name } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(
        `/projects/${projectId}?error=${encodeURIComponent("Šablona s tímto názvem už v projektu existuje.")}`
      );
    }
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
}
