import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FolderKanban, AlertTriangle, Plus } from "lucide-react";
import { isProjectCodeStale, suggestedProjectCode } from "@/lib/projectCode";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { waves: { select: { id: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projekty</h1>
          <p className="mt-1 text-sm text-slate-500">Všechny projekty a rychlé založení nového.</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4" />
            Nový projekt
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          Zatím žádné projekty.{" "}
          <Link href="/projects/new" className="font-medium text-brand-blue-600">
            Založit první projekt →
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const stale = project.code ? isProjectCodeStale(project.code) : false;
            const suggested = project.code ? suggestedProjectCode(project.code) : null;

            return (
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
                  {project.code && <p className="mt-1 text-xs text-slate-400">{project.code}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="blue">
                      {project.waves.length} {project.waves.length === 1 ? "vlna" : "vln"}
                    </Badge>
                    {stale && (
                      <Badge tone="amber" className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Aktualizovat kód{suggested ? ` → ${suggested}` : ""}
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
