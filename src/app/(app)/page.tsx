import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FolderKanban, Upload, Plus, FolderCheck, ClipboardList, AlertCircle } from "lucide-react";
import { fixMojibakeFileName } from "@/lib/fixMojibakeFileName";
import { StatTile } from "@/components/stats/StatTile";
import { TopReviewersCard } from "@/components/stats/TopReviewersCard";
import { WavesAttentionCard } from "@/components/stats/WavesAttentionCard";
import {
  getMonthlyActivity,
  getOpenFindingsByProject,
  getTopReviewers,
  getWavesNeedingAttention,
} from "@/lib/stats/getStats";
import { currentYearMonth, monthLabel, monthRange } from "@/lib/stats/dateRange";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  // Jen křestní jméno z profilu (User.name je "Jméno Příjmení").
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || null;

  const { year, month } = currentYearMonth();
  const range = monthRange(year, month);
  const periodLabel = `${monthLabel(month)} ${year}`;

  const [projects, recentBatches, monthlyActivity, openFindings, topReviewers, wavesNeedingAttention] =
    await Promise.all([
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { waves: { select: { id: true } } },
      }),
      prisma.importBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { wave: { include: { project: true } }, uploadedBy: true },
      }),
      getMonthlyActivity(range),
      getOpenFindingsByProject(),
      getTopReviewers(range),
      getWavesNeedingAttention(),
    ]);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {firstName ? `Vítej zpátky, ${firstName} 👋` : "Vítej zpátky 👋"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Přehled projektů a poslední aktivity.</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4" />
            Nový projekt
          </Button>
        </Link>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Statistiky</h2>
          <Link href="/statistics" className="text-xs font-medium text-brand-blue-600 hover:underline">
            Zobrazit vše →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={FolderCheck}
            label="Aktivní projekty"
            value={monthlyActivity.activeProjects.total}
            accent="blue"
            ranked={monthlyActivity.activeProjects.ranked}
            unit={periodLabel}
            emptyText="Zatím žádná aktivita"
          />
          <StatTile
            icon={ClipboardList}
            label="Návštěvy"
            value={monthlyActivity.visits.total}
            accent="green"
            ranked={monthlyActivity.visits.ranked}
            unit={periodLabel}
            emptyText="Zatím žádné návštěvy"
          />
          <StatTile
            icon={AlertCircle}
            label="Čeká na zkontrolování"
            value={openFindings.total}
            accent="amber"
            ranked={openFindings.ranked}
            unit="teď"
            emptyText="Žádné otevřené nálezy 🎉"
          />
          <TopReviewersCard reviewers={topReviewers} periodLabel={periodLabel} />
        </div>
      </section>

      {wavesNeedingAttention.length > 0 && (
        <section>
          <WavesAttentionCard waves={wavesNeedingAttention} />
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Projekty</h2>
        {projects.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">
            Zatím žádné projekty.{" "}
            <Link href="/projects/new" className="font-medium text-brand-blue-600">
              Založit první projekt →
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full cursor-pointer">
                  {project.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.logoUrl}
                      alt=""
                      className="mb-3 h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain"
                    />
                  ) : (
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                  )}
                  <h3 className="font-semibold text-slate-900">{project.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{project.client}</p>
                  <div className="mt-4">
                    <Badge tone="blue">
                      {project.waves.length} {project.waves.length === 1 ? "vlna" : "vln"}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Poslední aktivita</h2>
        {recentBatches.length === 0 ? (
          <Card className="text-sm text-slate-500">Zatím žádné importy dat.</Card>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {recentBatches.map((batch) => (
              <Link
                key={batch.id}
                href={`/projects/${batch.wave.projectId}/waves/${batch.waveId}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {batch.wave.project.name} — {batch.wave.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fixMojibakeFileName(batch.fileName)} · nahrál{" "}
                      {batch.uploadedBy?.name ?? batch.uploadedBy?.email ?? "neznámý"}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{new Date(batch.createdAt).toLocaleString("cs-CZ")}</p>
                  <p>
                    +{batch.rowsNew} nových · {batch.rowsRechecked} překontrolováno
                  </p>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
