import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { UserCheck } from "lucide-react";
import { getReviewerSuccessRates } from "@/lib/stats/reviewerStats";

function pluralizeKontrol(n: number): string {
  if (n === 1) return "kontrola";
  if (n >= 2 && n <= 4) return "kontroly";
  return "kontrol";
}

function successTone(rate: number): BadgeTone {
  if (rate >= 80) return "green";
  if (rate >= 50) return "amber";
  return "red";
}

export default async function ReviewersPage() {
  const [reviewers, successRates] = await Promise.all([
    prisma.reviewer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getReviewerSuccessRates(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Databáze kontrolorů</h1>
        <p className="mt-1 text-sm text-slate-500">
          Externí kontroloři, co ručně procházejí návštěvy před importem do appky. Profil se založí sám podle
          sloupců „Control: Firstname/Surname/Email" při prvním importu s novým e-mailem — nemají vlastní
          přihlášení do appky. Úspěšnost je podíl kontrol bez jediného nálezu v okamžiku importu (pozdější ruční
          opravy v appce ji zpětně nemění).
        </p>
      </div>

      <Card className="p-0">
        {reviewers.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            Zatím žádní kontroloři — objeví se sami po prvním importu se sloupci Control: Firstname/Surname/Email.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviewers.map((reviewer) => {
              const perf = successRates.get(reviewer.id);
              return (
                <Link
                  key={reviewer.id}
                  href={`/reviewers/${reviewer.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {reviewer.firstName || reviewer.lastName
                          ? `${reviewer.firstName} ${reviewer.lastName}`.trim()
                          : "(bez jména)"}
                      </p>
                      <p className="text-xs text-slate-500">{reviewer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {perf && perf.successRate !== null && (
                      <Badge tone={successTone(perf.successRate)}>{Math.round(perf.successRate)} % bez chyby</Badge>
                    )}
                    <Badge tone="neutral">
                      {perf?.totalChecks ?? 0} {pluralizeKontrol(perf?.totalChecks ?? 0)}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
