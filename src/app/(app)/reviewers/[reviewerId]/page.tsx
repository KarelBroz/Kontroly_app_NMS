import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { UserCheck, ClipboardList, AlertCircle, Trophy } from "lucide-react";
import { getReviewerPerformance } from "@/lib/stats/reviewerStats";

function successTone(rate: number): BadgeTone {
  if (rate >= 80) return "green";
  if (rate >= 50) return "amber";
  return "red";
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate)} %`;
}

function formatAvg(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(1);
}

export default async function ReviewerDetailPage({ params }: { params: { reviewerId: string } }) {
  const reviewer = await prisma.reviewer.findUnique({ where: { id: params.reviewerId } });
  if (!reviewer) notFound();

  const { overall, byProject } = await getReviewerPerformance(reviewer.id);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href="/reviewers">← Databáze kontrolorů</Link>
        </p>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {reviewer.firstName || reviewer.lastName ? `${reviewer.firstName} ${reviewer.lastName}`.trim() : "(bez jména)"}
            </h1>
            <p className="text-sm text-slate-500">{reviewer.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-brand-blue-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">Počet kontrol celkem</p>
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{overall.totalChecks}</p>
        </Card>
        <Card className="border-l-4 border-l-amber-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">Chyb na kontrolu (průměr)</p>
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{formatAvg(overall.avgErrorsPerCheck)}</p>
        </Card>
        <Card className="border-l-4 border-l-brand-green-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">Úspěšnost bez chyby</p>
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{formatRate(overall.successRate)}</p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Podle projektu</h2>
          <p className="text-xs text-slate-500">Stejné statistiky, rozdělené po jednotlivých projektech.</p>
        </div>
        {byProject.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">Zatím žádná vyhodnocená kontrola.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {byProject.map((p) => (
              <Link
                key={p.projectId}
                href={`/projects/${p.projectId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900 hover:underline">{p.projectName}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="neutral">{p.totalChecks} kontrol</Badge>
                  <Badge tone="neutral">{formatAvg(p.avgErrorsPerCheck)} chyb/kontrolu</Badge>
                  {p.successRate !== null && (
                    <Badge tone={successTone(p.successRate)}>{formatRate(p.successRate)} bez chyby</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
