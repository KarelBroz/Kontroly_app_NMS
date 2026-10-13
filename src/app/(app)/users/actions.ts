"use server";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Prisma, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const ALLOWED_EMAIL_DOMAIN = "@nms.eu";

export async function addAllowedEmail(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  const note = String(formData.get("note") || "").trim();

  if (!/^[^\s@]+@nms\.eu$/.test(email)) {
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
  await requireAdmin();
  await prisma.allowedRegistrationEmail.delete({ where: { id } });
  revalidatePath("/users");
  redirect(`/users?saved=${encodeURIComponent("Odebráno")}`);
}

/**
 * Změní roli uživatele (USER <-> ADMIN). Sám sobě admin roli odebrat nemůže,
 * ať v appce vždycky zůstane aspoň jeden admin. Změna role zneplatní
 * stávající přihlášení dotyčného (sessionVersion).
 */
export async function setUserRole(userId: string, role: UserRole, _formData: FormData) {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    redirect(`/users?error=${encodeURIComponent("Vlastní roli si změnit nemůžeš.")}`);
  }

  await prisma.user.update({ where: { id: userId }, data: { role, sessionVersion: { increment: 1 } } });
  revalidatePath("/users");
  redirect(`/users?saved=${encodeURIComponent("Role změněna")}`);
}

/**
 * Odebere uživateli přístup — smaže účet. Jeho importy, vyřešené nálezy
 * a nahlášené chyby zůstanou, jen už u nich nebude uvedený autor.
 */
export async function deleteUser(userId: string, _formData: FormData) {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    redirect(`/users?error=${encodeURIComponent("Vlastní účet smazat nemůžeš.")}`);
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/users");
  redirect(`/users?saved=${encodeURIComponent("Přístup odebrán")}`);
}
