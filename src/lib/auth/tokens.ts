import { createHash, randomBytes, randomInt } from "crypto";

/** Vygeneruje syrový token (jde do e-mailového odkazu) a jeho hash (jde do DB). */
export function generateResetToken() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Kryptograficky bezpečný 6místný číselný kód (např. pro ověření e-mailu při registraci). */
export function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
