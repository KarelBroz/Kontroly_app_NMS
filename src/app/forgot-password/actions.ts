"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { generateResetToken } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/mail/sendMail";
import { getBaseUrl } from "@/lib/baseUrl";

const RESET_TOKEN_TTL_MINUTES = 60;

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();

  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Zadej e-mailovou adresu.")}`);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Ze security důvodů zobrazíme stejnou "odesláno" zprávu, i když účet s daným e-mailem neexistuje.
  if (user) {
    const { raw, hash } = generateResetToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    const resetUrl = `${getBaseUrl()}/reset-password?token=${raw}`;

    try {
      await sendMail({
        to: user.email,
        subject: "Kontroly MS — obnovení hesla",
        html: `<p>Ahoj${user.name ? " " + user.name : ""},</p>
<p>někdo (doufejme ty) požádal o obnovení hesla do appky Kontroly MS. Klikni na odkaz níže a nastav si nové heslo. Odkaz platí ${RESET_TOKEN_TTL_MINUTES} minut.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>Pokud jsi o obnovení hesla nežádal/a, tenhle e-mail jen ignoruj — heslo zůstane beze změny.</p>`,
        text: `Ahoj${user.name ? " " + user.name : ""},\n\nNěkdo požádal o obnovení hesla do appky Kontroly MS. Otevři tenhle odkaz a nastav si nové heslo (platí ${RESET_TOKEN_TTL_MINUTES} minut):\n${resetUrl}\n\nPokud jsi o to nežádal/a, e-mail ignoruj.`,
      });
    } catch (error) {
      // Neprozrazujeme uživateli, jestli e-mail reálně odešel (ochrana proti enumeraci účtů),
      // ale chybu si zalogujeme, ať to jde dohledat.
      console.error("Nepodařilo se odeslat e-mail pro obnovení hesla:", error);
    }
  }

  redirect("/forgot-password?sent=1");
}
