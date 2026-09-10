"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Flag, X } from "lucide-react";
import { createBugReport } from "@/app/(app)/bug-reports/actions";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Kulatá červená vlaječka vpravo dole, vidět na každé stránce appky —
 * kliknutím uživatel nahlásí chybu/problém přímo z místa, kde na něj
 * narazil (aktuální cesta se pošle spolu s hlášením, vidět v menu "Sběr
 * chyb", odkud se na tuhle stránku dá proklikem vrátit).
 */
export function BugReportButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="absolute bottom-16 right-0 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Nahlásit chybu</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Popiš, v čem na téhle stránce vidíš problém — pošle se s tím i odkaz na ni.
          </p>
          <form action={createBugReport} className="space-y-3">
            <input type="hidden" name="pageUrl" value={pathname} />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <Textarea name="message" required rows={4} autoFocus placeholder="Co je špatně?" />
            <Button type="submit" variant="danger" className="w-full">
              Odeslat hlášení
            </Button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Nahlásit chybu na téhle stránce"
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors",
          open ? "bg-slate-700 text-white" : "bg-red-600 text-white hover:bg-red-700"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
      </button>
    </div>
  );
}
