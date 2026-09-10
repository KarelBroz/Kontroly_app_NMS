import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { BugReportStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { updateBugReportStatus } from "./actions";

const STATUS_LABEL: Record<BugReportStatus, string> = {
  [BugReportStatus.PENDING]: "Čeká na vyhodnocení",
  [BugReportStatus.RESOLVED]: "Vyřešeno",
  [BugReportStatus.REJECTED]: "Zamítnuto",
};

const STATUS_TONE: Record<BugReportStatus, BadgeTone> = {
  [BugReportStatus.PENDING]: "amber",
  [BugReportStatus.RESOLVED]: "green",
  [BugReportStatus.REJECTED]: "red",
};

// řazení přehledu: nevyhodnocené nahoře (od nejnovějšího), vyřešené/zamítnuté dole
const STATUS_ORDER: Record<BugReportStatus, number> = {
  [BugReportStatus.PENDING]: 0,
  [BugReportStatus.RESOLVED]: 1,
  [BugReportStatus.REJECTED]: 1,
};

export default async function BugReportsPage() {
  const reports = await prisma.bugReport.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  reports.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const pendingCount = reports.filter((r) => r.status === BugReportStatus.PENDING).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sběr chyb</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chyby a problémy, které uživatelé nahlásili přímo ze stránek appky (kulatá vlaječka vpravo dole).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{reports.length} celkem</Badge>
        <Badge tone="amber">{pendingCount} čeká na vyhodnocení</Badge>
      </div>

      <Card className="p-0">
        {reports.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">Zatím žádná nahlášená chyba.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.map((report) => (
              <div key={report.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[report.status]}>{STATUS_LABEL[report.status]}</Badge>
                    <Link
                      href={report.pageUrl}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {report.pageUrl}
                    </Link>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{report.message}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {report.user?.name ?? report.user?.email ?? "neznámý uživatel"} ·{" "}
                    {new Date(report.createdAt).toLocaleString("cs-CZ")}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <form action={updateBugReportStatus.bind(null, report.id, BugReportStatus.PENDING)}>
                    <button
                      type="submit"
                      disabled={report.status === BugReportStatus.PENDING}
                      title="Čeká na vyhodnocení"
                      className="rounded-full p-1 disabled:cursor-default"
                    >
                      <Clock
                        className={cn(
                          "h-5 w-5",
                          report.status === BugReportStatus.PENDING ? "text-amber-500" : "text-slate-300"
                        )}
                      />
                    </button>
                  </form>
                  <form action={updateBugReportStatus.bind(null, report.id, BugReportStatus.RESOLVED)}>
                    <button
                      type="submit"
                      disabled={report.status === BugReportStatus.RESOLVED}
                      title="Vyřešeno"
                      className="rounded-full p-1 disabled:cursor-default"
                    >
                      <CheckCircle2
                        className={cn(
                          "h-5 w-5",
                          report.status === BugReportStatus.RESOLVED ? "text-brand-green-600" : "text-slate-300"
                        )}
                      />
                    </button>
                  </form>
                  <form action={updateBugReportStatus.bind(null, report.id, BugReportStatus.REJECTED)}>
                    <button
                      type="submit"
                      disabled={report.status === BugReportStatus.REJECTED}
                      title="Zamítnuto"
                      className="rounded-full p-1 disabled:cursor-default"
                    >
                      <XCircle
                        className={cn(
                          "h-5 w-5",
                          report.status === BugReportStatus.REJECTED ? "text-red-500" : "text-slate-300"
                        )}
                      />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
