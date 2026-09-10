import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Trash2 } from "lucide-react";
import { RULE_TYPE_LABELS } from "@/lib/rules/labels";
import {
  updateWaveInfo,
  addScenario,
  createTemplateAndAddScenario,
  updateScenarioData,
  removeScenario,
  createRule,
  toggleRule,
  deleteRule,
} from "../actions";

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

interface ScenarioDataShape {
  windowStart?: string;
  windowEnd?: string;
}

export default async function WaveSettingsPage({
  params,
  searchParams,
}: {
  params: { projectId: string; waveId: string };
  searchParams: { error?: string };
}) {
  const wave = await prisma.wave.findUnique({
    where: { id: params.waveId },
    include: {
      project: { include: { scenarioTemplates: { orderBy: { name: "asc" } } } },
      scenarios: {
        orderBy: { createdAt: "asc" },
        include: {
          scenarioTemplate: true,
          rules: { orderBy: { createdAt: "asc" } },
          visits: { select: { id: true } },
        },
      },
    },
  });

  if (!wave || wave.projectId !== params.projectId) notFound();

  const attachedTemplateIds = new Set(wave.scenarios.map((s) => s.scenarioTemplateId));
  const availableTemplates = wave.project.scenarioTemplates.filter((t) => !attachedTemplateIds.has(t.id));

  const otherScenarios = await prisma.scenario.findMany({
    where: { wave: { projectId: wave.projectId } },
    include: { scenarioTemplate: true, wave: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href={`/projects/${wave.projectId}/waves/${wave.id}`}>← {wave.name}</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Nastavení vlny</h1>
      </div>

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Základní údaje</h2>
        <form action={updateWaveInfo.bind(null, wave.projectId, wave.id)} className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="name">Název vlny</Label>
              <Input id="name" name="name" defaultValue={wave.name} required />
            </div>
            <div className="w-28">
              <Label htmlFor="year">Rok</Label>
              <Input id="year" name="year" type="number" defaultValue={wave.year ?? ""} min={2000} max={2100} />
            </div>
          </div>
          <div>
            <Label>Měsíce (jde vybrat víc — terén napříč měsíci)</Label>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
              {MONTHS.map((label, index) => (
                <label key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="months"
                    value={index + 1}
                    defaultChecked={wave.months.includes(index + 1)}
                    className="rounded border-slate-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" variant="secondary">
            Uložit
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Scénáře</h2>

        {wave.scenarios.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">Zatím žádné scénáře — přidej první níže.</Card>
        ) : (
          <div className="space-y-6">
            {wave.scenarios.map((scenario) => {
              const data = (scenario.data as ScenarioDataShape | null) ?? null;
              return (
                <Card key={scenario.id}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">{scenario.scenarioTemplate.name}</h3>
                    {scenario.visits.length === 0 ? (
                      <form action={removeScenario.bind(null, wave.projectId, wave.id, scenario.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                          Smazat scénář
                        </Button>
                      </form>
                    ) : (
                      <Badge tone="neutral">{scenario.visits.length} návštěv</Badge>
                    )}
                  </div>

                  <form
                    action={updateScenarioData.bind(null, wave.projectId, wave.id, scenario.id)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`windowStart-${scenario.id}`}>Start terénu</Label>
                        <Input
                          id={`windowStart-${scenario.id}`}
                          name="windowStart"
                          type="datetime-local"
                          defaultValue={data?.windowStart ?? ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`windowEnd-${scenario.id}`}>Konec terénu</Label>
                        <Input
                          id={`windowEnd-${scenario.id}`}
                          name="windowEnd"
                          type="datetime-local"
                          defaultValue={data?.windowEnd ?? ""}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Datum a čas návštěvy (sloupec "RealDate" v datech) se proti tomuhle oknu kontroluje
                      automaticky u každého importu.
                    </p>
                    <Button type="submit" size="sm">
                      Uložit scénář
                    </Button>
                  </form>

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h4 className="mb-1 text-sm font-semibold text-slate-900">Pravidla kontroly</h4>
                    <p className="mb-3 text-xs text-slate-500">
                      Kód otázky = část názvu sloupce před dvojtečkou (např. u sloupce "X20: Délka celé návštěvy
                      (minuty)" je kód otázky "X20").
                    </p>
                    <form
                      action={createRule.bind(null, wave.projectId, wave.id, scenario.id)}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <div>
                        <Label htmlFor={`questionCode-${scenario.id}`}>Kód otázky</Label>
                        <Input id={`questionCode-${scenario.id}`} name="questionCode" placeholder="X20" required />
                      </div>
                      <div>
                        <Label htmlFor={`ruleType-${scenario.id}`}>Typ</Label>
                        <select
                          id={`ruleType-${scenario.id}`}
                          name="type"
                          required
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                        >
                          <option value="REQUIRED">{RULE_TYPE_LABELS.REQUIRED}</option>
                          <option value="ALLOWED_VALUES">{RULE_TYPE_LABELS.ALLOWED_VALUES}</option>
                          <option value="NUMERIC_RANGE">{RULE_TYPE_LABELS.NUMERIC_RANGE}</option>
                        </select>
                      </div>
                      <div className="lg:col-span-2">
                        <Label htmlFor={`allowedValue-${scenario.id}`}>Povolená hodnota</Label>
                        <Input
                          id={`allowedValue-${scenario.id}`}
                          name="allowedValue"
                          placeholder='např. "Ano, Spíše ano" nebo "0-180"'
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4">
                        <p className="mb-2 text-xs text-slate-400">
                          Povolená hodnota se použije jen u typů "Povolené hodnoty" (seznam oddělený čárkou) a
                          "Číselný rozsah" (formát min-max, např. 0-180) — u "Povinné pole" se ignoruje.
                        </p>
                        <Button type="submit" size="sm" variant="secondary">
                          Přidat pravidlo
                        </Button>
                      </div>
                    </form>

                    {scenario.rules.length > 0 && (
                      <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                        {scenario.rules.map((rule) => (
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
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Přidat scénář</h2>

        {wave.project.scenarioTemplates.length === 0 ? (
          <p className="text-sm text-slate-500">Projekt zatím nemá žádné šablony scénářů — vytvoř první níže.</p>
        ) : availableTemplates.length > 0 ? (
          <form action={addScenario.bind(null, wave.projectId, wave.id)} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <Label htmlFor="scenarioTemplateId">Šablona</Label>
              <select
                id="scenarioTemplateId"
                name="scenarioTemplateId"
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
              >
                {availableTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            {otherScenarios.length > 0 && (
              <div className="min-w-[240px]">
                <Label htmlFor="copyFromScenarioId1">Zkopírovat pravidla ze scénáře (nepovinné)</Label>
                <select
                  id="copyFromScenarioId1"
                  name="copyFromScenarioId"
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                >
                  <option value="">— nekopírovat —</option>
                  {otherScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.scenarioTemplate.name} ({s.wave.name})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button type="submit">Přidat scénář</Button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">
            Všechny šablony projektu jsou už v téhle vlně přidané. Novou šablonu jde vytvořit níže.
          </p>
        )}

        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="mb-3 text-sm text-slate-500">
            Nebo vytvoř úplně novou šablonu scénáře (přidá se rovnou i do projektu, ať jde použít i v dalších vlnách):
          </p>
          <form
            action={createTemplateAndAddScenario.bind(null, wave.projectId, wave.id)}
            className="flex flex-wrap items-end gap-4"
          >
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="templateName">Název nové šablony</Label>
              <Input id="templateName" name="templateName" placeholder="např. Cestovní pojištění 2026" required />
            </div>
            {otherScenarios.length > 0 && (
              <div className="min-w-[240px]">
                <Label htmlFor="copyFromScenarioId2">Zkopírovat pravidla ze scénáře (nepovinné)</Label>
                <select
                  id="copyFromScenarioId2"
                  name="copyFromScenarioId"
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                >
                  <option value="">— nekopírovat —</option>
                  {otherScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.scenarioTemplate.name} ({s.wave.name})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button type="submit" variant="secondary">
              Vytvořit a přidat
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
