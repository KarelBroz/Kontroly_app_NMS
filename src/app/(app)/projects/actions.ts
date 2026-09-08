"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const client = String(formData.get("client") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!name || !client) {
    redirect(`/projects?error=${encodeURIComponent("Vyplňte název projektu a klienta.")}`);
  }

  const project = await prisma.project.create({
    data: { name, client, description: description || null },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
