import { FindingSeverity } from "@prisma/client";

// Jedno opakující se týdenní okno — den (1=pondělí…7=neděle, jako Excelí
// WEEKDAY(datum,11)) + hodinové rozmezí od startHour do endHour (endHour
// se do okna nepočítá). Pro scénáře typu "mimo špička"/"špička" s pevným
// rozvrhem napříč dny v týdnu — viz src/lib/rules/realDateWindow.ts.
export interface WeeklyWindow {
  day: number;
  startHour: number;
  endHour: number;
}

// Scénář nese okno terénu ("Start terénu" / "Konec terénu") a volitelně
// opakující se týdenní rozvrh (weeklyWindows) — obojí se kontroluje
// automaticky u každé návštěvy, viz checkRealDateWindow. Zobrazovaná
// pobočka a klíčové otázky byly odstraněny — kontrola odpovědí se řeší přes
// pravidla navázaná na "Kód otázky" (viz matchQuestion.ts).
export interface ScenarioData {
  windowStart?: string;
  windowEnd?: string;
  weeklyWindows?: WeeklyWindow[];
  // Když je zapnuto: návštěva bez vyplněného sloupce "RealDate" se považuje
  // za neúspěšnou (MS neproběhla) a VŮBEC se nekontroluje — žádná pravidla
  // ani systémové kontroly, žádné nálezy. Zavedeno pro MS Lidl, kde chybějící
  // RealDate jednoznačně znamená neúspěšnou návštěvu — viz computeFindingsForVisit.
  skipIfNoRealDate?: boolean;
}

export interface RuleCheckInput {
  visitData: Record<string, unknown>;
  ruleConfig: Record<string, unknown>;
}

export interface RuleCheckResult {
  severity: FindingSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export type RuleChecker = (input: RuleCheckInput) => RuleCheckResult[];
