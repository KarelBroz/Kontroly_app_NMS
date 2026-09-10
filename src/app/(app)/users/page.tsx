import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { addAllowedEmail, removeAllowedEmail } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: { error?: string } }) {
  const [users, allowedEmails] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.allowedRegistrationEmail.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Správa uživatelů</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kolegové s přístupem do appky. Všichni přihlášení uživatelé mají zatím stejná oprávnění.
        </p>
      </div>

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Povolené e-maily pro registraci</h2>
        <p className="mb-4 text-sm text-slate-500">
          Dokud e-mailové ověření kódem nejede naplno, sem přidej adresy kolegů, u kterých identitu znáš — ti si
          pak na <span className="font-medium">/register</span> založí účet rovnou, bez ověřovacího kódu. Funguje
          i natrvalo jako rychlejší cesta pro důvěryhodné lidi.
        </p>

        <form action={addAllowedEmail} className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="email">NMS e-mail</Label>
            <Input id="email" name="email" type="email" placeholder="jmeno.prijmeni@nms.eu" required />
          </div>
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="note">Poznámka (nepovinné)</Label>
            <Input id="note" name="note" placeholder="např. jméno kolegy" />
          </div>
          <Button type="submit">Povolit</Button>
        </form>

        {allowedEmails.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím žádné povolené adresy.</p>
        ) : (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {allowedEmails.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{item.email}</span>
                  {item.note && <span className="ml-2 text-slate-500">— {item.note}</span>}
                </div>
                <form action={removeAllowedEmail.bind(null, item.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Odebrat
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{user.name ?? user.email}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <Badge tone="green">Aktivní</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
