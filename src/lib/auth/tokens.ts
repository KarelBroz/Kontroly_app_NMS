import { createHash, randomBytes } from "crypto";

/** Vygeneruje syrový token (jde do e-mailového odkazu) a jeho hash (jde do DB). */
export function generateResetToken() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
