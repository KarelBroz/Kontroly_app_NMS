import { createHash } from "crypto";

/**
 * Stabilní hash obsahu řádku (nezávislý na pořadí klíčů) — použitý
 * k detekci, jestli se obsah návštěvy mezi importy změnil. Datumy se
 * počítají jako ISO řetězec.
 */
export function hashRowData(data: Record<string, unknown>): string {
  return sha256(stableStringify(data));
}

/**
 * Hash tak, jak se počítal do 11/2026: datum (objekt Date) se omylem
 * hashovalo jako prázdný objekt {}, takže změna jen v datu/čase nebyla
 * poznat. Používá se jen k rozpoznání návštěv naimportovaných dřív (viz
 * importVisits) — aby se kvůli opravě hashe nepřekontrolovaly všechny.
 */
export function legacyHashRowData(data: Record<string, unknown>): string {
  return sha256(JSON.stringify(sortKeysDeep(data, true)));
}

/** JSON se seřazenými klíči — pro porovnání obsahu nezávisle na pořadí. */
export function stableStringify(data: unknown): string {
  return JSON.stringify(sortKeysDeep(data, false));
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function sortKeysDeep(value: unknown, legacyDates: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v, legacyDates));
  }
  if (value instanceof Date && !legacyDates) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key], legacyDates);
        return acc;
      }, {});
  }
  return value;
}
