import * as XLSX from "xlsx";
import iconv from "iconv-lite";
import type { ImportRow, ImportSource } from "./types";

const INSPECTION_ID_KEYS = ["inspectionid", "inspection_id", "inspection id", "id"];

/**
 * Parsuje Excel (.xlsx/.xls) i CSV soubory (xlsx knihovna umí obojí).
 * Očekává hlavičkový řádek se sloupcem InspectionId (nebo variantou názvu).
 */
export class ExcelCsvImportSource implements ImportSource {
  async parse(buffer: Buffer, fileName: string): Promise<ImportRow[]> {
    // .xlsx/.xls jsou binární (ZIP/OLE) formáty s kódováním řešeným uvnitř
    // souboru samotného (XML = vždy UTF-8) — bufferu se nemá sahat na kódování.
    // U .csv je to prostý text a "Excel" na Windows ho bez vyzvání uloží v
    // systémové kódové stránce (u nás Windows-1250), ne v UTF-8 — proto se
    // musí kódování nejdřív rozpoznat/přepočítat, jinak se diakritika rozsype.
    const isCsv = fileName.toLowerCase().endsWith(".csv");
    const workbook = isCsv
      ? XLSX.read(decodeCsvBuffer(buffer), { type: "string", cellDates: true })
      : XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    const result: ImportRow[] = [];
    for (const row of rows) {
      const inspectionId = findInspectionId(row);
      if (!inspectionId) continue;
      result.push({ inspectionId: String(inspectionId).trim(), data: row });
    }
    return result;
  }
}

/**
 * Rozpozná kódování CSV bufferu a vrátí ho jako pořádný unicode text:
 * - UTF-8 BOM na začátku -> jednoznačně UTF-8, BOM se odstraní.
 * - Jinak zkusí, jestli bajty tvoří platné UTF-8 (bez BOM ho tak občas
 *   uloží i Excel) — pokud ne, předpokládá Windows-1250 (výchozí kódová
 *   stránka českého Windows, tou Excel bez vyzvání CSV ukládá).
 */
function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  if (isValidUtf8(buffer)) {
    return buffer.toString("utf8");
  }
  return iconv.decode(buffer, "windows-1250");
}

/** Node u neplatných UTF-8 sekvencí vloží U+FFFD — jejich přítomnost = vstup nebyl platné UTF-8. */
function isValidUtf8(buffer: Buffer): boolean {
  return !buffer.toString("utf8").includes("�");
}

function findInspectionId(row: Record<string, unknown>): unknown {
  for (const key of Object.keys(row)) {
    if (INSPECTION_ID_KEYS.includes(key.toLowerCase().trim())) {
      return row[key];
    }
  }
  return null;
}
