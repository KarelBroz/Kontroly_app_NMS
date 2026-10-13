import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";

export default async function SettingsPage() {
  const user = await requireUser();

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
    </div>
  );
}
