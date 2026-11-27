/**
 * Odkaz do systému Navigátor na konkrétní návštěvu — a pokud nález patří ke
 * konkrétní otázce, rovnou i na tu otázku (stránka se sama zaroluje). Vzor:
 * https://navigator.nms.eu/main/inspection/show-control/inspectionId/339540/projectId/214?useFallbackRedirect=1#question-i08t-identifier
 *
 * - inspectionId = ID návštěvy (shodné s ID z import excelu)
 * - projectId = Kód projektu Navigátor (Project.navigatorCode) — stejný
 *   napříč celým projektem, nastavuje se v Upravit projekt
 * - #question-<kód otázky>-identifier = nepovinné, jen když nález patří ke
 *   konkrétní otázce (ne třeba u kontroly data terénu)
 */
/**
 * Další kódy Navigátoru z formuláře ("1234, 5678" / mezery / středníky).
 * Vrací kódy bez duplicit a bez hlavního kódu, nebo chybovou hlášku, když
 * některý kód není číslo.
 */
export function parseExtraNavigatorCodes(
  raw: string,
  primaryCode: string
): { codes: string[]; error?: undefined } | { codes?: undefined; error: string } {
  const codes = Array.from(new Set(raw.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean))).filter(
    (c) => c !== primaryCode.trim()
  );
  const invalid = codes.filter((c) => !/^\d+$/.test(c));
  if (invalid.length > 0) {
    return { error: `Další kód Navigátor musí být číslo (chybně: ${invalid.join(", ")}).` };
  }
  return { codes };
}

export function buildNavigatorUrl(
  inspectionId: string,
  navigatorProjectCode: string,
  questionCode?: string | null
): string {
  const base = `https://navigator.nms.eu/main/inspection/show-control/inspectionId/${encodeURIComponent(
    inspectionId
  )}/projectId/${encodeURIComponent(navigatorProjectCode)}?useFallbackRedirect=1`;
  const code = questionCode?.trim();
  return code ? `${base}#question-${code.toLowerCase()}-identifier` : base;
}
