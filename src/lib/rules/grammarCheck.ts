export interface GrammarIssue {
  context: string;
  errorWord: string;
  reason: string;
}

/**
 * Vždy a všude (napříč všemi projekty/vlnami) prochází každou textovou
 * odpověď návštěvy a hledá zjevné, mechanické chyby — offline, bez AI:
 * opakující se písmeno/slovo, vícenásobné/okrajové mezery. Neumí
 * skutečnou gramatiku/pravopis (na to by bylo potřeba slovník nebo AI) —
 * jde o rychlou, spolehlivou první vrstvu kontroly.
 */
export function checkTextForIssues(rawText: string): GrammarIssue | null {
  const trimmed = rawText.trim();
  if (trimmed.length < 3) return null;

  if (trimmed !== rawText) {
    return { context: rawText, errorWord: "", reason: "Text má přebytečné mezery na začátku/konci." };
  }

  const doubleSpaceIndex = rawText.indexOf("  ");
  if (doubleSpaceIndex !== -1) {
    return { context: rawText, errorWord: "  ", reason: "Vícenásobná mezera v textu." };
  }

  const repeatedCharMatch = rawText.match(/(\p{L})\1{2,}/u);
  if (repeatedCharMatch) {
    return { context: rawText, errorWord: repeatedCharMatch[0], reason: "Opakující se písmeno — možný překlep." };
  }

  const words = trimmed.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].toLowerCase().replace(/[.,!?;:]+$/u, "");
    const b = words[i + 1].toLowerCase().replace(/[.,!?;:]+$/u, "");
    if (a.length >= 2 && a === b) {
      const context = words.slice(Math.max(0, i - 2), i + 3).join(" ");
      return { context, errorWord: words[i], reason: "Opakující se slovo za sebou." };
    }
  }

  return null;
}
