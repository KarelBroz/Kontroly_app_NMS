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
import { RuleTypeField } from "@/components/rules/RuleTypeField";
import {
  updateWaveInfo,
  addScenario,
  createTemplateAndAddScenario,
  updateScenarioSettings,
  removeScenario,
  createRule,
  deleteRule,
  bulkCreateRules,
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

const WEEKDAYS = [
  { day: 1, label: "Pondělí" },
  { day: 2, label: "Úterý" },
  { day: 3, label: "Středa" },
  { day: 4, label: "Čtvrtek" },
  { day: 5, label: "Pátek" },
  { day: 6, label: "Sobota" },
  { day: 7, label: "Neděle" },
];

interface WeeklyWindowShape {
  day: number;
  startHour: number;
  endHour: number;
}

interface ScenarioDataShape {
  windowStart?: string;
  windowEnd?: string;
  weeklyWindows?: WeeklyWindowShape[];
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

                  {/* Jeden formulář pro celý scénář — Start/Konec terénu i aktivita pravidel se uloží
                      najednou tlačítkem "Uložit" dole. Přidání/smazání pravidla používá formAction
                      na jinou akci (createRule/deleteRule), takže proběhne okamžitě bez ohledu na
                      to, co je zrovna rozepsané v ostatních polích. */}
                  <form
                    action={updateScenarioSettings.bind(null, wave.projectId, wave.id, scenario.id)}
                    className="space-y-6"
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

                    <div className="border-t border-slate-100 pt-6">
                      <h4 className="mb-1 text-sm font-semibold text-slate-900">
                        Opakující se týdenní rozvrh (nepovinné)
                      </h4>
                      <p className="mb-3 text-xs text-slate-500">
                        Pro scénáře typu "mimo špička"/"špička" — kdy v týdnu (a v kolik hodin) se smí návštěva
                        odehrát. Nezaškrtnutý den (např. neděle) = v ten den se nejezdí, každá návštěva z toho dne
                        se nahlásí jako mimo okno. Když není zaškrtnutý žádný den, kontroluje se jen Start/Konec
                        terénu výše.
                      </p>
                      <div className="space-y-1.5">
                        {WEEKDAYS.map(({ day, label }) => {
                          const existing = data?.weeklyWindows?.find((w) => w.day === day);
                          return (
                            <div key={day} className="flex flex-wrap items-center gap-3 text-sm">
                              <label className="flex w-32 shrink-0 items-center gap-2">
                                <input
                                  type="checkbox"
                                  name={`weeklyDay_${day}`}
                                  defaultChecked={Boolean(existing)}
                                  className="rounded border-slate-300"
                                />
                                {label}
                              </label>
                              <span className="text-xs text-slate-400">od</span>
                              <input
                                type="number"
                                name={`weeklyStart_${day}`}
                                min={0}
                                max={24}
                                step={0.5}
                                defaultValue={existing?.startHour ?? ""}
                                placeholder="8"
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                              />
                              <span className="text-xs text-slate-400">do</span>
                              <input
                                type="number"
                                name={`weeklyEnd_${day}`}
                                min={0}
                                max={24}
                                step={0.5}
                                defaultValue={existing?.endHour ?? ""}
                                placeholder="19"
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                              />
                              <span className="text-xs text-slate-400">hodin</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {scenario.rules.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-900">Pravidla kontroly</h4>
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                          {scenario.rules.map((rule) => (
                            <div key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  name={`active_${rule.id}`}
                                  defaultChecked={rule.isActive}
                                  className="rounded border-slate-300"
                                />
                                <span className="font-medium text-slate-900">{rule.name}</span>
                                <Badge tone="blue">{RULE_TYPE_LABELS[rule.type]}</Badge>
                              </label>
                              <Button
                                type="submit"
                                formAction={deleteRule.bind(null, wave.projectId, wave.id, rule.id)}
                                formNoValidate
                                variant="ghost"
                                size="sm"
                              >
                                Smazat
                              </Button>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">
                          Odškrtnutím pravidlo dočasně vypneš — uloží se spolu se vším ostatním tlačítkem "Uložit"
                          dole.
                        </p>
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-6">
                      <h4 className="mb-1 text-sm font-semibold text-slate-900">Přidat nové pravidlo</h4>
                      <p className="mb-3 text-xs text-slate-500">
                        Kód otázky = část názvu sloupce před dvojtečkou (např. u sloupce "X20: Délka celé návštěvy
                        (minuty)" je kód otázky "X20").
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <RuleTypeField idPrefix={scenario.id} />
                        <div className="sm:col-span-2 lg:col-span-4">
                          <Button
                            type="submit"
                            formAction={createRule.bind(null, wave.projectId, wave.id, scenario.id)}
                            variant="secondary"
                            size="sm"
                          >
                            Přidat pravidlo
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-6">
                      <Button type="submit" formNoValidate>
                        Uložit
                      </Button>
                    </div>
                  </form>

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h4 className="mb-1 text-sm font-semibold text-slate-900">Hromadně přidat pravidla</h4>
                    <p className="mb-3 text-xs text-slate-500">
                      Jeden řádek = jedno pravidlo, formát{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5">TYP|KÓD_OTÁZKY|hodnota</code>. Typ je
                      jedno z REQUIRED / ALLOWED_VALUES / NUMERIC_RANGE / CONDITIONAL_REQUIRED / PRODUCT_ALLOWLIST /
                      NUMERIC_THRESHOLD_CONSISTENCY. Hodnota podle typu: u ALLOWED_VALUES a PRODUCT_ALLOWLIST seznam
                      oddělený čárkou, u NUMERIC_RANGE "min-max" (např. 0-10), u CONDITIONAL_REQUIRED "hodnota
                      -&gt; KÓD" (povinné, když se NEROVNÁ, např. "Ano -&gt; SCO1t"), "=hodnota -&gt; KÓD" (povinné,
                      když se PŘESNĚ ROVNÁ, např. "=Jiné_ -&gt; SCO1j") nebo "~hodnota -&gt; KÓD" (povinné, když
                      odpověď hodnotu OBSAHUJE, pro vícevýběrové otázky), u NUMERIC_THRESHOLD_CONSISTENCY "práh -&gt;
                      KÓD: hodnota_do_prahu / hodnota_nad_prahem" (např. "3 -&gt; I07: Ano / Ne"), u REQUIRED se
                      hodnota vynechává. Řádek{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5">DELETE|TYP|KÓD_OTÁZKY</code> smaže
                      existující pravidlo tohoto typu a kódu — hodí se pro opravu (smazat staré, hned pod tím
                      přidat nové).
                    </p>
                    <form
                      action={bulkCreateRules.bind(null, wave.projectId, wave.id, scenario.id)}
                      className="space-y-3"
                    >
                      <textarea
                        name="bulkRules"
                        rows={4}
                        placeholder={"REQUIRED|X02\nALLOWED_VALUES|I01|Ano,Ne,Nehodnoceno\nCONDITIONAL_REQUIRED|SCO1|Ano -> SCO1t\nCONDITIONAL_REQUIRED|SCO1t|=Jiné_ -> SCO1j"}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Přidat všechna pravidla
                      </Button>
                    </form>
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
