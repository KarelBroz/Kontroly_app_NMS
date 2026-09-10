export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export function isValidLogoFile(file: File): boolean {
  return file.type.startsWith("image/") && file.size > 0 && file.size <= MAX_LOGO_BYTES;
}

/** Převede nahraný soubor na data URL (base64) — ukládá se přímo do Project.logoUrl. */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
