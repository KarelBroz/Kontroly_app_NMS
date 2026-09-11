import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RULE_TYPE_LABELS, SYSTEM_CHECK_LABELS } from "@/lib/rules/labels";
import { FindingStatus, RuleType, SystemCheckType } from "@prisma/client";
import { buildVisitWhere } from "../visitFilters";

const STATUS_LABELS: Record<FindingStatus, string> = {
  [FindingStatus.OPEN]: "Otevřeno",
  [FindingStatus.RESOLVED]: "Vyřešeno",
  [FindingStatus.IGNORED]: "Ignorováno",
};

/**
 * Export nálezů vlny do Excelu (.xlsx) — jeden řádek = jeden nález, jde
 * stáhnout se stejnými filtry (scénář/kontrolor/hledání), jaké má aktuálně
 * nastavené stránka vlny. Ne stránka k zobrazení — čistý soubor ke stažení.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; waveId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Nepřihlášeno", { status: 401 });
  }

  const wave = await prisma.wave.findUnique({
    where: { id: params.waveId },
    select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
  });
  if (!wave || wave.projectId !== params.projectId) {
    return new NextResponse("Vlna nenalezena", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const visitWhere = buildVisitWhere(wave.id, {
    scenario: searchParams.get("scenario") ?? undefined,
    reviewer: searchParams.get("reviewer") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  const visits = await prisma.visit.findMany({
    where: visitWhere,
    orderBy: { inspectionId: "asc" },
    include: {
      scenario: { include: { scenarioTemplate: true } },
      reviewer: true,
      findings: { include: { rule: true, reviewedBy: true }, orderBy: { createdAt: "asc" } },
    },
  });

  type Row = {
    "ID kontroly": string;
    Scénář: string;
    Kontrolor: string;
    "Kód otázky": string;
    "Typ nálezu": string;
    Zpráva: string;
    Závažnost: string;
    Stav: string;
    "Naposledy vyhodnotil": string;
    Vytvořeno: string;
  };
  const rows: Row[] = [];

  for (const visit of visits) {
    for (const finding of visit.findings) {
      const questionCode = finding.rule
        ? ((finding.rule.config as { questionCode?: string } | null)?.questionCode ?? "")
        : finding.systemCheck === SystemCheckType.GRAMMAR
          ? (((finding.details as { field?: string } | null)?.field ?? "").split(":")[0]?.trim() ?? "")
          : "";
      const typeLabel = finding.rule
        ? RULE_TYPE_LABELS[finding.rule.type as RuleType]
        : (SYSTEM_CHECK_LABELS[finding.systemCheck ?? ""] ?? "Systémová kontrola");

      rows.push({
        "ID kontroly": visit.inspectionId,
        Scénář: visit.scenario.scenarioTemplate.name,
        Kontrolor: visit.reviewer ? `${visit.reviewer.firstName} ${visit.reviewer.lastName}`.trim() : "",
        "Kód otázky": questionCode,
        "Typ nálezu": typeLabel,
        Zpráva: finding.message,
        Závažnost: finding.severity,
        Stav: STATUS_LABELS[finding.status],
        "Naposledy vyhodnotil": finding.reviewedBy?.name ?? finding.reviewedBy?.email ?? "",
        Vytvořeno: new Date(finding.createdAt).toLocaleString("cs-CZ"),
      });
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 26 },
    { wch: 60 },
    { wch: 10 },
    { wch: 12 },
    { wch: 20 },
    { wch: 18 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Nálezy");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const fileName = `${wave.project.name} - ${wave.name} - nalezy.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
  // ASCII fallback (starší klienti nezvládají filename* s diakritikou v uvozovkách) + plné UTF-8 jméno pro moderní prohlížeče.
  const asciiFileName =
    fileName
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .replace(/[^\x20-\x7e]/g, "_") || "nalezy.xlsx";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
