export interface GrammarIssue {
  context: string;
  errorWord: string;
  reason: string;
}

/**
 * Slova, která v češtině smějí stát dvakrát za sebou, protože pokaždé
 * znamenají něco jiného (nebo jde o ustálené zdvojení):
 * - „se se“ — zvratné „se“ + předložka „se“: „hezky se se mnou rozloučil“,
 *   „seznámil se se scénářem“
 * - „je je“ — sloveso „je“ + zájmeno „je“ (= ony/je): „je je slyšet“, „je je potřeba podepsat“
 * - „to to“ — zájmeno + člen u přídavného jména: „bylo to to nejlepší“, „to to stálo za to“
 * - „tak tak“ — ustálené „tak tak stihl“ (= jen taktak)
 * - „už už“ — ustálené „už už odcházel“
 * Ostatní zdvojení („a a“, „na na“, „si si“…) jsou téměř vždy překlep a hlásí se dál.
 */
const VALID_CZECH_DOUBLES = new Set(["se", "je", "to", "tak", "už"]);

export interface SpaceSpot {
  /** pozice prvního znaku slova před mezerami (nebo mezer, když slovo chybí) */
  start: number;
  /** pozice za posledním znakem slova za mezerami */
  end: number;
  /** pozice samotných mezer [spacesStart, spacesEnd) */
  spacesStart: number;
  spacesEnd: number;
  /** "slovo  další" — jak je v textu, i s mezerami */
  snippet: string;
}

/**
 * Všechna místa s vícenásobnou mezerou uvnitř textu, i se slovem před a za
 * nimi — aby šla v appce vyznačit a kontrolor je v dlouhém textu našel.
 */
export function findMultipleSpaceSpots(text: string): SpaceSpot[] {
  const spots: SpaceSpot[] = [];
  for (const m of Array.from(text.matchAll(/ {2,}/g))) {
    const spacesStart = m.index ?? 0;
    const spacesEnd = spacesStart + m[0].length;
    if (spacesStart === 0 || spacesEnd === text.length) continue; // okrajové mezery hlásí jiná kontrola
    let start = spacesStart;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    let end = spacesEnd;
    while (end < text.length && !/\s/.test(text[end])) end++;
    spots.push({ start, end, spacesStart, spacesEnd, snippet: text.slice(start, end) });
  }
  return spots;
}

/**
 * Vždy a všude (napříč všemi projekty/vlnami) prochází každou textovou
 * odpověď návštěvy a hledá zjevné, mechanické chyby — offline, bez AI:
 * opakující se písmeno/slovo, vícenásobné/okrajové mezery, mezera před
 * interpunkcí, chybějící mezera za interpunkcí, zdvojená interpunkce. Neumí
 * skutečnou gramatiku/pravopis/překlepy ve slovech (na to by bylo potřeba
 * slovník nebo AI) — jde o rychlou, spolehlivou první vrstvu kontroly.
 */
export function checkTextForIssues(rawText: string): GrammarIssue | null {
  const trimmed = rawText.trim();
  if (trimmed.length < 3) return null;

  if (trimmed !== rawText) {
    return { context: rawText, errorWord: "", reason: "Text má přebytečné mezery na začátku/konci." };
  }

  const spaceSpots = findMultipleSpaceSpots(rawText);
  if (spaceSpots.length > 0) {
    return { context: rawText, errorWord: spaceSpots[0].snippet, reason: "Vícenásobná mezera v textu." };
  }

  const repeatedCharMatch = rawText.match(/(\p{L})\1{2,}/u);
  if (repeatedCharMatch) {
    return { context: rawText, errorWord: repeatedCharMatch[0], reason: "Opakující se písmeno — možný překlep." };
  }

  const words = trimmed.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    // Interpunkce mezi slovy = dvě různé části věty („Řekl to, to je jasné.“,
    // „Ano. Ano, přesně tak.“) — to není zdvojené slovo.
    if (/[.,!?;:–—-]$/u.test(words[i])) continue;
    const a = words[i].toLowerCase().replace(/[.,!?;:]+$/u, "");
    const b = words[i + 1].toLowerCase().replace(/[.,!?;:]+$/u, "");
    if (a.length >= 2 && a === b && !VALID_CZECH_DOUBLES.has(a)) {
      const context = words.slice(Math.max(0, i - 2), i + 3).join(" ");
      return { context, errorWord: words[i], reason: "Opakující se slovo za sebou." };
    }
  }

  // Mezera před interpunkcí (typicky "slovo ." nebo "slovo ,").
  const spaceBeforePunct = rawText.match(/\s[,.!?;:]/u);
  if (spaceBeforePunct) {
    return { context: rawText, errorWord: spaceBeforePunct[0], reason: "Mezera před interpunkcí." };
  }

  // Chybějící mezera za čárkou/tečkou před dalším slovem (např. "slovo.Další"
  // nebo "slovo,další") — desetinná čísla (tečka/čárka mezi číslicemi) se
  // nepočítají (za tečkou/čárkou musí být písmeno, ne číslice), stejně jako
  // zkratky/iniciály typu "J.D.Gross" (před tečkou/čárkou vyžadujeme malé
  // písmeno, ne velké).
  const missingSpaceAfterPunct = rawText.match(/\p{Ll}[,.](\p{L})/u);
  if (missingSpaceAfterPunct) {
    return {
      context: rawText,
      errorWord: missingSpaceAfterPunct[0],
      reason: "Chybí mezera za čárkou/tečkou.",
    };
  }

  // Zdvojená interpunkce (např. "slovo.. Další" nebo "slovo,, další") — tři
  // tečky za sebou (výpustka "…") se nepočítá, to je normální interpunkce.
  const doubledPunctMatch = rawText.match(/([,!?;:])\1|(?<!\.)\.\.(?!\.)/u);
  if (doubledPunctMatch) {
    return { context: rawText, errorWord: doubledPunctMatch[0], reason: "Zdvojená interpunkce." };
  }

  return null;
}
