import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  AlertTriangle,
  Trash2,
  Upload,
  ClipboardCheck,
  Filter,
  Download,
} from "lucide-react";
import { FindingStatus, RuleType, SystemCheckType } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/Badge";
import { RULE_TYPE_LABELS, SYSTEM_CHECK_LABELS } from "@/lib/rules/labels";
import { isVisitDataEmpty } from "@/lib/visits/emptyVisit";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { LoadingSubmitButton } from "@/components/ui/LoadingSubmitButton";
import { NavigatorLink } from "@/components/ui/NavigatorLink";
import { buildNavigatorUrl } from "@/lib/navigator";
import { fixMojibakeFileName } from "@/lib/fixMojibakeFileName";
import { cn } from "@/lib/utils";
import { importWaveFile, rerunWave, updateFindingStatus, deleteImportBatch } from "./actions";
import { buildVisitWhere } from "./visitFilters";

const PAGE_SIZE = 50;
const STATUS_OPTIONS = [
  { value: "all", label: "Všechny" },
  { value: "error", label: "S chybou" },
  { value: "clean", label: "Bez chyby" },
  { value: "empty", label: "Bez odpovědí" },
];
const SORT_OPTIONS = [
  { value: "priority", label: "Chybové nahoře (výchozí)" },
  { value: "newest", label: "Nejnovější první" },
  { value: "oldest", label: "Nejstarší první" },
  { value: "id", label: "ID kontroly A→Z" },
];

// Každá kategorie nálezu má vlastní barvu, ať se dá napříč přehledem rychle rozlišit.
const RULE_TYPE_TONE: Record<RuleType, BadgeTone> = {
  [RuleType.REQUIRED]: "blue",
  [RuleType.ALLOWED_VALUES]: "purple",
  [RuleType.NUMERIC_RANGE]: "cyan",
  [RuleType.CONDITIONAL_REQUIRED]: "indigo",
  [RuleType.PRODUCT_ALLOWLIST]: "green",
  [RuleType.NUMERIC_THRESHOLD_CONSISTENCY]: "amber",
};
const SYSTEM_CHECK_TONE: Record<string, BadgeTone> = {
  [SystemCheckType.REAL_DATE_WINDOW]: "amber",
  [SystemCheckType.GRAMMAR]: "indigo",
};

function findingTypeLabel(finding: { rule: { type: RuleType } | null; systemCheck: SystemCheckType | null }) {
  if (finding.rule) return RULE_TYPE_LABELS[finding.rule.type];
  if (finding.systemCheck) return SYSTEM_CHECK_LABELS[finding.systemCheck] ?? "Systémová kontrola";
  return "Systémová kontrola";
}

function findingTypeTone(finding: { rule: { type: RuleType } | null; systemCheck: SystemCheckType | null }): BadgeTone {
  if (finding.rule) return RULE_TYPE_TONE[finding.rule.type];
  if (finding.systemCheck) return SYSTEM_CHECK_TONE[finding.systemCheck] ?? "neutral";
  return "neutral";
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

/** Kód otázky, ke které nález patří (pro proklik do Navigátoru rovnou na správné místo) — kontrola data terénu se žádné konkrétní otázky netýká. */
function findingQuestionCode(finding: {
  rule: { config: unknown } | null;
  systemCheck: SystemCheckType | null;
  details: unknown;
}): string | null {
  if (finding.rule) {
    const config = finding.rule.config as { questionCode?: string } | null;
    return config?.questionCode?.trim() || null;
  }
  if (finding.systemCheck === SystemCheckType.GRAMMAR) {
    const details = finding.details as { field?: string } | null;
    return details?.field?.split(":")[0]?.trim() || null;
  }
  return null;
}

/** Iniciály kontrolora (jméno + příjmení -> 2 písmena pod sebou), kdo nález naposledy ručně vyhodnotil. */
function reviewerInitials(user: { name: string | null; email: string | null } | null | undefined): string[] | null {
  if (!user) return null;
  const nameParts = user.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (nameParts.length >= 2) {
    return [nameParts[0][0].toUpperCase(), nameParts[nameParts.length - 1][0].toUpperCase()];
  }
  if (nameParts.length === 1) return [nameParts[0][0].toUpperCase()];
  if (user.email) return [user.email[0].toUpperCase()];
  return null;
}

export default async function WaveDetailPage({
  params,
  searchParams,
}: {
  params: { projectId: string; waveId: string };
  searchParams: {
    error?: string;
    imported?: string;
    scenario?: string;
    status?: string;
    reviewer?: string;
    q?: string;
    sort?: string;
    page?: string;
  };
}) {
  const wave = await prisma.wave.findUnique({
    where: { id: params.waveId },
    include: {
      project: true,
      scenarios: { include: { scenarioTemplate: true }, orderBy: { createdAt: "asc" } },
      importBatches: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { uploadedBy: true, scenario: { include: { scenarioTemplate: true } } },
      },
    },
  });

  if (!wave || wave.projectId !== params.projectId) notFound();

  // Celkové počty pro záhlaví stránky — VŽDY za celou vlnu, bez ohledu na filtry níže.
  const [totalVisitCount, totalOpenFindingsCount, reviewerOptions] = await Promise.all([
    prisma.visit.count({ where: { waveId: wave.id } }),
    prisma.finding.count({ where: { status: FindingStatus.OPEN, visit: { waveId: wave.id } } }),
    prisma.reviewer.findMany({
      where: { visits: { some: { waveId: wave.id } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const statusFilter = searchParams.status && searchParams.status !== "all" ? searchParams.status : "all";
  const visitWhere = buildVisitWhere(wave.id, {
    scenario: searchParams.scenario,
    reviewer: searchParams.reviewer,
    q: searchParams.q,
  });

  const filteredVisits = await prisma.visit.findMany({
    where: visitWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      scenario: { include: { scenarioTemplate: true } },
      reviewer: true,
      findings: { include: { rule: true, reviewedBy: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const importedParts = searchParams.imported?.split("-") ?? null;
  const hasActiveFilters = Boolean(
    (searchParams.scenario && searchParams.scenario !== "all") ||
      (searchParams.reviewer && searchParams.reviewer !== "all") ||
      (searchParams.status && searchParams.status !== "all") ||
      searchParams.q?.trim()
  );

  // Návštěvy (po filtrech výše): chybové nahoře (od nejvíc problémových),
  // čisté uprostřed, bez odpovědí (MS založené, terén zatím neproběhl) šedě
  // úplně dole.
  const emptyVisits: typeof filteredVisits = [];
  const errorVisits: typeof filteredVisits = [];
  const cleanVisits: typeof filteredVisits = [];

  for (const visit of filteredVisits) {
    if (isVisitDataEmpty(visit.data as Record<string, unknown>)) {
      emptyVisits.push(visit);
    } else if (visit.findings.some((f) => f.status === FindingStatus.OPEN)) {
      errorVisits.push(visit);
    } else {
      cleanVisits.push(visit);
    }
  }
  errorVisits.sort(
    (a, b) =>
      b.findings.filter((f) => f.status === FindingStatus.OPEN).length -
      a.findings.filter((f) => f.status === FindingStatus.OPEN).length
  );

  const statusFiltered =
    statusFilter === "error"
      ? errorVisits
      : statusFilter === "clean"
        ? cleanVisits
        : statusFilter === "empty"
          ? emptyVisits
          : [...errorVisits, ...cleanVisits, ...emptyVisits];

  const sortMode = searchParams.sort && searchParams.sort !== "priority" ? searchParams.sort : "priority";
  const bucketed =
    sortMode === "priority"
      ? statusFiltered
      : [...statusFiltered].sort((a, b) => {
          if (sortMode === "newest") return b.updatedAt.getTime() - a.updatedAt.getTime();
          if (sortMode === "oldest") return a.updatedAt.getTime() - b.updatedAt.getTime();
          if (sortMode === "id") return a.inspectionId.localeCompare(b.inspectionId, "cs");
          return 0;
        });

  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(bucketed.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const orderedVisits = bucketed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Query string pro odkazy stránkování/exportu — zachová aktuální filtry.
  const filterQuery = new URLSearchParams();
  if (searchParams.scenario && searchParams.scenario !== "all") filterQuery.set("scenario", searchParams.scenario);
  if (searchParams.reviewer && searchParams.reviewer !== "all") filterQuery.set("reviewer", searchParams.reviewer);
  if (searchParams.status && searchParams.status !== "all") filterQuery.set("status", searchParams.status);
  if (searchParams.q?.trim()) filterQuery.set("q", searchParams.q.trim());
  if (searchParams.sort && searchParams.sort !== "priority") filterQuery.set("sort", searchParams.sort);
  const filterQueryString = filterQuery.toString();
  const pageHref = (p: number) => {
    const qs = new URLSearchParams(filterQuery);
    qs.set("page", String(p));
    return `?${qs.toString()}`;
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-blue-600">
            <Link href={`/projects/${wave.projectId}`}>← {wave.project.name}</Link>
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Kontroly</p>
          <h1 className="text-2xl font-semibold text-slate-900">{wave.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral">{totalVisitCount} návštěv</Badge>
            <Badge tone="red">{totalOpenFindingsCount} otevřených nálezů</Badge>
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
          <Card className="border-l-4 border-l-brand-blue-400">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
                  <Upload className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">Import dat</h2>
              </div>
              <form action={rerunWave.bind(null, wave.projectId, wave.id)}>
                <LoadingSubmitButton variant="secondary" size="sm" pendingText="Kontroluji…">
                  <RefreshCw className="h-4 w-4" />
                  Spustit kontrolu znovu (celá vlna)
                </LoadingSubmitButton>
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
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                >
                  <option value="" disabled>
                    -- Vyberte scénář --
                  </option>
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
              <LoadingSubmitButton pendingText="Chvilku strpění…">Nahrát a zkontrolovat</LoadingSubmitButton>
            </form>

            {wave.importBatches.length > 0 && (
              <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
                {wave.importBatches.map((batch) => {
                  // stare zaznamy mohly mit jmeno souboru ulozene rozsypane (spatne dekodovane
                  // diakritiky) - oprava je bezpecne idempotentni, takze uz spravna jmena nechá být
                  const fileName = fixMojibakeFileName(batch.fileName);
                  return (
                  <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">{fileName}</span>
                      <Badge tone="blue">{batch.scenario.scenarioTemplate.name}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">
                        {new Date(batch.createdAt).toLocaleString("cs-CZ")} · +{batch.rowsNew} nových ·{" "}
                        {batch.rowsSkipped} přeskočeno · {batch.rowsRechecked} překontrolováno
                      </span>
                      <form action={deleteImportBatch.bind(null, wave.projectId, wave.id, batch.id)}>
                        <ConfirmSubmitButton
                          type="submit"
                          confirmMessage={`Opravdu smazat import "${fileName}"? Smažou se i všechny návštěvy, které naposledy přinesl.`}
                          title="Smazat tenhle import (a návštěvy, které naposledy přinesl)"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Nálezy — po návštěvách, chybové nahoře, bez odpovědí šedě dole */}
          <Card className="border-l-4 border-l-brand-green-400 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">Nálezy</h2>
              </div>
              {filteredVisits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Badge tone="neutral">{filteredVisits.length} MS celkem</Badge>
                  <Badge tone="red">{errorVisits.length} MS s chybou</Badge>
                  <Badge tone="green">{cleanVisits.length} MS bez chyby</Badge>
                  {emptyVisits.length > 0 && (
                    <Badge tone="neutral">{emptyVisits.length} MS bez odpovědí</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Filtrování + export */}
            <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <form className="flex flex-wrap items-end gap-3" method="GET">
                <div className="w-40">
                  <Label htmlFor="scenario">Scénář</Label>
                  <select
                    id="scenario"
                    name="scenario"
                    defaultValue={searchParams.scenario ?? "all"}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                  >
                    <option value="all">Všechny</option>
                    {wave.scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.scenarioTemplate.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-36">
                  <Label htmlFor="status">Stav</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={statusFilter}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-44">
                  <Label htmlFor="reviewer">Kontrolor</Label>
                  <select
                    id="reviewer"
                    name="reviewer"
                    defaultValue={searchParams.reviewer ?? "all"}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                  >
                    <option value="all">Všichni</option>
                    {reviewerOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.firstName} {r.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-48">
                  <Label htmlFor="sort">Řadit</Label>
                  <select
                    id="sort"
                    name="sort"
                    defaultValue={sortMode}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[160px] flex-1">
                  <Label htmlFor="q">Hledat ID kontroly</Label>
                  <input
                    id="q"
                    name="q"
                    type="text"
                    defaultValue={searchParams.q ?? ""}
                    placeholder="např. 339285"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-brand-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-blue-700"
                >
                  <Filter className="h-4 w-4" />
                  Filtrovat
                </button>
                {hasActiveFilters && (
                  <Link
                    href={`/projects/${wave.projectId}/waves/${wave.id}`}
                    className="text-sm font-medium text-slate-500 hover:underline"
                  >
                    Zrušit filtry
                  </Link>
                )}
                <a
                  href={`/projects/${wave.projectId}/waves/${wave.id}/export${
                    filterQueryString ? `?${filterQueryString}` : ""
                  }`}
                  className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Exportovat do Excelu
                </a>
              </form>
            </div>

            {orderedVisits.length === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-500">Zatím žádné návštěvy.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {orderedVisits.map((visit) => {
                  const isEmpty = isVisitDataEmpty(visit.data as Record<string, unknown>);

                  if (isEmpty) {
                    return (
                      <div
                        key={visit.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-slate-400"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{visit.inspectionId}</span>
                          <span className="text-xs">
                            · {visit.scenario.scenarioTemplate.name} · zatím bez odpovědí
                            {visit.reviewer && (
                              <> · Kontrolor: {visit.reviewer.firstName} {visit.reviewer.lastName}</>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const openFindings = visit.findings.filter((f) => f.status === FindingStatus.OPEN);

                  return (
                    <div key={visit.id} className="px-6 py-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{visit.inspectionId}</span>
                          <span className="text-xs text-slate-400">· {visit.scenario.scenarioTemplate.name}</span>
                          {visit.reviewer && (
                            <span className="text-xs text-slate-400">
                              · Kontrolor: {visit.reviewer.firstName} {visit.reviewer.lastName}
                            </span>
                          )}
                          {openFindings.length > 0 && (
                            <Badge tone="red">
                              {openFindings.length} {openFindings.length === 1 ? "nález" : "nálezy"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {visit.findings.length === 0 ? (
                        <div className="flex items-center gap-1.5 rounded-xl bg-brand-green-50 px-3 py-2 text-sm font-medium text-brand-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Bez nálezů
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {visit.findings.map((finding) => {
                            const grammarDetails =
                              finding.systemCheck === SystemCheckType.GRAMMAR
                                ? (finding.details as GrammarDetails | null)
                                : null;
                            const isOpen = finding.status === FindingStatus.OPEN;
                            const navigatorHref = wave.project.navigatorCode
                              ? buildNavigatorUrl(
                                  visit.inspectionId,
                                  wave.project.navigatorCode,
                                  findingQuestionCode(finding)
                                )
                              : null;

                            return (
                              <div
                                key={finding.id}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-xl px-3 py-2",
                                  isOpen ? "bg-red-50" : "bg-brand-green-50"
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  {grammarDetails?.context ? (
                                    <p className="text-sm text-slate-700">
                                      {grammarDetails.field && (
                                        <span className="font-medium">{grammarDetails.field}: </span>
                                      )}
                                      <GrammarContext
                                        context={grammarDetails.context}
                                        errorWord={grammarDetails.errorWord ?? ""}
                                      />
                                      {grammarDetails.reason && (
                                        <span className="ml-1 text-xs text-slate-400">
                                          ({grammarDetails.reason})
                                        </span>
                                      )}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-slate-700">{finding.message}</p>
                                  )}
                                  <div className="mt-1.5">
                                    <Badge tone={findingTypeTone(finding)} className="font-semibold">
                                      {findingTypeLabel(finding)}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <NavigatorLink
                                    href={navigatorHref}
                                    storageKey={`navigator-visited:${finding.id}`}
                                  />
                                  <form
                                    action={updateFindingStatus.bind(
                                      null,
                                      wave.projectId,
                                      wave.id,
                                      finding.id,
                                      FindingStatus.OPEN
                                    )}
                                  >
                                    <button
                                      type="submit"
                                      disabled={isOpen}
                                      title="Chyba (neopraveno)"
                                      className="rounded-full p-1 disabled:cursor-default"
                                    >
                                      <XCircle className={cn("h-5 w-5", isOpen ? "text-red-500" : "text-slate-300")} />
                                    </button>
                                  </form>
                                  <form
                                    action={updateFindingStatus.bind(
                                      null,
                                      wave.projectId,
                                      wave.id,
                                      finding.id,
                                      FindingStatus.RESOLVED
                                    )}
                                  >
                                    <button
                                      type="submit"
                                      disabled={!isOpen}
                                      title="Opraveno"
                                      className="rounded-full p-1 disabled:cursor-default"
                                    >
                                      <CheckCircle2
                                        className={cn("h-5 w-5", !isOpen ? "text-brand-green-600" : "text-slate-300")}
                                      />
                                    </button>
                                  </form>
                                  {reviewerInitials(finding.reviewedBy) && (
                                    <div
                                      title={`Naposledy vyhodnotil: ${
                                        finding.reviewedBy?.name ?? finding.reviewedBy?.email ?? ""
                                      }`}
                                      className="ml-0.5 flex flex-col items-center justify-center gap-px leading-none text-[9px] font-semibold uppercase text-slate-400"
                                    >
                                      {reviewerInitials(finding.reviewedBy)!.map((letter, i) => (
                                        <span key={i}>{letter}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm">
                <span className="text-slate-500">
                  Stránka {safePage} z {totalPages} ({bucketed.length} MS)
                </span>
                <div className="flex gap-2">
                  {safePage > 1 && (
                    <Link
                      href={pageHref(safePage - 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                    >
                      ← Předchozí
                    </Link>
                  )}
                  {safePage < totalPages && (
                    <Link
                      href={pageHref(safePage + 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Další →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
