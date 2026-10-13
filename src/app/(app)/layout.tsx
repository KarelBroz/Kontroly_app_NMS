import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/nav/Sidebar";
import { Toast } from "@/components/ui/Toast";
import { BugReportButton } from "@/components/bugreport/BugReportButton";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Jen pro data do menu — samotnou ochranu dělá middleware a requireUser
  // v každé stránce (layout se při navigaci nevykresluje znovu).
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar userName={user.name ?? user.email} isAdmin={user.isAdmin} />
      <main className="flex-1 md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
      <Toast />
      <BugReportButton />
    </div>
  );
}
