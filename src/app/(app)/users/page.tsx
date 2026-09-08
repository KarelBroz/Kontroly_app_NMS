import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Správa uživatelů</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kolegové s přístupem do appky. Všichni přihlášení uživatelé mají zatím stejná oprávnění.
        </p>
      </div>
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
