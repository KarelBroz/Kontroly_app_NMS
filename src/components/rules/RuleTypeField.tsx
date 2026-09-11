"use client";

import { useState } from "react";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";

// Vlastní kopie popisků (ne z src/lib/rules/labels.ts) — ten soubor importuje
// RuleType z @prisma/client, což se nesmí dostat do klientského bundlu.
const TYPE_OPTIONS: Array<{ value: string; label: string; placeholder: string; helper: string }> = [
  {
    value: "REQUIRED",
    label: "Povinné pole",
    placeholder: "",
    helper: "Odpověď může být libovolná — jen nesmí být prázdná.",
  },
  {
    value: "ALLOWED_VALUES",
    label: "Povolené hodnoty",
    placeholder: "např. Ano, Spíše ano",
    helper: "Vyjmenuj povolené hodnoty oddělené čárkou.",
  },
  {
    value: "NUMERIC_RANGE",
    label: "Číselný rozsah",
    placeholder: "např. 0-180",
    helper: "Zadej rozsah ve formátu min-max.",
  },
  {
    value: "CONDITIONAL_REQUIRED",
    label: "Podmíněně povinné",
    placeholder: "např. Ano -> SCO1t",
    helper:
      'Formát "hodnota -> KÓD" — doplňující otázka je povinná, když se odpověď NEROVNÁ zadané hodnotě. "=hodnota -> KÓD" — povinná, když se odpověď PŘESNĚ ROVNÁ (např. "=Jiné_ -> SCO1j"). "~hodnota -> KÓD" — povinná, když odpověď hodnotu OBSAHUJE (pro vícevýběrové otázky).',
  },
  {
    value: "PRODUCT_ALLOWLIST",
    label: "Povolený seznam artiklů",
    placeholder: "např. Donut s náplní, Croissant máslový",
    helper: "Vyjmenuj povolené artikly oddělené čárkou — kontrola je tolerantní na velikost písmen, slovosled i drobný překlep.",
  },
  {
    value: "NUMERIC_THRESHOLD_CONSISTENCY",
    label: "Prahová shoda čísla a odpovědi",
    placeholder: "např. 3 -> I07: Ano / Ne",
    helper:
      'Číslo z "Kódu otázky" porovnané s prahem musí odpovídat navazující otázce. Formát "práh -> KÓD_OTÁZKY: hodnota_do_prahu / hodnota_nad_prahem".',
  },
];

/** Kód otázky + Typ + Povolená hodnota pro založení pravidla — nápověda a placeholder se mění podle vybraného typu. */
export function RuleTypeField({ idPrefix }: { idPrefix: string }) {
  const [type, setType] = useState(TYPE_OPTIONS[0].value);
  const current = TYPE_OPTIONS.find((option) => option.value === type) ?? TYPE_OPTIONS[0];

  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-questionCode`}>Kód otázky</Label>
        <Input id={`${idPrefix}-questionCode`} name="questionCode" placeholder="X20" required />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Typ</Label>
        <select
          id={`${idPrefix}-type`}
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <Label htmlFor={`${idPrefix}-allowedValue`}>Povolená hodnota</Label>
        {current.value === "REQUIRED" ? (
          <div className="flex w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400">
            Cokoliv — stačí, že pole není prázdné
          </div>
        ) : (
          <Input id={`${idPrefix}-allowedValue`} name="allowedValue" placeholder={current.placeholder} />
        )}
        <p className="mt-1 text-xs text-slate-400">{current.helper}</p>
      </div>
    </>
  );
}
