import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Layers, AlertTriangle, Settings } from "lucide-react";
import { createWave, createScenarioTemplate } from "./actions";
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

function formatWavePeriod(wave: { year: number | null; months: number[] }): string | null {
  const monthNames = wave.months.map((m) => MONTHS[m - 1]).filter(Boolean);
  if (monthNames.length > 0 && wave.year) return `${monthNames.join(", ")} ${wave.year}`;
  if (monthNames.length > 0) return monthNames.join(", ");
  if (wave.year) return String(wave.year);
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
      scenarioTemplates: { orderBy: { name: "asc" } },
      waves: {
        orderBy: { createdAt: "desc" },
        include: {
          visits: { select: { id: true } },
          importBatches: { select: { id: true } },
          scenarios: { select: { id: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const stale = project.code ? isProjectCodeStale(project.code) : false;
  const suggested = project.code ? suggestedProjectCode(project.code) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-blue-600">
            <Link href="/projects">← Projekty</Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            {project.code && <Badge tone="blue">Intranet: {project.code}</Badge>}
            {project.navigatorCode && <Badge tone="purple">Navigátor: {project.navigatorCode}</Badge>}
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
        <Link
          href={`/projects/${project.id}/settings`}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Settings className="h-4 w-4" />
          Upravit projekt
        </Link>
      </div>

      {stale && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Kód projektu Intranet <strong>{project.code}</strong> pravděpodobně potřebuje aktualizaci na nový rok
            {suggested && (
              <>
                {" "}
                — navrhovaný nový kód: <strong>{suggested}</strong>
              </>
            )}
            . Kontrola je ruční — pokud to sedí, uprav kód přes "Upravit projekt" vpravo nahoře.
          </p>
        </div>
      )}

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Vlny</h2>
        {project.waves.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">Zatím žádné vlny.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.waves.map((wave) => {
              const period = formatWavePeriod(wave);
              return (
                <Card key={wave.id} className="relative h-full">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
                      <Layers className="h-5 w-5" />
                    </div>
                    {/* z-10, aby zůstalo klikatelné nad "roztaženým" odkazem karty níže */}
                    <Link
                      href={`/projects/${project.id}/waves/${wave.id}/settings`}
                      className="relative z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Nastavení vlny"
                    >
                      <Settings className="h-4 w-4" />
                    </Link>
                  </div>
                  <h3 className="font-semibold text-slate-900">{wave.name}</h3>
                  {period && <p className="mt-1 text-sm text-slate-500">{period}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {wave.scenarios.length === 0 ? (
                      <Badge tone="amber">Chybí scénář</Badge>
                    ) : (
                      <Badge tone="neutral">
                        {wave.scenarios.length} {wave.scenarios.length === 1 ? "scénář" : "scénáře"}
                      </Badge>
                    )}
                    <Badge tone="neutral">{wave.visits.length} návštěv</Badge>
                    <Badge tone="neutral">{wave.importBatches.length} importů</Badge>
                  </div>
                  {/* "roztažený" odkaz — celá dlaždice vede do vlny, kromě prvků s vlastním z-index */}
                  <Link
                    href={`/projects/${project.id}/waves/${wave.id}`}
                    className="absolute inset-0"
                    aria-label={`Otevřít vlnu ${wave.name}`}
                  />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Nová vlna</h2>
        <form action={createWave.bind(null, project.id)} className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="name">Název vlny</Label>
              <Input id="name" name="name" placeholder="např. Q1 2026" required />
            </div>
            <div className="w-28">
              <Label htmlFor="year">Rok (nepovinné)</Label>
              <Input id="year" name="year" type="number" placeholder="2026" min={2000} max={2100} />
            </div>
          </div>
          <div>
            <Label>Měsíce (nepovinné, jde vybrat víc — terén napříč měsíci)</Label>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
              {MONTHS.map((label, index) => (
                <label key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" name="months" value={index + 1} className="rounded border-slate-300" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit">Založit vlnu</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Šablony scénářů</h2>
        <p className="mb-4 text-sm text-slate-500">
          Např. "Cestovní pojištění 2026", "Povinné ručení 2026" — z těchto šablon se pak ve vlně vybírají konkrétní
          scénáře.
        </p>
        {project.scenarioTemplates.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {project.scenarioTemplates.map((template) => (
              <Badge key={template.id} tone="neutral">
                {template.name}
              </Badge>
            ))}
          </div>
        )}
        <form action={createScenarioTemplate.bind(null, project.id)} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="templateName">Nová šablona scénáře</Label>
            <Input id="templateName" name="templateName" placeholder="např. Cestovní pojištění 2026" required />
          </div>
          <Button type="submit" variant="secondary">
            Přidat šablonu
          </Button>
        </form>
      </Card>
    </div>
  );
}
