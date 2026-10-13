import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { addAllowedEmail, removeAllowedEmail, setUserRole, deleteUser } from "./actions";
import { requireAdmin } from "@/lib/auth/session";

export default async function UsersPage({ searchParams }: { searchParams: { error?: string } }) {
  const admin = await requireAdmin();

  const [users, allowedEmails] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.allowedRegistrationEmail.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Správa uživatelů</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kolegové s přístupem do appky. Admin navíc spravuje uživatele a sběr chyb; ostatní práce (projekty, vlny,
          importy, pravidla, nálezy) je pro všechny přihlášené stejná.
        </p>
      </div>

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Povolené e-maily pro registraci</h2>
        <p className="mb-4 text-sm text-slate-500">
          Sem přidej adresu kolegy, u kterého identitu znáš — založí si pak na{" "}
          <span className="font-medium">/register</span> účet rovnou, bez ověřovacího kódu. Povolení je jednorázové:
          po založení účtu ze seznamu zmizí. Přidávej adresu až ve chvíli, kdy se kolega chystá registrovat — kdo ji zná,
          může si do té doby účet založit místo něj.
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
          {users.map((user) => {
            const isSelf = user.id === admin.id;
            const isAdmin = user.role === UserRole.ADMIN;
            const label = user.name ?? user.email;
            return (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {label}
                    {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(ty)</span>}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={isAdmin ? "purple" : "green"}>{isAdmin ? "Admin" : "Uživatel"}</Badge>
                  {!isSelf && (
                    <>
                      <form action={setUserRole.bind(null, user.id, isAdmin ? UserRole.USER : UserRole.ADMIN)}>
                        <ConfirmSubmitButton
                          type="submit"
                          confirmMessage={
                            isAdmin
                              ? `Odebrat uživateli ${label} roli admina?`
                              : `Udělat z uživatele ${label} admina? Bude moct spravovat uživatele včetně tebe.`
                          }
                          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                        >
                          {isAdmin ? "Odebrat admina" : "Udělat adminem"}
                        </ConfirmSubmitButton>
                      </form>
                      <form action={deleteUser.bind(null, user.id)}>
                        <ConfirmSubmitButton
                          type="submit"
                          confirmMessage={`Opravdu odebrat přístup uživateli ${label}? Účet se smaže a okamžitě se odhlásí.`}
                          className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          Odebrat přístup
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
