import type { ScenarioData } from "./types";

export type RealDateIssue =
  | { reason: "missing" }
  | { reason: "invalid"; raw: string }
  | { reason: "out_of_range"; raw: string };

const REAL_DATE_COLUMN = "RealDate";

/**
 * Vždy a všude (napříč všemi projekty/vlnami) kontroluje, že datum a čas
 * návštěvy (sloupec "RealDate" v importu) spadá do okna terénu scénáře
 * (Start terénu / Konec terénu). Běží automaticky, žádné ruční pravidlo
 * pro to netřeba — viz runRulesForVisit.
 */
export function checkRealDateWindow(
  visitData: Record<string, unknown>,
  scenario: ScenarioData | null
): RealDateIssue | null {
  if (!scenario || (!scenario.windowStart && !scenario.windowEnd)) return null;

  const raw = visitData[REAL_DATE_COLUMN];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { reason: "missing" };
  }

  const visitDate = new Date(String(raw));
  if (Number.isNaN(visitDate.getTime())) {
    return { reason: "invalid", raw: String(raw) };
  }

  const start = scenario.windowStart ? new Date(scenario.windowStart) : null;
  const end = scenario.windowEnd ? new Date(scenario.windowEnd) : null;
  const outOfRange = (start !== null && visitDate < start) || (end !== null && visitDate > end);

  if (outOfRange) {
    return { reason: "out_of_range", raw: String(raw) };
  }
  return null;
}

export function buildRealDateMessage(issue: RealDateIssue, scenario: ScenarioData | null): string {
  if (issue.reason === "missing") {
    return `Sloupec "${REAL_DATE_COLUMN}" v datech chybí nebo je prázdný — nejde ověřit den terénu.`;
  }
  if (issue.reason === "invalid") {
    return `Sloupec "${REAL_DATE_COLUMN}" ("${issue.raw}") nejde přečíst jako datum.`;
  }
  const from = scenario?.windowStart ? ` od ${new Date(scenario.windowStart).toLocaleString("cs-CZ")}` : "";
  const to = scenario?.windowEnd ? ` do ${new Date(scenario.windowEnd).toLocaleString("cs-CZ")}` : "";
  return `Datum návštěvy (${new Date(issue.raw).toLocaleString("cs-CZ")}) je mimo okno terénu${from}${to}.`;
}
