"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

const ALLOWED_EMAIL_DOMAIN = "@nms.eu";

export async function registerUser(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
    redirect(
      `/register?error=${encodeURIComponent(
        `Registrace je možná pouze s NMS e-mailovou adresou (${ALLOWED_EMAIL_DOMAIN}).`
      )}`
    );
  }

  if (!firstName || !lastName || !password || password.length < 8) {
    redirect(`/register?error=${encodeURIComponent("Vyplň jméno, příjmení a heslo (min. 8 znaků).")}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/register?error=${encodeURIComponent("Uživatel s tímto e-mailem už existuje.")}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const name = `${firstName} ${lastName}`.trim();

  await prisma.user.create({ data: { email, name, passwordHash } });

  redirect("/login?registered=1");
}
