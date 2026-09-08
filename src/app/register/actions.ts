"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function registerUser(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password || password.length < 8) {
    redirect(`/register?error=${encodeURIComponent("Vyplňte e-mail a heslo (min. 8 znaků).")}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/register?error=${encodeURIComponent("Uživatel s tímto e-mailem už existuje.")}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, name: name || null, passwordHash } });

  redirect("/login?registered=1");
}
