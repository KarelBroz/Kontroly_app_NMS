import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ReviewerCount } from "@/lib/stats/getStats";

const MEDAL_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

/** Kompaktní žebříček (homepage) — plná "zábavná" verze je na /statistics. */
export function TopReviewersCard({ reviewers, periodLabel }: { reviewers: ReviewerCount[]; periodLabel: string }) {
  const top3 = reviewers.slice(0, 3);
  return (
    <Card className="border-l-4 border-l-purple-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Nejpilnější kontroloři</p>
            <p className="text-xs text-slate-400">{periodLabel}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {top3.length === 0 ? (
          <p className="text-xs text-slate-400">Zatím nikdo nic nevyřešil.</p>
        ) : (
          top3.map((r, i) => (
            <div key={r.userId} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Trophy className={`h-4 w-4 shrink-0 ${MEDAL_COLORS[i]}`} />
                <span className="truncate font-medium text-slate-700">{r.name}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-900">
                {r.count} {r.count === 1 ? "chyba" : r.count < 5 ? "chyby" : "chyb"}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
