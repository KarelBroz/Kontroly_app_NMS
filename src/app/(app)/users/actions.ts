"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const ALLOWED_EMAIL_DOMAIN = "@nms.eu";

export async function addAllowedEmail(formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  const note = String(formData.get("note") || "").trim();

  if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
    redirect(`/users?error=${encodeURIComponent(`E-mail musí končit na ${ALLOWED_EMAIL_DOMAIN}.`)}`);
  }

  try {
    await prisma.allowedRegistrationEmail.create({ data: { email, note: note || null } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/users?error=${encodeURIComponent("Tenhle e-mail už je na seznamu povolených.")}`);
    }
    throw error;
  }

  revalidatePath("/users");
  redirect(`/users?saved=${encodeURIComponent("E-mail přidán")}`);
}

export async function removeAllowedEmail(id: string, _formData: FormData) {
  await prisma.allowedRegistrationEmail.delete({ where: { id } });
  revalidatePath("/users");
  redirect(`/users?saved=${encodeURIComponent("Odebráno")}`);
}
