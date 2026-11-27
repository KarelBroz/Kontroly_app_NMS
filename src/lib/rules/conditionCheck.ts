import { FindingSeverity } from "@prisma/client";
import type { RuleChecker } from "./types";
import { findAnswerByQuestionCode, isQuestionColumn, stripAnswerOptionPrefix } from "./matchQuestion";

/**
 * Podmínková kontrola (RuleType.CONDITION) — obecné pravidlo "když platí
 * `when`, musí platit `require`", poskládané z jednoduchých podmínek nad
 * odpověďmi. Vzniklo pro projekty s desítkami vazeb mezi otázkami (Tesco
 * Mobile: routování, kód proti textu, klíčová slova, délky textů), které by
 * se jinak musely programovat každé zvlášť.
 *
 * config = {
 *   code?: "R01",                    // ID pravidla z podkladu, jde do zprávy
 *   description: "...",             // lidský popis, jde do zprávy
 *   severity?: "HIGH" | "MEDIUM" | "LOW",   // Chyba = HIGH, Varování = MEDIUM
 *   questionCode?: "A1",             // hlavní otázka — jen pro zobrazení textace v appce
 *   when?: Condition,                // bez `when` platí pravidlo vždy
 *   require: Condition,
 * }
 *
 * Condition je `{ all: [...] }`, `{ any: [...] }`, `{ not: ... }`,
 * `{ iff: [a, b] }` (a platí právě když b) nebo jedna z podmínek níže.
 * Neexistující nebo prázdná odpověď se bere jako prázdná.
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { iff: [Condition, Condition] }
  // otázka je vyplněná / prázdná
  | { q: string; is: "filled" | "empty" }
  // všechny otázky s kódem v rozsahu (např. A2 až D7t, včetně) jsou prázdné / vyplněné
  | { range: [string, string]; is: "filled" | "empty" }
  // kód zvolené možnosti ("o10: Text" -> "o10") je jeden z vyjmenovaných
  | { q: string; codeIn: string[] }
  // vícenásobná odpověď ("o0,o4,o10") obsahuje aspoň jeden z kódů
  | { q: string; codesInclude: string[] }
  // počet zvolených kódů ve vícenásobné odpovědi
  | { q: string; codeCount: { min?: number; max?: number } }
  // hodnota se rovná jedné z vyjmenovaných (bez ohledu na velikost písmen)
  | { q: string; equals: string[] }
  // text obsahuje aspoň jedno klíčové slovo (bez diakritiky a velikosti písmen, i část slova)
  | { q: string; containsAny: string[] }
  // text odpovídá regulárnímu výrazu (bez ohledu na velikost písmen); `label` = čitelný popis do zprávy
  | { q: string; matches: string; label?: string }
  // vyplněný text má aspoň N znaků (prázdný projde — to řeší `is: "filled"`)
  | { q: string; minLength: number }
  // vyplněný text není výplňová odpověď ("-", ".", "x", "nevím", "viz výše", "ok", jen číslo)
  | { q: string; notFiller: true }
  // délka ve tvaru h:mm:ss / h:mm / minuty je v rozsahu (v minutách)
  | { q: string; durationMinutes: { min?: number; max?: number } }
  // datum a čas je nejvýše `maxMinutes` od jiného pole (a volitelně ve stejný den)
  | { q: string; dateTimeNear: { of: string; maxMinutes: number; sameDay?: boolean } }
  // datum a čas není později než zadaný okamžik ("2026-11-20T23:59" nebo "now")
  | { q: string; dateTimeOnOrBefore: string }
  // text sdílí aspoň jedno slovo (min. 4 znaky) s některým z dalších polí
  | { q: string; sharesWordWith: string[] }
  // text není podobný znění zvolené možnosti jiné otázky víc než `max` (0–1)
  | { q: string; notSimilarToAnswerOf: string; max: number }
  // žádné dva vyplněné texty z výčtu si nejsou podobné víc než `max` (0–1)
  | { texts: string[]; maxPairSimilarity: number }
  // vyplněný text je jméno ve tvaru „Jméno Příjmení“ — bez titulu, dvě slova
  // s velkým počátečním písmenem, jméno první (prázdný projde)
  | { q: string; personName: true }
  // některá otevřená (textová) odpověď dotazníku obsahuje aspoň jedno klíčové
  // slovo — prohledá všechny sloupce otázek kromě `except`
  | { textsMention: string[]; except?: string[] };

interface ConditionConfig {
  code?: string;
  description?: string;
  severity?: string;
  when?: Condition;
  require?: Condition;
}

type VisitData = Record<string, unknown>;

// ---------- čtení hodnot ----------

function rawText(data: VisitData, q: string): string {
  const value = findAnswerByQuestionCode(data, q);
  return value === undefined || value === null ? "" : String(value).trim();
}

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Malá písmena bez diakritiky — pro klíčová slova a podobnost textů. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS_RE, "").toLowerCase();
}

/** Kódy zvolených možností: "o10: Text" -> ["o10"], "o0,o4,o10" -> ["o0","o4","o10"]. */
function answerCodes(data: VisitData, q: string): string[] {
  const text = rawText(data, q);
  if (!/^o\d+/i.test(text)) return [];
  return (text.match(/\bo\d+\b/gi) ?? []).map((code) => code.toLowerCase());
}

/** Délka v minutách: "0:15:00" -> 15, "15:00:00" -> 900, "0:15" -> 15, "15" -> 15, 0.0104 (zlomek dne z Excelu) -> 15. */
function parseDurationMinutes(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const hms = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]) + (hms[3] ? Number(hms[3]) / 60 : 0);
  const num = Number(t.replace(",", "."));
  if (Number.isNaN(num)) return null;
  return num > 0 && num < 1 ? num * 24 * 60 : num;
}

/**
 * Datum a čas jako "naivní" milisekundy (bez časové zóny — porovnáváme jen
 * mezi sebou údaje ze stejného exportu). Umí "12.11.2026 14:30(:00)",
 * "12. 11. 2026 14:30", ISO "2026-11-12T14:30" / "2026-11-12 14:30:00"
 * a Excelí sériové číslo.
 */
export function parseDateTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const cz = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (cz) return Date.UTC(+cz[3], +cz[2] - 1, +cz[1], +(cz[4] ?? 0), +(cz[5] ?? 0), +(cz[6] ?? 0));
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));
  if (/^\d+(\.\d+)?$/.test(t)) {
    const serial = Number(t);
    if (serial > 18000 && serial < 73000) return Math.round((serial - 25569) * 86400 * 1000);
  }
  return null;
}

function nowAsNaiveMs(): number {
  // "teď" v pražském čase, ve stejném naivním tvaru jako parseDateTime
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
}

function formatNaive(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const FILLER_RE = /^\s*(-+|\.+|x|nevim|viz vyse|ok|\d+([.,]\d+)?)\s*\.?\s*$/;

/** Podobnost dvou textů 0–1 (Dice koeficient nad dvojicemi znaků, bez diakritiky). */
export function textSimilarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const clean = fold(s).replace(/\s+/g, " ").trim();
    const out = new Map<string, number>();
    for (let i = 0; i < clean.length - 1; i++) {
      const bg = clean.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let sizeA = 0;
  let sizeB = 0;
  let overlap = 0;
  A.forEach((count, bg) => {
    sizeA += count;
    overlap += Math.min(count, B.get(bg) ?? 0);
  });
  B.forEach((count) => (sizeB += count));
  return sizeA + sizeB === 0 ? 0 : (2 * overlap) / (sizeA + sizeB);
}

/** Kód otázky rozložený pro porovnání rozsahu: "B12" -> ["B", 12, ""], "D7t" -> ["D", 7, "t"]. */
function parseCode(code: string): [string, number, string] | null {
  const m = code.trim().match(/^([A-Za-z]+)(\d+)([A-Za-z]*)$/);
  return m ? [m[1].toUpperCase(), Number(m[2]), m[3].toLowerCase()] : null;
}

function compareCodes(a: [string, number, string], b: [string, number, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] === b[2] ? 0 : a[2] < b[2] ? -1 : 1;
}

/** Kódy otázek importu v rozsahu from..to (včetně), např. A2..D7t. */
function codesInRange(data: VisitData, from: string, to: string): string[] {
  const lo = parseCode(from);
  const hi = parseCode(to);
  if (!lo || !hi) return [];
  const codes: string[] = [];
  for (const key of Object.keys(data)) {
    if (!isQuestionColumn(key)) continue;
    const code = key.split(":")[0].trim();
    const parsed = parseCode(code);
    if (parsed && compareCodes(parsed, lo) >= 0 && compareCodes(parsed, hi) <= 0) codes.push(code);
  }
  return codes;
}

function shorten(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ---------- jméno a příjmení ----------

// Tituly a oslovení před/za jménem (bez teček, malými písmeny bez diakritiky).
const TITLES = new Set([
  "bc", "bca", "ing", "arch", "mgr", "mga", "mudr", "mddr", "mvdr", "judr", "phdr", "rndr", "paeddr", "thdr",
  "pharmdr", "rsdr", "phmr", "dr", "phd", "dis", "csc", "drsc", "doc", "prof", "mba", "bba", "msc", "ma", "ba",
  "llm", "llb", "dipl", "pan", "pani", "slecna",
]);

// Častá česká křestní jména (bez diakritiky) — jen pro odhad prohozeného
// pořadí („Novák Jan“): když je druhé slovo známé jméno a první ne.
const FIRST_NAMES = new Set(
  (
    "jan jiri petr josef pavel martin tomas jaroslav miroslav zdenek vaclav michal frantisek jakub milan karel lukas " +
    "david ondrej vladimir ladislav roman stanislav marek radek daniel antonin vojtech filip adam matej jaromir patrik " +
    "ales dominik libor robert vit lubomir zbynek jindrich oldrich vlastimil ivan rudolf bohumil igor dusan richard " +
    "radim kamil viktor simon stepan sebastian hynek matyas marian rostislav emil eduard denis erik oskar kristian " +
    "marie jana eva hana anna lenka katerina lucie vera alena petra veronika jaroslava tereza martina michaela jitka " +
    "helena ludmila zdenka ivana monika eliska zuzana marketa jarmila barbora kristyna adela natalie klara karolina " +
    "dagmar vlasta irena simona pavla andrea nikola gabriela denisa marcela olga radka iveta blanka dana bozena " +
    "kamila sarka romana renata milada nela viktorie sofie ema laura agata stepanka magdalena silvie sabina vanda " +
    "aneta daniela hedvika jolana libuse sona alzbeta"
  ).split(" ")
);

const NAME_WORD_RE = /^\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)*$/u;

/** Co je špatně na jménu ve tvaru „Jméno Příjmení“ — prázdné pole = v pořádku. */
export function personNameProblems(value: string): string[] {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return [];
  const problems: string[] = [];
  const tokens = text.split(" ");
  const bare = (t: string) => fold(t).replace(/[.,]/g, "");

  const titles = tokens.filter((t) => TITLES.has(bare(t)));
  if (titles.length > 0) problems.push(`obsahuje titul/oslovení (${titles.join(" ")})`);
  const words = tokens.filter((t) => !TITLES.has(bare(t)));
  const abbreviations = words.filter((t) => /[.,]/.test(t));
  if (abbreviations.length > 0) problems.push(`obsahuje zkratku nebo interpunkci (${abbreviations.join(" ")})`);

  const clean = words.map((t) => t.replace(/[.,]/g, "")).filter(Boolean);
  if (clean.length !== 2) {
    const unit = clean.length === 1 ? "slovo" : clean.length >= 2 && clean.length <= 4 ? "slova" : "slov";
    problems.push(`má ${clean.length} ${unit}, má být jméno a příjmení`);
  }
  const badCase = clean.filter((t) => !NAME_WORD_RE.test(t));
  if (badCase.length > 0) problems.push(`špatná velká/malá písmena (${badCase.join(" ")})`);

  if (clean.length === 2) {
    const [first, second] = clean.map(bare);
    const firstLooksLikeSurname = /ova$/.test(first) && !/ova$/.test(second);
    const secondIsFirstName = FIRST_NAMES.has(second) && !FIRST_NAMES.has(first);
    if (firstLooksLikeSurname || secondIsFirstName) problems.push("nejspíš prohozené pořadí (má být jméno, pak příjmení)");
  }
  return problems;
}

// ---------- zmínky v otevřených odpovědích ----------

/** Otevřené (textové) odpovědi: sloupce otázek, které nejsou zvolená možnost („o2: Ne“) ani jen číslo/datum. */
function openTextAnswers(data: VisitData, except: string[] = []): Array<[string, string]> {
  const skip = new Set(except.map((q) => q.toLowerCase()));
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string" || !isQuestionColumn(key)) continue;
    const code = key.split(":")[0].trim();
    if (skip.has(code.toLowerCase())) continue;
    const text = value.trim().normalize("NFC");
    if (!text || /^o\d+/i.test(text) || /^[\d\s.,:/-]+$/.test(text) || /^\d{4}-\d{2}-\d{2}T/.test(text)) continue;
    out.push([code, text]);
  }
  return out;
}

/** Nalezené zmínky: [kód otázky, úryvek textu kolem klíčového slova]. */
function textMentions(data: VisitData, keywords: string[], except?: string[]): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  for (const [code, text] of openTextAnswers(data, except)) {
    // u textu v NFC zachová fold() délku (jen ubere diakritiku), pozice tedy sedí
    const folded = fold(text);
    for (const kw of keywords) {
      const needle = fold(kw);
      const at = folded.indexOf(needle);
      if (at < 0) continue;
      const from = Math.max(0, at - 25);
      const to = Math.min(text.length, at + needle.length + 25);
      found.push([code, `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`]);
      break;
    }
  }
  return found;
}

// ---------- vyhodnocení ----------

export function evaluate(cond: Condition, data: VisitData): boolean {
  if ("all" in cond) return cond.all.every((c) => evaluate(c, data));
  if ("any" in cond) return cond.any.some((c) => evaluate(c, data));
  if ("not" in cond) return !evaluate(cond.not, data);
  if ("iff" in cond) return evaluate(cond.iff[0], data) === evaluate(cond.iff[1], data);
  if ("range" in cond) {
    const filled = codesInRange(data, cond.range[0], cond.range[1]).filter((code) => rawText(data, code) !== "");
    return cond.is === "empty" ? filled.length === 0 : filled.length > 0;
  }
  if ("texts" in cond) return similarPairs(cond.texts, cond.maxPairSimilarity, data).length === 0;
  if ("textsMention" in cond) return textMentions(data, cond.textsMention, cond.except).length > 0;

  const text = rawText(data, cond.q);
  if ("is" in cond) return cond.is === "filled" ? text !== "" : text === "";
  if ("codeIn" in cond) {
    const codes = answerCodes(data, cond.q);
    return codes.length > 0 && cond.codeIn.map((c) => c.toLowerCase()).includes(codes[0]);
  }
  if ("codesInclude" in cond) {
    const codes = answerCodes(data, cond.q);
    return cond.codesInclude.some((c) => codes.includes(c.toLowerCase()));
  }
  if ("codeCount" in cond) {
    const n = answerCodes(data, cond.q).length;
    return (cond.codeCount.min === undefined || n >= cond.codeCount.min) &&
      (cond.codeCount.max === undefined || n <= cond.codeCount.max);
  }
  if ("equals" in cond) return cond.equals.some((v) => v.toLowerCase() === text.toLowerCase());
  if ("containsAny" in cond) {
    const folded = fold(text);
    return cond.containsAny.some((kw) => folded.includes(fold(kw)));
  }
  if ("matches" in cond) return new RegExp(cond.matches, "i").test(text);
  if ("minLength" in cond) return text === "" || text.length >= cond.minLength;
  if ("notFiller" in cond) return text === "" || !FILLER_RE.test(fold(text));
  if ("durationMinutes" in cond) {
    const minutes = parseDurationMinutes(text);
    if (minutes === null) return false;
    const { min, max } = cond.durationMinutes;
    return (min === undefined || minutes >= min) && (max === undefined || minutes <= max);
  }
  if ("dateTimeNear" in cond) {
    const a = parseDateTime(text);
    const b = parseDateTime(rawText(data, cond.dateTimeNear.of));
    if (a === null || b === null) return false;
    if (cond.dateTimeNear.sameDay && Math.floor(a / 86400000) !== Math.floor(b / 86400000)) return false;
    return Math.abs(a - b) <= cond.dateTimeNear.maxMinutes * 60000;
  }
  if ("dateTimeOnOrBefore" in cond) {
    const a = parseDateTime(text);
    const limit = cond.dateTimeOnOrBefore === "now" ? nowAsNaiveMs() : parseDateTime(cond.dateTimeOnOrBefore);
    return a !== null && limit !== null && a <= limit;
  }
  if ("sharesWordWith" in cond) {
    const words = new Set(fold(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
    return cond.sharesWordWith.some((field) =>
      fold(rawText(data, field))
        .split(/[^a-z0-9]+/)
        .some((w) => w.length >= 4 && words.has(w))
    );
  }
  if ("personName" in cond) return personNameProblems(text).length === 0;
  if ("notSimilarToAnswerOf" in cond) {
    const option = stripAnswerOptionPrefix(rawText(data, cond.notSimilarToAnswerOf));
    if (!text || !option) return true;
    return textSimilarity(text, option) <= cond.max;
  }
  return true;
}

function similarPairs(texts: string[], max: number, data: VisitData): Array<[string, string, number]> {
  const filled = texts.map((q) => [q, rawText(data, q)] as const).filter(([, t]) => t.length >= 20);
  const pairs: Array<[string, string, number]> = [];
  for (let i = 0; i < filled.length; i++) {
    for (let j = i + 1; j < filled.length; j++) {
      const sim = textSimilarity(filled[i][1], filled[j][1]);
      if (sim > max) pairs.push([filled[i][0], filled[j][0], sim]);
    }
  }
  return pairs;
}

// ---------- popis pro kontrolorku ----------

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Lidský popis podmínky (co má platit). */
export function describe(cond: Condition): string {
  if ("all" in cond) return cond.all.map(describe).join(" a ");
  if ("any" in cond) return `(${cond.any.map(describe).join(" nebo ")})`;
  if ("not" in cond) return `neplatí: ${describe(cond.not)}`;
  if ("iff" in cond) return `${describe(cond.iff[0])} právě když ${describe(cond.iff[1])}`;
  if ("range" in cond) return `${cond.range[0]}–${cond.range[1]} ${cond.is === "empty" ? "prázdné" : "vyplněné"}`;
  if ("texts" in cond) return `texty se neopakují (podobnost max. ${pct(cond.maxPairSimilarity)})`;
  if ("textsMention" in cond) return `některý text zmiňuje „${cond.textsMention.join("“ / „")}“`;
  const q = cond.q;
  if ("is" in cond) return `${q} ${cond.is === "empty" ? "prázdné" : "vyplněné"}`;
  if ("codeIn" in cond) return `${q} = ${cond.codeIn.join(" / ")}`;
  if ("codesInclude" in cond) return `${q} obsahuje ${cond.codesInclude.join(" / ")}`;
  if ("codeCount" in cond) {
    const { min, max } = cond.codeCount;
    return `${q} má ${min !== undefined ? `aspoň ${min}` : ""}${min !== undefined && max !== undefined ? " a " : ""}${max !== undefined ? `nejvýš ${max}` : ""} kódů`;
  }
  if ("equals" in cond) return `${q} = ${cond.equals.join(" / ")}`;
  if ("containsAny" in cond) return `${q} obsahuje „${cond.containsAny.join("“ / „")}“`;
  if ("matches" in cond) return cond.label ? `${q} obsahuje ${cond.label}` : `${q} odpovídá vzoru ${cond.matches}`;
  if ("minLength" in cond) return `${q} má aspoň ${cond.minLength} znaků`;
  if ("notFiller" in cond) return `${q} není výplňová odpověď`;
  if ("durationMinutes" in cond) {
    const { min, max } = cond.durationMinutes;
    return `${q} je ${min ?? 0}–${max ?? "…"} min`;
  }
  if ("dateTimeNear" in cond)
    return `${q} je max. ${cond.dateTimeNear.maxMinutes} min od ${cond.dateTimeNear.of}${cond.dateTimeNear.sameDay ? " (stejný den)" : ""}`;
  if ("dateTimeOnOrBefore" in cond)
    return cond.dateTimeOnOrBefore === "now"
      ? `${q} není v budoucnosti`
      : `${q} nejpozději ${formatNaive(parseDateTime(cond.dateTimeOnOrBefore) ?? 0)}`;
  if ("sharesWordWith" in cond) return `${q} odpovídá ${cond.sharesWordWith.join(" / ")}`;
  if ("notSimilarToAnswerOf" in cond) return `${q} jen neopakuje znění odpovědi ${cond.notSimilarToAnswerOf}`;
  if ("personName" in cond) return `${q} ve tvaru „Jméno Příjmení“`;
  return "";
}

/** Co konkrétně nesedí — u `all` jen nesplněné části, aby zpráva byla krátká. */
function explainFailure(cond: Condition, data: VisitData): string[] {
  if ("all" in cond) return cond.all.filter((c) => !evaluate(c, data)).flatMap((c) => explainFailure(c, data));
  if ("range" in cond && cond.is === "empty") {
    const filled = codesInRange(data, cond.range[0], cond.range[1]).filter((code) => rawText(data, code) !== "");
    return [`${cond.range[0]}–${cond.range[1]} mají být prázdné, vyplněno: ${filled.join(", ")}`];
  }
  if ("texts" in cond) {
    return similarPairs(cond.texts, cond.maxPairSimilarity, data).map(
      ([a, b, sim]) => `${a} a ${b} jsou si podobné na ${pct(sim)}`
    );
  }
  if ("notSimilarToAnswerOf" in cond) {
    const option = stripAnswerOptionPrefix(rawText(data, cond.notSimilarToAnswerOf));
    return [`${cond.q} jen opakuje znění odpovědi ${cond.notSimilarToAnswerOf} („${shorten(option)}“, podobnost ${pct(textSimilarity(rawText(data, cond.q), option))})`];
  }
  if ("minLength" in cond) return [`${cond.q} má jen ${rawText(data, cond.q).length} znaků (min. ${cond.minLength})`];
  if ("notFiller" in cond) return [`${cond.q} je jen výplň („${shorten(rawText(data, cond.q), 20)}“)`];
  if ("personName" in cond) {
    return [`${cond.q} není ve tvaru „Jméno Příjmení“: ${personNameProblems(rawText(data, cond.q)).join(", ")}`];
  }
  if ("not" in cond) {
    const inner = cond.not;
    if ("textsMention" in inner) {
      const found = textMentions(data, inner.textsMention, inner.except);
      return [`zmínka v textu: ${found.map(([code, snippet]) => `${code} „${snippet}“`).join("; ")}`];
    }
    if ("q" in inner && "containsAny" in inner) {
      const folded = fold(rawText(data, inner.q));
      const found = inner.containsAny.filter((kw) => folded.includes(fold(kw)));
      return [`${inner.q} obsahuje „${found.join("“, „")}“`];
    }
    return [`zjištěno: ${describe(inner)}`];
  }
  return [`nesplněno: ${describe(cond)}`];
}

/** Kódy otázek, na které se podmínka odkazuje — jejich hodnoty jdou do zprávy. */
function referencedQuestions(cond: Condition | undefined, out: Set<string>): Set<string> {
  if (!cond) return out;
  if ("all" in cond) cond.all.forEach((c) => referencedQuestions(c, out));
  else if ("any" in cond) cond.any.forEach((c) => referencedQuestions(c, out));
  else if ("not" in cond) referencedQuestions(cond.not, out);
  else if ("iff" in cond) cond.iff.forEach((c) => referencedQuestions(c, out));
  else if ("q" in cond) {
    out.add(cond.q);
    if ("dateTimeNear" in cond) out.add(cond.dateTimeNear.of);
  }
  return out;
}

function displayValue(data: VisitData, q: string): string {
  const text = rawText(data, q);
  if (!text) return "–";
  const codes = answerCodes(data, q);
  if (codes.length > 0 && /^o\d+\s*(,\s*o\d+\s*)*$/i.test(text)) return codes.join(",");
  if (codes.length > 0) return shorten(text, 40);
  return `„${shorten(text)}“`;
}

const SEVERITIES: Record<string, FindingSeverity> = {
  HIGH: FindingSeverity.HIGH,
  MEDIUM: FindingSeverity.MEDIUM,
  LOW: FindingSeverity.LOW,
};

export const checkCondition: RuleChecker = ({ visitData, ruleConfig }) => {
  const config = ruleConfig as ConditionConfig;
  if (!config.require) return [];
  if (config.when && !evaluate(config.when, visitData)) return [];
  if (evaluate(config.require, visitData)) return [];

  const problems = explainFailure(config.require, visitData);
  // U pravidel přes mnoho otázek (délky textů, výplně…) jen hodnoty otázek,
  // kterých se nález týká — jinak by zpráva vypsala celý dotazník.
  let questions = Array.from(referencedQuestions(config.when, referencedQuestions(config.require, new Set())));
  if (questions.length > 4) {
    const problemText = problems.join(" ");
    questions = questions.filter((q) => new RegExp(`(^|[^A-Za-z0-9])${q}([^A-Za-z0-9]|$)`).test(problemText));
  }
  const values = questions
    .map((q) => `${q}: ${displayValue(visitData, q)}`)
    .join(" · ");
  const prefix = [config.code, config.description].filter(Boolean).join(" — ");

  return [
    {
      severity: SEVERITIES[config.severity ?? "HIGH"] ?? FindingSeverity.HIGH,
      message: `${prefix}. ${problems.join("; ")}.${values ? ` (${values})` : ""}`,
      details: { code: config.code, problems, values },
    },
  ];
};
