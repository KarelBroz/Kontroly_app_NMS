import { isQuestionColumn } from "./matchQuestion";

/**
 * Sloupce odpovědí v importu mají tvar "KÓD: znění otázky" (např. "X02:
 * Uveďte, prosím, jaké jste nakoupil/a produkty."). Z klíčů dat jedné
 * návštěvy poskládá mapu kód (malými písmeny) -> znění otázky, ať se u
 * nálezů a pravidel dá vedle kódu ukázat i název otázky.
 */
export function buildQuestionLabels(data: Record<string, unknown> | null | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  if (!data) return labels;
  for (const key of Object.keys(data)) {
    const colon = key.indexOf(":");
    if (colon === -1) continue;
    const code = key.slice(0, colon).trim();
    const text = key.slice(colon + 1).trim();
    if (!text || !isQuestionColumn(code)) continue;
    labels.set(code.toLowerCase(), text);
  }
  return labels;
}

/** Znění otázky podle kódu, nebo null, když ho data neznají. */
export function questionText(labels: Map<string, string>, code: string | null | undefined): string | null {
  if (!code) return null;
  return labels.get(code.trim().toLowerCase()) ?? null;
}

/** "X02 – Uveďte, prosím, ..." (nebo jen "X02", když znění neznáme). */
export function formatQuestionLine(labels: Map<string, string>, code: string): string {
  const text = questionText(labels, code);
  return text ? `${code} – ${text}` : code;
}

/** Navazující otázka pravidla (doplňující u podmíněně povinného, ano/ne u prahové shody), pokud nějakou má. */
export function secondaryQuestionCode(config: unknown): string | null {
  const c = config as { detailQuestionCode?: unknown; booleanQuestionCode?: unknown } | null;
  const code = c?.detailQuestionCode ?? c?.booleanQuestionCode;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}
