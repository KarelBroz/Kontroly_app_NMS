import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, XCircle, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import { FindingStatus, RuleType, SystemCheckType } from "@prisma/client";
import { RULE_TYPE_LABELS, SYSTEM_CHECK_LABELS } from "@/lib/rules/labels";
import { importWaveFile, rerunWave, updateFindingStatus } from "./actions";

const SEVERITY_TONE: Record<string, "green" | "amber" | "red"> = {
  LOW: "green",
  MEDIUM: "amber",
  HIGH: "red",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Otevřeno",
  RESOLVED: "Vyřešeno",
  IGNORED: "Ignorováno",
};

function findingTypeLabel(finding: { rule: { type: RuleType } | null; systemCheck: SystemCheckType | null }) {
  if (finding.rule) return RULE_TYPE_LABELS[finding.rule.type];
  if (finding.systemCheck) return SYSTEM_CHECK_LABELS[finding.systemCheck] ?? "Systémová kontrola";
  return "Systémová kontrola";
}

interface GrammarDetails {
  field?: string;
  context?: string;
  errorWord?: string;
  reason?: string;
}

/** Vykreslí kontext chyby s konkrétní chybnou částí červeně zvýrazněnou. */
function GrammarContext({ context, errorWord }: { context: string; errorWord: string }) {
  if (!errorWord) return <>{context}</>;
  const index = context.indexOf(errorWord);
  if (index === -1) return <>{context}</>;
  return (
    <>
      {context.slice(0, index)}
      <span className="font-semibold text-red-600">{context.slice(index, index + errorWord.length)}</span>
      {context.slice(index + errorWord.length)}
    </>
  );
}

export default async function WaveDetailPage({
  params,
  searchParams,
}: {
  params: { projectId: string; waveId: string };
  searchParams: { error?: string; imported?: string };
}) {
  const wave = await prisma.wave.findUnique({
    where: { id: params.waveId },
    include: {
      project: true,
      scenarios: { include: { scenarioTemplate: true }, orderBy: { createdAt: "asc" } },
      visits: {
        orderBy: { updatedAt: "desc" },
        include: {
          scenario: { include: { scenarioTemplate: true } },
          findings: { include: { rule: true }, orderBy: { createdAt: "desc" } },
        },
      },
      importBatches: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { uploadedBy: true, scenario: { include: { scenarioTemplate: true } } },
      },
    },
  });

  if (!wave || wave.projectId !== params.projectId) notFound();

  const allFindings = wave.visits.flatMap((visit) => visit.findings.map((finding) => ({ ...finding, visit })));
  const importedParts = searchParams.imported?.split("-") ?? null;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-blue-600">
            <Link href={`/projects/${wave.projectId}`}>← {wave.project.name}</Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{wave.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral">{wave.visits.length} návštěv</Badge>
            <Badge tone="red">
              {allFindings.filter((f) => f.status === FindingStatus.OPEN).length} otevřených nálezů
            </Badge>
          </div>
        </div>
        <Link
          href={`/projects/${wave.projectId}/waves/${wave.id}/settings`}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Settings className="h-4 w-4" />
          Nastavení vlny
        </Link>
      </div>

      {wave.scenarios.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <p className="max-w-sm text-sm text-slate-600">
            Tahle vlna zatím nemá nastavený žádný scénář — bez něj se sem nedá nic naimportovat ani zkontrolovat.
          </p>
          <Link href={`/projects/${wave.projectId}/waves/${wave.id}/settings`}>
            <Button>Nastavit scénář vlny</Button>
          </Link>
        </Card>
      ) : (
        <>
          {searchParams.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
          )}
          {importedParts && (
            <p className="rounded-lg bg-brand-green-50 px-4 py-3 text-sm text-brand-green-700">
              Import hotový — {importedParts[0]} nových, {importedParts[1]} přeskočeno, {importedParts[2]}{" "}
              překontrolováno.
            </p>
          )}

          {/* Import dat */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Import dat</h2>
              <form action={rerunWave.bind(null, wave.projectId, wave.id)}>
                <Button type="submit" variant="secondary" size="sm">
                  <RefreshCw className="h-4 w-4" />
                  Spustit kontrolu znovu (celá vlna)
                </Button>
              </form>
            </div>
            <form
              action={importWaveFile.bind(null, wave.projectId, wave.id)}
              className="flex flex-wrap items-end gap-4"
            >
              <div className="w-56">
                <Label htmlFor="scenarioId">Scénář</Label>
                <select
                  id="scenarioId"
                  name="scenarioId"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                >
                  {wave.scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.scenarioTemplate.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[240px] flex-1">
                <Label htmlFor="file">Soubor (.xlsx, .csv)</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-brand-blue-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-brand-blue-700 hover:file:bg-brand-blue-100"
                />
              </div>
              <Button type="submit">Nahrát a zkontrolovat</Button>
            </form>

            {wave.importBatches.length > 0 && (
              <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
                {wave.importBatches.map((batch) => (
                  <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">{batch.fileName}</span>
                      <Badge tone="blue">{batch.scenario.scenarioTemplate.name}</Badge>
                    </div>
                    <span className="text-slate-500">
                      {new Date(batch.createdAt).toLocaleString("cs-CZ")} · +{batch.rowsNew} nových ·{" "}
                      {batch.rowsSkipped} přeskočeno · {batch.rowsRechecked} překontrolováno
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Nálezy */}
          <Card className="p-0">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Nálezy</h2>
            </div>
            {allFindings.length === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-500">Zatím žádné nálezy.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {allFindings.map((finding) => {
                  const grammarDetails =
                    finding.systemCheck === SystemCheckType.GRAMMAR
                      ? (finding.details as GrammarDetails | null)
                      : null;

                  return (
                  <div key={finding.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {finding.visit.inspectionId}{" "}
                        <span className="font-normal text-slate-400">
                          · {finding.visit.scenario.scenarioTemplate.name}
                        </span>
                      </p>
                      {grammarDetails?.context ? (
                        <p className="mt-0.5 text-sm text-slate-600">
                          {grammarDetails.field && (
                            <span className="font-medium text-slate-700">{grammarDetails.field}: </span>
                          )}
                          <GrammarContext context={grammarDetails.context} errorWord={grammarDetails.errorWord ?? ""} />
                          {grammarDetails.reason && (
                            <span className="ml-1 text-xs text-slate-400">({grammarDetails.reason})</span>
                          )}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-slate-600">{finding.message}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Badge>
                        <Badge tone="neutral">{findingTypeLabel(finding)}</Badge>
                        <Badge tone={finding.status === FindingStatus.OPEN ? "red" : "green"}>
                          {STATUS_LABELS[finding.status]}
                        </Badge>
                      </div>
                    </div>
                    {finding.status === FindingStatus.OPEN && (
                      <div className="flex shrink-0 gap-2">
                        <form
                          action={updateFindingStatus.bind(
                            null,
                            wave.projectId,
                            wave.id,
                            finding.id,
                            FindingStatus.RESOLVED
                          )}
                        >
                          <Button type="submit" variant="secondary" size="sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Vyřešeno
                          </Button>
                        </form>
                        <form
                          action={updateFindingStatus.bind(
                            null,
                            wave.projectId,
                            wave.id,
                            finding.id,
                            FindingStatus.IGNORED
                          )}
                        >
                          <Button type="submit" variant="ghost" size="sm">
                            <XCircle className="h-4 w-4" />
                            Ignorovat
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
