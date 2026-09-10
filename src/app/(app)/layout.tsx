import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/nav/Sidebar";
import { Toast } from "@/components/ui/Toast";
import { BugReportButton } from "@/components/bugreport/BugReportButton";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar userName={session.user?.name ?? session.user?.email ?? ""} />
      <main className="flex-1 md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
      <Toast />
      <BugReportButton />
    </div>
  );
}
