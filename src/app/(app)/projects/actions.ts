"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidProjectCode } from "@/lib/projectCode";
import { isValidLogoFile, fileToLogoDataUrl } from "@/lib/logo";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const client = String(formData.get("client") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const navigatorCode = String(formData.get("navigatorCode") || "").trim();
  const projectManager = String(formData.get("projectManager") || "").trim();
  const accountManager = String(formData.get("accountManager") || "").trim();
  const logoFile = formData.get("logo");

  if (!name || !client || !code || !projectManager || !accountManager) {
    redirect(
      `/projects/new?error=${encodeURIComponent(
        "Vyplňte název projektu, klienta, kód projektu, projektového manažera a account manažera."
      )}`
    );
  }

  if (!isValidProjectCode(code)) {
    redirect(
      `/projects/new?error=${encodeURIComponent("Kód projektu musí být ve formátu CZ26222 (písmena + rok + číslo).")}`
    );
  }

  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!isValidLogoFile(logoFile)) {
      redirect(`/projects/new?error=${encodeURIComponent("Logo musí být obrázek (max. 2 MB).")}`);
    }
    logoUrl = await fileToLogoDataUrl(logoFile);
  }

  let project;
  try {
    project = await prisma.project.create({
      data: {
        name,
        client,
        description: description || null,
        code,
        navigatorCode: navigatorCode || null,
        projectManager,
        accountManager,
        logoUrl,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/projects/new?error=${encodeURIComponent("Tento kód projektu už existuje u jiného projektu.")}`);
    }
    throw error;
  }

  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${project.id}?saved=1`);
}
