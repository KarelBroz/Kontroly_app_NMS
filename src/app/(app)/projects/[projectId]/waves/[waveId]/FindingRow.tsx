"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { FindingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { NavigatorLink } from "@/components/ui/NavigatorLink";
import { updateFindingStatus } from "./actions";

/**
 * Jeden řádek nálezu — barva pozadí a stav tlačítek se mění OKAMŽITĚ po
 * kliknutí (optimistické UI), bez načtení celé stránky. Díky tomu se
 * seznam nálezů nepřeskládá (chybové/čisté/prázdné) hned po kliknutí —
 * k přeskládání dojde až při dalším skutečném načtení stránky (F5, návrat
 * na stránku), což je při postupném procházení dlouhého seznamu plynulejší.
 */
export function FindingRow({
  findingId,
  projectId,
  waveId,
  initialIsOpen,
  navigatorHref,
  reviewerInitials,
  reviewedByLabel,
  children,
}: {
  findingId: string;
  projectId: string;
  waveId: string;
  initialIsOpen: boolean;
  navigatorHref: string | null;
  reviewerInitials: string[] | null;
  reviewedByLabel: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [pending, setPending] = useState(false);

  async function setStatus(open: boolean) {
    if (pending) return; // dokud běží předchozí požadavek, druhý klik ignoruj
    const previous = isOpen;
    setIsOpen(open);
    setPending(true);
    try {
      await updateFindingStatus(projectId, waveId, findingId, (open ? "OPEN" : "RESOLVED") as FindingStatus);
    } catch (err) {
      setIsOpen(previous); // uložení selhalo (např. výpadek sítě) — vrátit vizuální stav zpět
      // eslint-disable-next-line no-console
      console.error("Uložení stavu nálezu selhalo:", err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3 py-2",
        isOpen ? "bg-red-50" : "bg-brand-green-50"
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center gap-1.5">
        <NavigatorLink href={navigatorHref} storageKey={`navigator-visited:${findingId}`} />
        <button
          type="button"
          disabled={isOpen || pending}
          title="Chyba (neopraveno)"
          className="rounded-full p-1 disabled:cursor-default"
          onClick={() => setStatus(true)}
        >
          <XCircle className={cn("h-5 w-5", isOpen ? "text-red-500" : "text-slate-300")} />
        </button>
        <button
          type="button"
          disabled={!isOpen || pending}
          title="Opraveno"
          className="rounded-full p-1 disabled:cursor-default"
          onClick={() => setStatus(false)}
        >
          <CheckCircle2 className={cn("h-5 w-5", !isOpen ? "text-brand-green-600" : "text-slate-300")} />
        </button>
        {reviewerInitials && (
          <div
            title={`Naposledy vyhodnotil: ${reviewedByLabel}`}
            className="ml-0.5 flex flex-col items-center justify-center gap-px leading-none text-[9px] font-semibold uppercase text-slate-400"
          >
            {reviewerInitials.map((letter, i) => (
              <span key={i}>{letter}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
