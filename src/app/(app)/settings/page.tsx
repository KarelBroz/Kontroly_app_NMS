import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { LoadingSubmitButton } from "@/components/ui/LoadingSubmitButton";
import { isAnonymizationEnabled, ANONYMIZED_EMAIL_DOMAIN } from "@/lib/anonymize/anonymize";
import { anonymizeExistingData } from "./actions";

// převod starých dat (anonymizeExistingData) běží déle než výchozí limit
export const maxDuration = 60;

export default async function SettingsPage({ searchParams }: { searchParams: { anonymized?: string } }) {
  const user = await requireUser();

  const [rawVisits, rawReviewers] = user.isAdmin
    ? await Promise.all([
        prisma.visit.count({ where: { anonymizedAt: null } }),
        prisma.reviewer.count({ where: { NOT: { email: { endsWith: `@${ANONYMIZED_EMAIL_DOMAIN}` } } } }),
      ])
    : [0, 0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nastavení</h1>
        <p className="mt-1 text-sm text-slate-500">Účet a obecné volby.</p>
      </div>
      <Card className="max-w-lg">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Můj účet</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Jméno</dt>
            <dd className="font-medium text-slate-900">{user.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">E-mail</dt>
            <dd className="font-medium text-slate-900">{user.email}</dd>
          </div>
        </dl>
      </Card>

      {user.isAdmin && (
        <Card className="max-w-lg">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Anonymizace osobních údajů</h2>
          <p className="mb-4 text-sm text-slate-500">
            Nové importy {isAnonymizationEnabled() ? "se anonymizují automaticky" : "se teď NEanonymizují (ANONYMIZE_IMPORTS=off)"}:
            shopper a kontrolor dostanou pseudonym, jména v odpovědích se nahradí smyšlenými (se stejnou formou kvůli
            kontrole formátu) a e-maily a telefony v textech se zamaskují.
          </p>
          {searchParams.anonymized && (
            <p className="mb-4 rounded-lg bg-brand-green-50 px-3 py-2 text-sm text-brand-green-700">
              {searchParams.anonymized}
            </p>
          )}
          {rawVisits > 0 || rawReviewers > 0 ? (
            <form action={anonymizeExistingData}>
              <p className="mb-3 text-sm text-slate-700">
                V původní podobě zbývá {rawVisits} návštěv a {rawReviewers} kontrolorů. Převod je nevratný.
              </p>
              <LoadingSubmitButton pendingText="Anonymizuji…">Anonymizovat nahraná data</LoadingSubmitButton>
            </form>
          ) : (
            <p className="text-sm text-slate-700">Všechna nahraná data jsou anonymní.</p>
          )}
        </Card>
      )}
    </div>
  );
}
