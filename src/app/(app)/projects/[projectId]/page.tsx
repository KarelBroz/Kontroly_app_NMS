import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Layers, AlertTriangle } from "lucide-react";
import { createWave, updateProject } from "./actions";
import { isProjectCodeStale, suggestedProjectCode } from "@/lib/projectCode";

const MONTHS = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

function formatWavePeriod(wave: { year: number | null; month: number | null }): string | null {
  if (wave.year && wave.month) return `${MONTHS[wave.month - 1]} ${wave.year}`;
  if (wave.year) return String(wave.year);
  if (wave.month) return MONTHS[wave.month - 1];
  return null;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { error?: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      waves: {
        orderBy: { createdAt: "desc" },
        include: { visits: { select: { id: true } }, importBatches: { select: { id: true } } },
      },
    },
  });

  if (!project) notFound();

  const stale = project.code ? isProjectCodeStale(project.code) : false;
  const suggested = project.code ? suggestedProjectCode(project.code) : null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href="/projects">← Projekty</Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          {project.code && <Badge tone="blue">{project.code}</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-500">{project.client}</p>
        {(project.projectManager || project.accountManager) && (
          <p className="mt-1 text-sm text-slate-500">
            {project.projectManager && <>PM: {project.projectManager}</>}
            {project.projectManager && project.accountManager && " · "}
            {project.accountManager && <>AM: {project.accountManager}</>}
          </p>
        )}
        {project.description && <p className="mt-2 max-w-2xl text-sm text-slate-600">{project.description}</p>}
      </div>

      {stale && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Kód projektu <strong>{project.code}</strong> pravděpodobně potřebuje aktualizaci na nový rok
            {suggested && (
              <>
                {" "}
                — navrhovaný nový kód: <strong>{suggested}</strong>
              </>
            )}
            . Kontrola je ruční — pokud to sedí, uprav kód níže v sekci "Upravit projekt".
          </p>
        </div>
      )}

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Upravit projekt</h2>
        <form action={updateProject.bind(null, project.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-name">Název projektu</Label>
            <Input id="edit-name" name="name" defaultValue={project.name} required />
          </div>
          <div>
            <Label htmlFor="edit-client">Klient</Label>
            <Input id="edit-client" name="client" defaultValue={project.client} required />
          </div>
          <div>
            <Label htmlFor="edit-code">Kód projektu</Label>
            <Input id="edit-code" name="code" defaultValue={project.code ?? ""} placeholder="CZ26222" required />
          </div>
          <div>
            <Label htmlFor="edit-projectManager">Projektový manažer</Label>
            <Input
              id="edit-projectManager"
              name="projectManager"
              defaultValue={project.projectManager ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-accountManager">Account manager</Label>
            <Input
              id="edit-accountManager"
              name="accountManager"
              defaultValue={project.accountManager ?? ""}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-description">Popis (nepovinné)</Label>
            <Textarea id="edit-description" name="description" rows={3} defaultValue={project.description ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary">
              Uložit změny
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Nová vlna</h2>
        <form action={createWave.bind(null, project.id)} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="name">Název vlny</Label>
            <Input id="name" name="name" placeholder="např. Q1 2026" required />
          </div>
          <div className="w-28">
            <Label htmlFor="year">Rok (nepovinné)</Label>
            <Input id="year" name="year" type="number" placeholder="2026" min={2000} max={2100} />
          </div>
          <div className="w-40">
            <Label htmlFor="month">Měsíc (nepovinné)</Label>
            <select
              id="month"
              name="month"
              defaultValue=""
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
            >
              <option value="">—</option>
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Založit vlnu</Button>
        </form>
      </Card>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Vlny</h2>
        {project.waves.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">Zatím žádné vlny.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.waves.map((wave) => {
              const period = formatWavePeriod(wave);
              return (
                <Link key={wave.id} href={`/projects/${project.id}/waves/${wave.id}`}>
                  <Card className="h-full cursor-pointer">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
                      <Layers className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900">{wave.name}</h3>
                    {period && <p className="mt-1 text-sm text-slate-500">{period}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="neutral">{wave.visits.length} návštěv</Badge>
                      <Badge tone="neutral">{wave.importBatches.length} importů</Badge>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
