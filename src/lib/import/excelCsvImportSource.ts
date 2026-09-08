import * as XLSX from "xlsx";
import type { ImportRow, ImportSource } from "./types";

const INSPECTION_ID_KEYS = ["inspectionid", "inspection_id", "inspection id", "id"];

/**
 * Parsuje Excel (.xlsx/.xls) i CSV soubory (xlsx knihovna umí obojí).
 * Očekává hlavičkový řádek se sloupcem InspectionId (nebo variantou názvu).
 */
export class ExcelCsvImportSource implements ImportSource {
  async parse(buffer: Buffer, _fileName: string): Promise<ImportRow[]> {
    const workbook = XLSX.read(buffer, { type: "buffer" });
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

function findInspectionId(row: Record<string, unknown>): unknown {
  for (const key of Object.keys(row)) {
    if (INSPECTION_ID_KEYS.includes(key.toLowerCase().trim())) {
      return row[key];
    }
  }
  return null;
}
