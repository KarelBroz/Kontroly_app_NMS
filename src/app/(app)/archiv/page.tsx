import Link from "next/link";
import { Archive, FolderKanban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * Archiv všech šablon scénářů napříč všemi projekty, a u každé kde všude
 * (v jakých vlnách) byla použitá — ne historie ZMĚN, jen přehledný,
 * dohledatelný seznam, ať nic nezapadne v jednotlivých projektech. Čistě
 * ke čtení (bez editace/mazání odsud).
 */
export default async function ArchivPage() {
  const templates = await prisma.scenarioTemplate.findMany({
    include: {
      project: { select: { id: true, name: true } },
      scenarios: {
        include: {
          wave: { select: { id: true, name: true, year: true } },
          _count: { select: { rules: true, visits: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ project: { name: "asc" } }, { name: "asc" }],
  });

  const byProject = new Map<string, { id: string; name: string; templates: typeof templates }>();
  for (const t of templates) {
    const entry = byProject.get(t.project.id) ?? { id: t.project.id, name: t.project.name, templates: [] };
    entry.templates.push(t);
    byProject.set(t.project.id, entry);
  }
  const projects = [...byProject.values()];

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
            <Archive className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Archiv šablon</h1>
        </div>
        <p className="text-sm text-slate-500">
          Všechny šablony scénářů napříč projekty a kde všude (v jakých vlnách) byly použité — pro dohledání a
          znovupoužití. Jen ke čtení; úpravy pravidel se dělají v nastavení konkrétní vlny.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">Zatím žádné šablony scénářů.</Card>
      ) : (
        <div className="space-y-6">
          {projects.map((project) => (
            <Card key={project.id} className="p-0">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                  {project.name}
                </Link>
                <Badge tone="neutral">
                  {project.templates.length} {project.templates.length === 1 ? "šablona" : "šablony"}
                </Badge>
              </div>
              <div className="divide-y divide-slate-100">
                {project.templates.map((template) => (
                  <div key={template.id} className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                    <p className="mb-3 text-xs text-slate-400">
                      Založeno {new Date(template.createdAt).toLocaleDateString("cs-CZ")}
                    </p>
                    {template.scenarios.length === 0 ? (
                      <p className="text-xs text-slate-400">Zatím nepoužita v žádné vlně.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {template.scenarios.map((scenario) => (
                          <Link
                            key={scenario.id}
                            href={`/projects/${project.id}/waves/${scenario.wave.id}/settings`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs hover:bg-slate-100"
                          >
                            <span className="font-medium text-slate-700">
                              {scenario.wave.name}
                              {scenario.wave.year ? ` (${scenario.wave.year})` : ""}
                            </span>
                            <span className="flex items-center gap-2 text-slate-500">
                              <Badge tone="blue">{scenario._count.rules} pravidel</Badge>
                              <Badge tone="neutral">{scenario._count.visits} návštěv</Badge>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
