import { createHmac } from "crypto";
import { FIRST_NAMES, TITLES, fold } from "@/lib/rules/conditionCheck";
import { isQuestionColumn } from "@/lib/rules/matchQuestion";

/**
 * Anonymizace osobních údajů v importovaných datech (od 27. 11. 2026 na
 * přání Karla, dokud se nevypne proměnnou ANONYMIZE_IMPORTS=off).
 *
 * - Mystery shopper (MS: Firstname/Surname/Email/Phone) → „MS 3F2A9C“,
 *   ms-3f2a9c@anonym.invalid, telefon smazaný.
 * - Externí kontrolor (Control: …) → „Kontrolor 7B01DE“,
 *   kontrolor-7b01de@anonym.invalid (Databáze kontrolorů tak funguje dál).
 * - Jména v odpovědích (otázky, jejichž textace obsahuje „jméno“ — Tesco X6,
 *   Kooperativa X40) → smyšlené jméno se STEJNOU FORMOU: titul, velká/malá
 *   písmena, počet slov i pořadí jméno/příjmení zůstanou, takže kontrola
 *   formátu (pravidlo personName) dá stejný výsledek jako na originálu.
 * - Ve všech ostatních textech se e-maily a telefonní čísla nahradí
 *   značkou [e-mail] / [telefon]. Jména uvnitř vět spolehlivě poznat nejde.
 *
 * Pseudonymy jsou deterministické (HMAC s tajným klíčem): stejný člověk má
 * vždy stejný pseudonym, opakovaný import se tedy dál páruje a statistiky
 * kontrolorů sedí. Bez klíče zpětně dohledat skutečnou osobu nejde.
 * Klíč: ANONYMIZATION_KEY, jinak NEXTAUTH_SECRET — po změně klíče by tíž
 * lidé dostali nové pseudonymy.
 */

export const ANONYMIZED_EMAIL_DOMAIN = "anonym.invalid";

export function isAnonymizationEnabled(): boolean {
  return process.env.ANONYMIZE_IMPORTS !== "off";
}

function secret(): string {
  const key = process.env.ANONYMIZATION_KEY || process.env.NEXTAUTH_SECRET;
  if (!key) throw new Error("Chybí ANONYMIZATION_KEY / NEXTAUTH_SECRET — bez klíče nejde anonymizovat.");
  return key;
}

function digest(kind: string, value: string): Buffer {
  return createHmac("sha256", secret()).update(`${kind}:${fold(value.trim())}`).digest();
}

/** Krátký stabilní kód osoby, např. "3F2A9C". */
export function pseudonymCode(kind: string, value: string): string {
  return digest(kind, value).toString("hex").slice(0, 6).toUpperCase();
}

export function isAnonymizedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`);
}

/** Pseudonymní kontrolor podle skutečného e-mailu (stejný výsledek při importu i při převodu starých dat). */
export function reviewerPseudonym(email: string): { email: string; firstName: string; lastName: string } {
  const code = pseudonymCode("control", email);
  return { email: `kontrolor-${code.toLowerCase()}@${ANONYMIZED_EMAIL_DOMAIN}`, firstName: "Kontrolor", lastName: code };
}

// ---------- jména se zachovanou formou ----------

// Smyšlená jména: křestní jsou v seznamu FIRST_NAMES (odhad pořadí je pozná
// jako jméno), příjmení v něm nejsou a mužská nekončí na -ová.
const FAKE_FIRST_NAMES = [
  "Adam", "Adéla", "Aleš", "Alena", "Daniel", "Dana", "Emil", "Eva", "Filip", "Hana", "Igor", "Irena",
  "Kamil", "Klára", "Libor", "Lenka", "Marek", "Monika", "Oskar", "Olga", "Radim", "Romana", "Viktor", "Vanda",
];
const FAKE_SURNAMES = [
  "Bartoš", "Beneš", "Cibulka", "Doležal", "Fiala", "Hájek", "Kolář", "Kučera", "Malý", "Navrátil",
  "Pokorný", "Říha", "Sedlák", "Šimek", "Toman", "Vacek", "Zeman", "Jelínek",
];
const FAKE_SURNAMES_FEMALE = [
  "Bartošová", "Benešová", "Doležalová", "Fialová", "Hájková", "Kolářová", "Kučerová", "Navrátilová",
  "Sedláková", "Šimková", "Tomanová", "Vacková", "Zemanová", "Jelínková",
];

/** Přenese velikost písmen z originálu: "novák" → "fiala", "NOVÁK" → "FIALA", "NoVák" → zůstane chybné. */
function withCaseOf(original: string, fake: string): string {
  if (original === original.toUpperCase()) return fake.toUpperCase();
  if (original === original.toLowerCase()) return fake.toLowerCase();
  if (/^\p{Lu}\p{Ll}*$/u.test(original)) return fake;
  // smíšená velikost (chyba) — ať zůstane chybná i v pseudonymu
  return fake.charAt(0).toLowerCase() + fake.slice(1, 2).toUpperCase() + fake.slice(2);
}

function fakeWord(word: string): string {
  const folded = fold(word);
  const pick = (list: string[]) => list[digest("name", word).readUInt32BE(0) % list.length];
  const fake = FIRST_NAMES.has(folded)
    ? pick(FAKE_FIRST_NAMES)
    : /ova$/.test(folded)
      ? pick(FAKE_SURNAMES_FEMALE)
      : pick(FAKE_SURNAMES);
  return withCaseOf(word, fake);
}

/**
 * Jméno nahradí smyšleným se stejnou formou ("Ing. Novák Jan" → "Ing. Fiala
 * Marek"). Tituly, iniciály a interpunkce zůstanou. Delší text (popis
 * pracovníka) se nemění celý — nahradí se v něm jen známá křestní jména.
 */
export function pseudonymizePersonName(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const isShortName = words.length <= 4;
  return value.replace(/\p{L}+/gu, (word) => {
    if (word.length < 2 || TITLES.has(fold(word))) return word;
    if (!isShortName && !FIRST_NAMES.has(fold(word))) return word;
    return fakeWord(word);
  });
}

// ---------- e-maily a telefony v textech ----------

const EMAIL_RE = /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+/gu;
// česká/slovenská čísla: 777 123 456, 777123456, +420 777 123 456, 00420…
const PHONE_RE = /(?<![\d\w+-])(?:(?:\+|00)\s?42[01]\s?)?\d{3}\s?\d{3}\s?\d{3}(?![\d\w-])/g;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;

export function maskContacts(text: string): string {
  return text
    .replace(EMAIL_RE, (email) => (isAnonymizedEmail(email) ? email : "[e-mail]"))
    .replace(PHONE_RE, "[telefon]");
}

// ---------- celý řádek importu ----------

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/\s*:\s*/g, ":").trim();
}

/** Odpověď na otázku, jejíž textace obsahuje „jméno“ (např. „X40: Jméno poradce“). */
export function isPersonNameColumn(header: string): boolean {
  if (!isQuestionColumn(header)) return false;
  const label = header.split(":").slice(1).join(":");
  return fold(label).includes("jmen");
}

function readString(data: Record<string, unknown>, wanted: string): string {
  for (const [key, value] of Object.entries(data)) {
    if (normalizeKey(key) === wanted && typeof value === "string") return value.trim();
  }
  return "";
}

/**
 * Vrátí kopii dat návštěvy bez osobních údajů. Je idempotentní: už
 * anonymizovaná data (e-maily @anonym.invalid) nechá, jak jsou — kromě jmen
 * v odpovědích, proto se převod starých dat hlídá přes Visit.anonymizedAt.
 */
export function anonymizeVisitData<T extends Record<string, unknown>>(data: T): T {
  const msEmail = readString(data, "ms:email");
  const msIdentity = msEmail || `${readString(data, "ms:firstname")} ${readString(data, "ms:surname")}`.trim();
  const msAlready = isAnonymizedEmail(msEmail);
  const msCode = msIdentity && !msAlready ? pseudonymCode("ms", msIdentity) : "";

  const controlEmail = readString(data, "control:email");
  const controlAlready = isAnonymizedEmail(controlEmail);
  const reviewer = controlEmail && !controlAlready ? reviewerPseudonym(controlEmail) : null;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const k = normalizeKey(key);
    const isText = typeof value === "string" && value.trim() !== "";

    if (k === "ms:firstname" || k === "ms:surname" || k === "ms:email") {
      if (!isText || msAlready || !msCode) out[key] = value;
      else if (k === "ms:firstname") out[key] = "MS";
      else if (k === "ms:surname") out[key] = msCode;
      else out[key] = `ms-${msCode.toLowerCase()}@${ANONYMIZED_EMAIL_DOMAIN}`;
      continue;
    }
    if (k === "ms:phone" || k === "phonenumber") {
      out[key] = value === null || value === undefined || String(value).trim() === "" || String(value).trim() === "-" ? value : "";
      continue;
    }
    if (k === "control:firstname" || k === "control:surname" || k === "control:email") {
      if (!isText || !reviewer) out[key] = value;
      else if (k === "control:firstname") out[key] = reviewer.firstName;
      else if (k === "control:surname") out[key] = reviewer.lastName;
      else out[key] = reviewer.email;
      continue;
    }
    if (isText && isPersonNameColumn(key)) {
      out[key] = maskContacts(pseudonymizePersonName(value as string));
      continue;
    }
    if (isText && !ISO_DATE_RE.test(value as string)) {
      out[key] = maskContacts(value as string);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}
