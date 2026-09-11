import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ProjectCount } from "@/lib/stats/getStats";

type Accent = "blue" | "green" | "amber";

const ACCENT: Record<Accent, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-brand-blue-50", text: "text-brand-blue-600", border: "border-l-brand-blue-400" },
  green: { bg: "bg-brand-green-50", text: "text-brand-green-600", border: "border-l-brand-green-400" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-l-amber-400" },
};

/** Dlaždice KPI na homepage: velké číslo + top 3 projekty pod tím. */
export function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  ranked,
  unit,
  emptyText = "Zatím nic",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent: Accent;
  ranked: ProjectCount[];
  unit?: string;
  emptyText?: string;
}) {
  const a = ACCENT[accent];
  return (
    <Card className={`border-l-4 ${a.border}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">
        {value}
        {unit && <span className="ml-1 text-lg font-medium text-slate-400">{unit}</span>}
      </p>
      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
        {ranked.length === 0 ? (
          <p className="text-xs text-slate-400">{emptyText}</p>
        ) : (
          ranked.slice(0, 3).map((p, i) => (
            <Link
              key={p.projectId}
              href={`/projects/${p.projectId}`}
              className="-mx-1.5 flex items-center justify-between gap-2 rounded-lg px-1.5 py-0.5 text-xs hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                  {i + 1}
                </span>
                <span className="truncate hover:underline">{p.projectName}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-900">{p.count}</span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
