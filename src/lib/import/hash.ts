import { createHash } from "crypto";

/**
 * Stabilní hash obsahu řádku (nezávislý na pořadí klíčů) — použitý
 * k detekci, jestli se obsah návštěvy mezi importy změnil.
 */
export function hashRowData(data: Record<string, unknown>): string {
  const stable = JSON.stringify(sortKeysDeep(data));
  return createHash("sha256").update(stable).digest("hex");
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}
