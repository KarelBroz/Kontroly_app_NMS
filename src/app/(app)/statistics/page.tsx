import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ChevronLeft, ChevronRight, Trophy, ClipboardList, FolderCheck, AlertCircle, Flame } from "lucide-react";
import { getMonthlyActivity, getOpenFindingsByProject, getTopReviewers } from "@/lib/stats/getStats";
import {
  currentYearMonth,
  monthLabel,
  monthRange,
  yearRange,
  shiftMonth,
  isFutureMonth,
} from "@/lib/stats/dateRange";
import { ReviewerPodium } from "@/components/stats/ReviewerPodium";
import { RankedBarList } from "@/components/stats/RankedBarList";
import { cn } from "@/lib/utils";

function periodHref(mode: "month" | "year", year: number, month?: number) {
  const params = new URLSearchParams({ mode, year: String(year) });
  if (mode === "month" && month) params.set("month", String(month));
  return `/statistics?${params.toString()}`;
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: { mode?: string; year?: string; month?: string };
}) {
  const { year: curYear, month: curMonth } = currentYearMonth();
  const mode: "month" | "year" = searchParams.mode === "year" ? "year" : "month";
  const year = Number(searchParams.year) || curYear;
  const month = Number(searchParams.month) || curMonth;

  const range = mode === "year" ? yearRange(year) : monthRange(year, month);
  const periodLabel = mode === "year" ? `Rok ${year}` : `${monthLabel(month)} ${year}`;

  const prev = mode === "year" ? { year: year - 1, month } : shiftMonth(year, month, -1);
  const next = mode === "year" ? { year: year + 1, month } : shiftMonth(year, month, 1);
  const nextDisabled = mode === "year" ? next.year > curYear : isFutureMonth(next.year, next.month);

  const [activity, reviewers, openFindings] = await Promise.all([
    getMonthlyActivity(range),
    getTopReviewers(range),
    getOpenFindingsByProject(),
  ]);

  const top3Reviewers = reviewers.slice(0, 3);
  const restReviewers = reviewers.slice(3).map((r) => ({ key: r.userId, label: r.name, count: r.count }));
  const projectItems = activity.visits.ranked.map((p) => ({
    key: p.projectId,
    label: p.projectName,
    count: p.count,
    href: `/projects/${p.projectId}`,
  }));
  const openFindingItems = openFindings.ranked.map((p) => ({
    key: p.projectId,
    label: p.projectName,
    count: p.count,
    href: `/projects/${p.projectId}`,
  }));

  return (
    <div className="space-y-8">
      {/* Zábavná hlavička */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue-500 via-brand-blue-600 to-purple-600 p-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wide text-white/70">Síň slávy</p>
        <h1 className="mt-1 text-3xl font-bold">📊 Statistiky kontrol</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Kdo zkontroloval nejvíc chyb, kde je práce nejvíc a jak si appka vede napříč měsíci a roky.
        </p>
      </div>

      {/* Přepínač měsíc/rok + navigace v historii */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <Link
            href={periodHref("month", curYear, curMonth)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "month" ? "bg-brand-blue-500 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Měsíčně
          </Link>
          <Link
            href={periodHref("year", curYear)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "year" ? "bg-brand-blue-500 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Ročně
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={periodHref(mode, prev.year, prev.month)}
            title="Předchozí období"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[140px] text-center text-sm font-semibold text-slate-900">{periodLabel}</span>
          {nextDisabled ? (
            <span className="cursor-not-allowed rounded-lg border border-slate-200 p-2 text-slate-300">
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : (
            <Link
              href={periodHref(mode, next.year, next.month)}
              title="Další období"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* KPI za vybrané období */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-brand-blue-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
              <FolderCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">Aktivní projekty · {periodLabel}</p>
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{activity.activeProjects.total}</p>
        </Card>
        <Card className="border-l-4 border-l-brand-green-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">Návštěvy · {periodLabel}</p>
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{activity.visits.total}</p>
        </Card>
      </div>

      {/* Síň slávy kontrolorů */}
      <Card>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Nejpilnější kontroloři</h2>
            <p className="text-xs text-slate-500">Podle počtu vyřešených nálezů · {periodLabel}</p>
          </div>
        </div>
        <ReviewerPodium top3={top3Reviewers} />
        {restReviewers.length > 0 && (
          <div className="mt-8 border-t border-slate-100 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Flame className="h-3.5 w-3.5" />
              Zbytek žebříčku
            </p>
            <RankedBarList items={restReviewers} barColor="bg-purple-400" />
          </div>
        )}
      </Card>

      {/* Návštěvy podle projektu — plný žebříček */}
      <Card>
        <h2 className="mb-1 text-base font-semibold text-slate-900">Návštěvy podle projektu</h2>
        <p className="mb-4 text-xs text-slate-500">{periodLabel}</p>
        <RankedBarList items={projectItems} barColor="bg-brand-green-400" emptyText="V tomhle období zatím nic." />
      </Card>

      {/* Aktuální stav nezkontrolovaného — vždy živé, nezávisí na vybraném období */}
      <Card className="border-l-4 border-l-amber-400">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Čeká na zkontrolování</h2>
            <p className="text-xs text-slate-500">Aktuální stav právě teď — netýká se vybraného období výše</p>
          </div>
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{openFindings.total}</p>
        <div className="mt-4">
          <RankedBarList items={openFindingItems} barColor="bg-amber-400" emptyText="Žádné otevřené nálezy 🎉" />
        </div>
      </Card>
    </div>
  );
}
