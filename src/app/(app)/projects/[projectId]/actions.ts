"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createWave(projectId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    redirect(`/projects/${projectId}?error=${encodeURIComponent("Vyplňte název vlny.")}`);
  }

  const wave = await prisma.wave.create({ data: { projectId, name } });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/waves/${wave.id}`);
}
