"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Poslouchá "?saved=" v URL (nastavuje ho server action redirectem po
 * úspěšném uložení, viz src/app/(app)/.../actions.ts) a na pár vteřin
 * ukáže zelený banner vpravo dole. Hodnota "1" = výchozí text "Uloženo",
 * jinak se použije text z parametru (např. "Smazáno", "Zkontrolováno").
 * Parametr se hned po zobrazení z URL odstraní, ať se banner neukáže
 * znovu při refreshi nebo tlačítku zpět.
 */
function ToastWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = searchParams.get("saved");
    if (!saved) return;

    setMessage(saved === "1" ? "Uloženo" : saved);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!message) return;
    setVisible(false);
    const showTimeout = setTimeout(() => setVisible(true), 10);
    const hideTimeout = setTimeout(() => setVisible(false), 2600);
    const clearMessageTimeout = setTimeout(() => setMessage(null), 3000);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
      clearTimeout(clearMessageTimeout);
    };
  }, [message]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-50">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-xl bg-brand-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300",
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        {message}
      </div>
    </div>
  );
}

export function Toast() {
  return (
    <Suspense fallback={null}>
      <ToastWatcher />
    </Suspense>
  );
}
