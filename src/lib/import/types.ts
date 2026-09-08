export interface ImportRow {
  inspectionId: string;
  data: Record<string, unknown>;
}

/**
 * Rozhraní datového zdroje pro import návštěv. Aktuální implementace:
 * ExcelCsvImportSource (upload souboru). V budoucnu přibude
 * NavigatorApiImportSource (napojení na interní systém Navigátor přes API)
 * beze změny zbytku appky — jen nová implementace tohoto rozhraní.
 */
export interface ImportSource {
  parse(buffer: Buffer, fileName: string): Promise<ImportRow[]>;
}
