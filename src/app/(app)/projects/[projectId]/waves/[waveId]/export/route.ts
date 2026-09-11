import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RULE_TYPE_LABELS, SYSTEM_CHECK_LABELS } from "@/lib/rules/labels";
import { SystemCheckType } from "@prisma/client";
import { buildVisitWhere } from "../visitFilters";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Otevřeno",
  RESOLVED: "Vyřešeno",
  IGNORED: "Ignorováno",
};

/**
 * Export nálezů vlny do Excelu (.xlsx) — jeden řádek = jeden nález, jde
 * stáhnout se stejnými filtry (scénář/kontrolor/hledání), jaké má aktuálně
 * nastavené stránka vlny.
 */
export async function GET(request: NextRequest, context: { params: { projectId: string; waveId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Nepřihlášeno", { status: 401 });
  }

  const projectId = context.params.projectId;
  const waveId = context.params.waveId;

  const wave = await prisma.wave.findUnique({
    where: { id: waveId },
    select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
  });
  if (!wave || wave.projectId !== projectId) {
    return new NextResponse("Vlna nenalezena", { status: 404 });
  }

  const url = new URL(request.url);
  const visitWhere = buildVisitWhere(wave.id, {
    scenario: url.searchParams.get("scenario") || undefined,
    reviewer: url.searchParams.get("reviewer") || undefined,
    q: url.searchParams.get("q") || undefined,
    findingType: url.searchParams.get("findingType") || undefined,
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

  const rows: Array<Record<string, string>> = [];

  for (const visit of visits) {
    for (const finding of visit.findings) {
      let questionCode = "";
      if (finding.rule) {
        const cfg = finding.rule.config as { questionCode?: string } | null;
        questionCode = (cfg && cfg.questionCode) || "";
      } else if (finding.systemCheck === SystemCheckType.GRAMMAR) {
        const det = finding.details as { field?: string } | null;
        const field = (det && det.field) || "";
        questionCode = field.split(":")[0].trim();
      }

      let typeLabel = "Systémová kontrola";
      if (finding.rule) {
        typeLabel = RULE_TYPE_LABELS[finding.rule.type];
      } else if (finding.systemCheck) {
        typeLabel = SYSTEM_CHECK_LABELS[finding.systemCheck] || "Systémová kontrola";
      }

      const reviewerName = visit.reviewer ? (visit.reviewer.firstName + " " + visit.reviewer.lastName).trim() : "";
      const reviewedByName = finding.reviewedBy ? finding.reviewedBy.name || finding.reviewedBy.email || "" : "";

      const row: Record<string, string> = {};
      row["ID kontroly"] = visit.inspectionId;
      row["Scenar"] = visit.scenario.scenarioTemplate.name;
      row["Kontrolor"] = reviewerName;
      row["Kod otazky"] = questionCode;
      row["Typ nalezu"] = typeLabel;
      row["Zprava"] = finding.message;
      row["Zavaznost"] = finding.severity;
      row["Stav"] = STATUS_LABELS[finding.status] || finding.status;
      row["Naposledy vyhodnotil"] = reviewedByName;
      row["Vytvoreno"] = new Date(finding.createdAt).toLocaleString("cs-CZ");
      rows.push(row);
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Nalezy");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const fileNameAscii = (wave.project.name + " - " + wave.name + " - nalezy.xlsx")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^\x20-\x7e]/g, "_");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"" + fileNameAscii + "\"",
    },
  });
}
