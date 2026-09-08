"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { hashToken } from "@/lib/auth/tokens";

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");

  if (!token) {
    redirect(`/forgot-password?error=${encodeURIComponent("Odkaz pro obnovení hesla není platný.")}`);
  }

  if (!password || password.length < 8) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
        "Heslo musí mít alespoň 8 znaků."
      )}`
    );
  }

  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  const isValid = !!resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date();

  if (!isValid || !resetToken) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(
        "Odkaz pro obnovení hesla vypršel nebo už byl použitý. Vyžádej si prosím nový."
      )}`
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    // ostatní nepoužité tokeny stejného uživatele zneplatníme
    prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId, id: { not: resetToken.id }, usedAt: null },
    }),
  ]);

  redirect("/login?resetDone=1");
}
