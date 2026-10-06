"use client";

/**
 * Rozbalovací pole filtru, které po změně hodnoty samo odešle formulář
 * (nemusí se pak klikat na "Filtrovat"). Odeslání jde přes
 * requestSubmit() nejbližšího <form> — formulář filtrů je obyčejný GET,
 * takže se jen načte stránka s novými parametry v adrese.
 */
export function AutoSubmitSelect({
  id,
  name,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
