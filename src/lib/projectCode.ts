/**
 * Kód projektu má formát např. "CZ26222" — písmenný prefix ("CZ") + první dvě
 * číslice = rok ("26" -> 2026) + zbytek (pořadové číslo). Kontrola, jestli kód
 * odpovídá aktuálnímu roku, je čistě zobrazovací (žádný cron) — spočítá se při
 * každém vykreslení stránky, takže upozornění se objeví samo od 1. ledna dál.
 */

export interface ParsedProjectCode {
  prefix: string;
  yearYY: string;
  rest: string;
}

const CODE_PATTERN = /^([A-Za-z]+)(\d{2})(\d+)$/;

export function parseProjectCode(code: string): ParsedProjectCode | null {
  const match = code.trim().match(CODE_PATTERN);
  if (!match) return null;
  return { prefix: match[1].toUpperCase(), yearYY: match[2], rest: match[3] };
}

export function isValidProjectCode(code: string): boolean {
  return parseProjectCode(code) !== null;
}

export function currentYearSuffix(date: Date = new Date()): string {
  return String(date.getFullYear() % 100).padStart(2, "0");
}

/** Vrátí kód přepočítaný na aktuální rok, nebo null, když se kód nedá rozparsovat. */
export function suggestedProjectCode(code: string, date: Date = new Date()): string | null {
  const parsed = parseProjectCode(code);
  if (!parsed) return null;
  return `${parsed.prefix}${currentYearSuffix(date)}${parsed.rest}`;
}

/** True, když rok zakódovaný v kódu neodpovídá aktuálnímu roku (needs update). */
export function isProjectCodeStale(code: string, date: Date = new Date()): boolean {
  const parsed = parseProjectCode(code);
  if (!parsed) return false;
  return parsed.yearYY !== currentYearSuffix(date);
}
