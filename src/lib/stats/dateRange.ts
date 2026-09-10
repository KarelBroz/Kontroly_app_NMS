/**
 * Pomocníci pro měsíční/roční statistiky (homepage dlaždice + /statistics).
 * Žádná data se nikde "nerestartují" ručně — jde jen o filtr podle data,
 * takže se nový měsíc/rok automaticky "vynuluje" sám tím, že v něm zatím
 * nejsou žádné návštěvy/vyřešené nálezy.
 */

export interface DateRange {
  start: Date;
  end: Date; // exkluzivní
}

export const MONTH_NAMES_CZ = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

export function monthLabel(month: number): string {
  return MONTH_NAMES_CZ[month - 1] ?? String(month);
}

export function monthRange(year: number, month: number): DateRange {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

export function yearRange(year: number): DateRange {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

export function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** O jeden měsíc zpátky/dopředu (rok se přetočí sám). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/** True, pokud by daný měsíc/rok ležel v budoucnosti oproti dnešku (nemá smysl tam navigovat dopředu). */
export function isFutureMonth(year: number, month: number): boolean {
  const { year: cy, month: cm } = currentYearMonth();
  return year > cy || (year === cy && month > cm);
}

export function isFutureYear(year: number): boolean {
  return year > currentYearMonth().year;
}
