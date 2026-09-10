"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { generateSixDigitCode, hashToken } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/mail/sendMail";

const ALLOWED_EMAIL_DOMAIN = "@nms.eu";
const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

async function sendVerificationCode(email: string, name: string, code: string) {
  await sendMail({
    to: email,
    subject: "Kontroly MS — ověřovací kód pro registraci",
    html: `<p>Ahoj${name ? " " + name : ""},</p>
<p>pro dokončení registrace do appky Kontroly MS opiš do formuláře tenhle ověřovací kód. Platí ${CODE_TTL_MINUTES} minut.</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
<p>Pokud jsi o registraci nežádal/a, tenhle e-mail jen ignoruj.</p>`,
    text: `Ahoj${name ? " " + name : ""},\n\nOvěřovací kód pro dokončení registrace do appky Kontroly MS (platí ${CODE_TTL_MINUTES} minut):\n${code}\n\nPokud jsi o registraci nežádal/a, e-mail ignoruj.`,
  });
}

export async function registerUser(formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
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

  // Předem povolený e-mail (nastaveno ručně na /users) — identitu v tomhle
  // případě ověřil člověk, co adresu přidal, takže se účet založí rovnou
  // bez ověřovacího kódu.
  const allowed = await prisma.allowedRegistrationEmail.findUnique({ where: { email } });
  if (allowed) {
    try {
      await prisma.user.create({ data: { email, name, passwordHash } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        redirect(`/register?error=${encodeURIComponent("Uživatel s tímto e-mailem už existuje.")}`);
      }
      throw error;
    }
    redirect("/login?registered=1");
  }

  const code = generateSixDigitCode();

  // upsert podle e-mailu — nová registrace stejné adresy jednoduše nahradí předchozí nedokončenou.
  await prisma.pendingRegistration.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      codeHash: hashToken(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
    update: {
      name,
      passwordHash,
      codeHash: hashToken(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  try {
    await sendVerificationCode(email, name, code);
  } catch (error) {
    console.error("Nepodařilo se odeslat ověřovací kód při registraci:", error);
    redirect(
      `/register?error=${encodeURIComponent(
        "Nepodařilo se odeslat ověřovací e-mail. Zkus registraci prosím znovu."
      )}`
    );
  }

  redirect(`/register/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyRegistrationCode(formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  const code = String(formData.get("code") || "").trim();

  const notFoundError = (): never =>
    redirect(
      `/register?error=${encodeURIComponent(
        "Registrace vypršela nebo neexistuje. Zaregistruj se prosím znovu."
      )}`
    );

  if (!email) notFoundError();

  const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (!pending) notFoundError();
  if (!pending) return; // typová hlídka — notFoundError() vždy redirectuje (never)

  if (pending.expiresAt < new Date()) {
    await prisma.pendingRegistration.delete({ where: { id: pending.id } });
    redirect(`/register?error=${encodeURIComponent("Kód vypršel. Zaregistruj se prosím znovu.")}`);
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await prisma.pendingRegistration.delete({ where: { id: pending.id } });
    redirect(`/register?error=${encodeURIComponent("Příliš mnoho pokusů. Zaregistruj se prosím znovu.")}`);
  }

  if (!code || hashToken(code) !== pending.codeHash) {
    const attempts = pending.attempts + 1;
    await prisma.pendingRegistration.update({ where: { id: pending.id }, data: { attempts } });
    const remaining = MAX_ATTEMPTS - attempts;
    redirect(
      `/register/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        remaining > 0 ? `Nesprávný kód. Zbývá ${remaining} ${remaining === 1 ? "pokus" : "pokusy"}.` : "Nesprávný kód."
      )}`
    );
  }

  try {
    await prisma.user.create({
      data: { email: pending.email, name: pending.name, passwordHash: pending.passwordHash },
    });
  } catch {
    // Race condition (paralelní registrace / dvojklik) — účet už existuje, prostě to necháme dojít na login.
  }

  await prisma.pendingRegistration.delete({ where: { id: pending.id } });

  redirect("/login?registered=1");
}

export async function resendRegistrationCode(formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();

  const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (!pending) {
    redirect(
      `/register?error=${encodeURIComponent(
        "Registrace vypršela nebo neexistuje. Zaregistruj se prosím znovu."
      )}`
    );
  }

  const code = generateSixDigitCode();
  await prisma.pendingRegistration.update({
    where: { id: pending.id },
    data: {
      codeHash: hashToken(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  try {
    await sendVerificationCode(pending.email, pending.name, code);
  } catch (error) {
    console.error("Nepodařilo se znovu odeslat ověřovací kód:", error);
    redirect(
      `/register/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        "Nepodařilo se odeslat nový kód, zkus to prosím za chvíli znovu."
      )}`
    );
  }

  redirect(`/register/verify?email=${encodeURIComponent(email)}&sent=1`);
}
