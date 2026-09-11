import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { WaveAttention } from "@/lib/stats/getStats";

function daysLabel(diffDays: number): string {
  const n = Math.abs(diffDays);
  const unit = n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní";
  return `${n} ${unit}`;
}

/**
 * Vlny, co se blíží (nebo už uplynul) Konec terénu a ještě mají otevřené
 * nálezy — ať nezapadnou, když se pozornost soustředí na aktuální rozdělanou
 * práci jinde. Zobrazí se jen když nějaké takové vlny existují.
 */
export function WavesAttentionCard({ waves }: { waves: WaveAttention[] }) {
  if (waves.length === 0) return null;

  const now = Date.now();

  return (
    <Card className="border-l-4 border-l-amber-400">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Vyžadují pozornost</h2>
          <p className="text-xs text-slate-500">Blíží se/uplynul konec terénu a jsou tam otevřené nálezy.</p>
        </div>
      </div>
      <div className="space-y-2">
        {waves.map((w) => {
          const diffDays = Math.round((w.earliestWindowEnd.getTime() - now) / (24 * 60 * 60 * 1000));
          return (
            <Link
              key={w.waveId}
              href={`/projects/${w.projectId}/waves/${w.waveId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/60 px-3.5 py-2.5 hover:bg-amber-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {w.projectName} — {w.waveName}
                </p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {w.isOverdue
                    ? `Konec terénu byl před ${daysLabel(diffDays)}`
                    : diffDays === 0
                      ? "Konec terénu je dnes"
                      : `Konec terénu za ${daysLabel(diffDays)}`}
                </p>
              </div>
              <Badge tone="red">
                {w.openFindingsCount} {w.openFindingsCount === 1 ? "otevřený nález" : "otevřených nálezů"}
              </Badge>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
