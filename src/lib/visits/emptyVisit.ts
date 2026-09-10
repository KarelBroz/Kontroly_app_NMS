// Pomocné sloupce, které se při rozhodování "má tahle návštěva vůbec nějaké
// odpovědi?" ignorují — samy o sobě neznamenají, že MS proběhlo.
const IGNORED_COLUMNS = new Set(["inspectionid", "realdate"]);

/**
 * True, když návštěva nemá vyplněnou žádnou skutečnou odpověď — typicky MS
 * bylo v systému založené, ale terén ještě neproběhl. Takové řádky appka
 * v přehledu nálezů zobrazuje šedě a úplně dole, ať nepřekáží u skutečných
 * chyb.
 */
export function isVisitDataEmpty(data: Record<string, unknown>): boolean {
  return Object.entries(data).every(([key, value]) => {
    if (IGNORED_COLUMNS.has(key.trim().toLowerCase())) return true;
    return value === null || value === undefined || String(value).trim() === "";
  });
}
