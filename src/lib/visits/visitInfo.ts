// Pomocné čtení "hlavičkových" údajů návštěvy z importovaných dat (klíč = název
// sloupce). Jména sloupců se porovnávají tolerantně (velikost písmen, mezery
// kolem dvojtečky), ať drobná odchylka v hlavičce importu nic nerozbije.

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/\s*:\s*/g, ":").trim();
}

function readValue(data: Record<string, unknown>, wantedKey: string): string {
  for (const [key, value] of Object.entries(data)) {
    if (normalizeKey(key) !== wantedKey) continue;
    const text = value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
}

/** Jméno shoppera (mystery shopper) — sloupce "MS: Firstname" / "MS: Surname". Prázdný řetězec, když chybí. */
export function shopperName(data: Record<string, unknown>): string {
  return [readValue(data, "ms:firstname"), readValue(data, "ms:surname")].filter(Boolean).join(" ");
}

/** Název pobočky — sloupec "Name" (např. "326 - Lidl, Znojmo"). Prázdný řetězec, když chybí. */
export function branchName(data: Record<string, unknown>): string {
  return readValue(data, "name");
}
