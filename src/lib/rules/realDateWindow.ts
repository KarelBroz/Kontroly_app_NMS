import type { ScenarioData, WeeklyWindow } from "./types";

const DAY_NAMES_CZ = ["", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];

function formatHour(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, "");
}

function formatWeeklyWindows(windows: WeeklyWindow[]): string {
  return windows
    .slice()
    .sort((a, b) => a.day - b.day || a.startHour - b.startHour)
    .map((w) => `${DAY_NAMES_CZ[w.day] ?? `den ${w.day}`} ${formatHour(w.startHour)}–${formatHour(w.endHour)}`)
    .join(", ");
}

export type RealDateIssue =
  | { reason: "missing" }
  | { reason: "invalid"; raw: string }
  | { reason: "out_of_range"; raw: string; parsed: string }
  | { reason: "outside_weekly_window"; raw: string; parsed: string; windows: WeeklyWindow[] };

const REAL_DATE_COLUMN = "RealDate";

/** Excelí sériové datum (den 0 = 30. 12. 1899, kvůli chybě s rokem 1900 jako přestupným) na JS Date. */
function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(
    Date.UTC(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate(), hours, minutes, seconds)
  );
}

/**
 * RealDate obvykle přijde jako JS Date (díky cellDates:true v importu —
 * viz src/lib/import/excelCsvImportSource.ts), ale pro jistotu umí přečíst
 * i syrové Excelí sériové číslo (např. "46037.41666666666"), kdyby se
 * cestou převedlo na text/číslo místo skutečného data.
 */
function parseFlexibleDate(raw: unknown): Date | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  if (typeof raw === "number") {
    return excelSerialToDate(raw);
  }

  const str = String(raw).trim();
  if (!str) return null;

  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    // cca roky 1949–2099 jako Excel sériové datum
    if (serial > 18000 && serial < 73000) {
      return excelSerialToDate(serial);
    }
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
  const weeklyWindows = scenario?.weeklyWindows ?? [];
  if (!scenario || (!scenario.windowStart && !scenario.windowEnd && weeklyWindows.length === 0)) return null;

  const raw = visitData[REAL_DATE_COLUMN];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { reason: "missing" };
  }

  const visitDate = parseFlexibleDate(raw);
  if (!visitDate) {
    return { reason: "invalid", raw: String(raw) };
  }

  const start = scenario.windowStart ? new Date(scenario.windowStart) : null;
  const end = scenario.windowEnd ? new Date(scenario.windowEnd) : null;
  const outOfRange = (start !== null && visitDate < start) || (end !== null && visitDate > end);

  if (outOfRange) {
    return { reason: "out_of_range", raw: String(raw), parsed: visitDate.toISOString() };
  }

  // Opakující se týdenní rozvrh (např. "mimo špička" / "špička") — datum a
  // čas se čtou jako UTC složky (stejná konvence jako excelSerialToDate:
  // Date reprezentuje "nástěnný" čas z buňky, ne skutečný okamžik v UTC).
  if (weeklyWindows.length > 0) {
    const day = ((visitDate.getUTCDay() + 6) % 7) + 1; // JS getUTCDay(): 0=Ne..6=So -> 1=Po..7=Ne
    const hour = visitDate.getUTCHours() + visitDate.getUTCMinutes() / 60;
    const matches = weeklyWindows.some((w) => w.day === day && hour >= w.startHour && hour < w.endHour);
    if (!matches) {
      return { reason: "outside_weekly_window", raw: String(raw), parsed: visitDate.toISOString(), windows: weeklyWindows };
    }
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
  if (issue.reason === "outside_weekly_window") {
    return `Datum návštěvy (${new Date(issue.parsed).toLocaleString("cs-CZ")}) nespadá do žádného z povolených termínů: ${formatWeeklyWindows(issue.windows)}.`;
  }
  const from = scenario?.windowStart ? ` od ${new Date(scenario.windowStart).toLocaleString("cs-CZ")}` : "";
  const to = scenario?.windowEnd ? ` do ${new Date(scenario.windowEnd).toLocaleString("cs-CZ")}` : "";
  return `Datum návštěvy (${new Date(issue.parsed).toLocaleString("cs-CZ")}) je mimo okno terénu${from}${to}.`;
}
