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
