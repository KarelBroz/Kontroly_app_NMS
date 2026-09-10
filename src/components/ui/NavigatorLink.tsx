"use client";

import { useEffect, useState } from "react";
import { Lighthouse } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Proklik do Navigátoru na konkrétní nález (návštěva + otázka). Po kliknutí
 * majáček krátce "zabliká" žlutě, a natrvalo (v tomhle prohlížeči, přes
 * localStorage) zůstane vybarvený — jen vizuální pomůcka, ať je vidět, které
 * nálezy už byly v Navigátoru otevřené. Samotné potvrzení opravy
 * (zelené/červené) dělá kontrolor ručně přes tlačítka vedle.
 */
export function NavigatorLink({ href, storageKey }: { href: string | null; storageKey: string }) {
  const [visited, setVisited] = useState(false);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) setVisited(true);
    } catch {
      // localStorage nedostupné (privátní okno apod.) — bez trvalého stavu, nevadí
    }
  }, [storageKey]);

  if (!href) {
    return (
      <span
        title="Nastavte Kód projektu Navigátor v nastavení projektu, ať jde odkaz sestavit."
        className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-300"
      >
        <Lighthouse className="h-4 w-4" />
      </span>
    );
  }

  function handleClick() {
    setVisited(true);
    setFlashing(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    window.setTimeout(() => setFlashing(false), 900);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title="Otevřít v Navigátoru"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-lg border p-1.5 transition-colors",
        visited
          ? "border-amber-200 bg-amber-50 text-amber-600"
          : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      )}
    >
      {flashing && (
        <>
          <span className="pointer-events-none absolute -top-1 left-0 h-1.5 w-1.5 rounded-full bg-amber-400 [animation:lighthouse-flash_0.9s_ease-out]" />
          <span className="pointer-events-none absolute -top-1 right-0 h-1.5 w-1.5 rounded-full bg-amber-400 [animation:lighthouse-flash_0.9s_ease-out_0.15s]" />
        </>
      )}
      <Lighthouse className="h-4 w-4" />
    </a>
  );
}
