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
