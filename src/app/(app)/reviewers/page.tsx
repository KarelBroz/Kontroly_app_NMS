import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserCheck } from "lucide-react";

export default async function ReviewersPage() {
  const reviewers = await prisma.reviewer.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { _count: { select: { visits: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Databáze kontrolorů</h1>
        <p className="mt-1 text-sm text-slate-500">
          Externí kontroloři, co ručně procházejí návštěvy před importem do appky. Profil se založí sám podle
          sloupců „Control: Firstname/Surname/Email" při prvním importu s novým e-mailem — nemají vlastní
          přihlášení do appky.
        </p>
      </div>

      <Card className="p-0">
        {reviewers.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            Zatím žádní kontroloři — objeví se sami po prvním importu se sloupci Control: Firstname/Surname/Email.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviewers.map((reviewer) => (
              <div key={reviewer.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {reviewer.firstName || reviewer.lastName ? `${reviewer.firstName} ${reviewer.lastName}`.trim() : "(bez jména)"}
                    </p>
                    <p className="text-xs text-slate-500">{reviewer.email}</p>
                  </div>
                </div>
                <Badge tone="neutral">
                  {reviewer._count.visits} {reviewer._count.visits === 1 ? "návštěva" : "návštěv"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
