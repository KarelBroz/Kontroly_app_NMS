import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { FindingStatus } from "@prisma/client";
import {
  updateScenario,
  importWaveFile,
  createRule,
  toggleRule,
  deleteRule,
  rerunWave,
  updateFindingStatus,
} from "./actions";

const RULE_TYPE_LABELS: Record<string, string> = {
  COMPLETENESS: "Vyplněnost a validita",
  SCENARIO: "Soulad se scénářem",
  ATTACHMENTS: "Kontrola příloh",
};

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

interface ScenarioShape {
  expectedBranch?: string;
  windowStart?: string;
  windowEnd?: string;
  keyQuestions?: Array<{ question: string; expectedAnswer: string }>;
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
      rules: { orderBy: { createdAt: "asc" } },
      visits: {
        orderBy: { updatedAt: "desc" },
        include: { findings: { include: { rule: true }, orderBy: { createdAt: "desc" } } },
      },
      importBatches: { orderBy: { createdAt: "desc" }, take: 5, include: { uploadedBy: true } },
    },
  });

  if (!wave || wave.projectId !== params.projectId) notFound();

  const scenario = (wave.scenario as ScenarioShape | null) ?? null;

  const allFindings = wave.visits.flatMap((visit) =>
    visit.findings.map((finding) => ({ ...finding, visit }))
  );

  const importedParts = searchParams.imported?.split("-") ?? null;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href={`/projects/${wave.projectId}`}>← {wave.project.name}</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{wave.name}</h1>
        <div className="mt-3 flex gap-2">
          <Badge tone="neutral">{wave.visits.length} návštěv</Badge>
          <Badge tone="red">
            {allFindings.filter((f) => f.status === FindingStatus.OPEN).length} otevřených nálezů
          </Badge>
        </div>
      </div>

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      {importedParts && (
        <p className="rounded-lg bg-brand-green-50 px-4 py-3 text-sm text-brand-green-700">
          Import hotový — {importedParts[0]} nových, {importedParts[1]} přeskočeno, {importedParts[2]}{" "}
          překontrolováno.
        </p>
      )}

      {/* Scénář vlny */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Scénář vlny</h2>
        <form action={updateScenario.bind(null, wave.projectId, wave.id)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="expectedBranch">Očekávaná pobočka / lokalita</Label>
              <Input id="expectedBranch" name="expectedBranch" defaultValue={scenario?.expectedBranch ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="windowStart">Časové okno od</Label>
                <Input
                  id="windowStart"
                  name="windowStart"
                  type="datetime-local"
                  defaultValue={scenario?.windowStart ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="windowEnd">Časové okno do</Label>
                <Input
                  id="windowEnd"
                  name="windowEnd"
                  type="datetime-local"
                  defaultValue={scenario?.windowEnd ?? ""}
                />
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="keyQuestions">
              Klíčové otázky a očekávané odpovědi (jedna na řádek, ve formátu{" "}
              <code className="rounded bg-slate-100 px-1">otázka | očekávaná odpověď</code>)
            </Label>
            <Textarea
              id="keyQuestions"
              name="keyQuestions"
              rows={4}
              defaultValue={(scenario?.keyQuestions ?? [])
                .map((q) => `${q.question} | ${q.expectedAnswer}`)
                .join("\n")}
              placeholder={"Byl nabídnut věrnostní program? | Ano\nPozdrav na uvítanou? | Ano"}
            />
          </div>
          <Button type="submit">Uložit scénář</Button>
        </form>
      </Card>

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
              <div key={batch.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-slate-700">{batch.fileName}</span>
                <span className="text-slate-500">
                  {new Date(batch.createdAt).toLocaleString("cs-CZ")} · +{batch.rowsNew} nových ·{" "}
                  {batch.rowsSkipped} přeskočeno · {batch.rowsRechecked} překontrolováno
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pravidla kontroly */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Pravidla kontroly</h2>
        <form
          action={createRule.bind(null, wave.projectId, wave.id)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <Label htmlFor="ruleName">Název pravidla</Label>
            <Input id="ruleName" name="name" required />
          </div>
          <div>
            <Label htmlFor="ruleType">Typ</Label>
            <select
              id="ruleType"
              name="type"
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
            >
              <option value="COMPLETENESS">Vyplněnost a validita</option>
              <option value="SCENARIO">Soulad se scénářem</option>
              <option value="ATTACHMENTS">Kontrola příloh</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="ruleConfig">Konfigurace (JSON)</Label>
            <Input id="ruleConfig" name="config" placeholder='{"requiredFields":["q1","q2"]}' />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm">
              Přidat pravidlo
            </Button>
          </div>
        </form>

        {wave.rules.length > 0 && (
          <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
            {wave.rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{rule.name}</span>{" "}
                  <Badge tone="blue" className="ml-2">
                    {RULE_TYPE_LABELS[rule.type]}
                  </Badge>
                  {!rule.isActive && (
                    <Badge tone="neutral" className="ml-2">
                      Neaktivní
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <form action={toggleRule.bind(null, wave.projectId, wave.id, rule.id, !rule.isActive)}>
                    <Button type="submit" variant="secondary" size="sm">
                      {rule.isActive ? "Deaktivovat" : "Aktivovat"}
                    </Button>
                  </form>
                  <form action={deleteRule.bind(null, wave.projectId, wave.id, rule.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Smazat
                    </Button>
                  </form>
                </div>
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
            {allFindings.map((finding) => (
              <div key={finding.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{finding.visit.inspectionId}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{finding.message}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Badge>
                    <Badge tone="neutral">{RULE_TYPE_LABELS[finding.rule.type]}</Badge>
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
