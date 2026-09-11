"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Submit tlačítko uvnitř <form action={serverAction}>, co při odesílání
 * (dokud server nedokončí akci a nepřesměruje) ukáže zřetelný "pracuji"
 * stav — text se přepne na pendingText a přes tlačítko běží zleva doprava
 * světelný pruh. Import/kontrola můžou trvat déle, ať je jasné, že appka
 * nezamrzla. Musí být potomek <form>, ne přímo formulář sám (useFormStatus).
 */
export function LoadingSubmitButton({
  pendingText = "Chvilku strpění…",
  children,
  className,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={cn("relative overflow-hidden", className)} {...props}>
      {pending && (
        <span className="absolute inset-0 animate-[loading-sweep_1.1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      )}
      <span className="relative flex items-center gap-2">{pending ? pendingText : children}</span>
    </Button>
  );
}
