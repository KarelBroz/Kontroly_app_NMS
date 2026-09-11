"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderKanban,
  Settings,
  Users,
  LogOut,
  ClipboardCheck,
  Flag,
  BarChart3,
  UserCheck,
  Archive,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Homepage", icon: Home },
  { href: "/projects", label: "Projekty", icon: FolderKanban },
  { href: "/statistics", label: "Statistiky", icon: BarChart3 },
  { href: "/reviewers", label: "Databáze kontrolorů", icon: UserCheck },
  { href: "/archiv", label: "Archiv šablon", icon: Archive },
  { href: "/settings", label: "Nastavení", icon: Settings },
  { href: "/users", label: "Správa uživatelů", icon: Users },
  { href: "/bug-reports", label: "Sběr chyb", icon: Flag },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
      <Link href="/" className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue-500 text-white">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold text-slate-900">Kontroly MS</span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-blue-50 text-brand-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <div className="mb-2 truncate px-3 text-xs text-slate-500">{userName}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
