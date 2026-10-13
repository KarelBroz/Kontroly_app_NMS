import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Jednoduché omezení počtu pokusů nad databází (bez Redisu) — proti
 * zkoušení hesel hrubou silou a zahlcení e-maily. Každý pokus se zapíše
 * jako RateLimitHit s klíčem (např. "login:email:jan@nms.eu"); když jich
 * je v daném okně moc, akce se odmítne.
 */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  return count >= limit;
}

export async function recordHit(key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { key } });

  // Průběžný úklid — zhruba každý 50. zápis smaže záznamy starší než den
  // (nejdelší okno je hodina, takže starší už nic neovlivní).
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }
}

export async function clearHits(key: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { key } });
}

/**
 * Ověří limit a rovnou zapíše pokus. Vrací true, když je akce povolená.
 * Pro akce, kde se počítá každý pokus (registrace, žádost o reset hesla).
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (await isRateLimited(key, limit, windowMs)) return false;
  await recordHit(key);
  return true;
}

/** IP adresa klienta — na Vercelu ji spolehlivě nastavuje x-forwarded-for (první adresa). */
export function ipFromHeaders(getHeader: (name: string) => string | null | undefined): string {
  const forwarded = getHeader("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || getHeader("x-real-ip") || "unknown";
}

/** IP adresa klienta uvnitř server action / server komponenty. */
export function currentIp(): string {
  const h = headers();
  return ipFromHeaders((name) => h.get(name));
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
