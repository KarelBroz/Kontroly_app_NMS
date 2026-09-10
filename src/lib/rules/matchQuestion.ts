/**
 * Sloupce v importu jsou buď pomocné (např. "RealDate", "InspectionId"),
 * nebo přímo odpověď na otázku ve formátu "KÓD: textace otázky"
 * (např. "X20: Délka celé návštěvy (minuty)"). Pravidla se zadávají podle
 * kódu otázky ("X20"), ne podle celé textace — najdeme sloupec, jehož
 * část před první dvojtečkou (nebo celý název, pokud dvojtečku nemá)
 * odpovídá zadanému kódu (case-insensitive).
 */
export function findAnswerByQuestionCode(
  visitData: Record<string, unknown>,
  questionCode: string
): unknown {
  const target = questionCode.trim().toLowerCase();
  if (!target) return undefined;

  for (const key of Object.keys(visitData)) {
    const prefix = key.split(":")[0]?.trim().toLowerCase();
    if (prefix === target) return visitData[key];
  }
  return undefined;
}

// Krátký alfanumerický kód otázky (X20, F10, D10t...) — písmena, pak
// číslice, volitelně pár koncových písmen. Popisné/pomocné názvy sloupců
// jako "Control", "Email", "Note_2" nebo "RealDate" tenhle tvar nemají
// (chybí jim číslice, nebo mají podtržítko), takže se od skutečných
// otázek dají rozeznat automaticky.
const QUESTION_CODE_PATTERN = /^[A-Za-z]{1,3}\d{1,4}[A-Za-z]{0,2}$/;

/**
 * True, pokud název sloupce vypadá jako odpověď na otázku (kód otázky
 * před dvojtečkou, nebo celý název, odpovídá vzoru výše) — používá se
 * k omezení automatické kontroly pravopisu jen na skutečné odpovědi,
 * ne na pomocné/metadatové sloupce.
 */
export function isQuestionColumn(columnHeader: string): boolean {
  const prefix = columnHeader.split(":")[0]?.trim() ?? "";
  return QUESTION_CODE_PATTERN.test(prefix);
}

// U otázek s výběrem možnosti (radio/select) bývá do odpovědi automaticky
// propsané i interní označení vybrané možnosti, např. "o2: Ne" — to "o2:"
// není součást skutečné odpovědi, je to jen kód možnosti. Pro kontrolu i
// zobrazení nás zajímá jen text za ním.
const ANSWER_OPTION_PREFIX = /^o\d+\s*:\s*/i;

/** Odstraní z odpovědi případné automatické označení možnosti ("o2: Ne" -> "Ne"). */
export function stripAnswerOptionPrefix(value: string): string {
  return value.replace(ANSWER_OPTION_PREFIX, "").trim();
}
