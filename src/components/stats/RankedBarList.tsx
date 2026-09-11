import Link from "next/link";

/** Plný žebříček (projekty i kontroloři) s vodorovnými pruhy podle relativní velikosti. */
export function RankedBarList({
  items,
  barColor = "bg-brand-blue-400",
  emptyText = "Zatím nic k zobrazení.",
}: {
  items: { key: string; label: string; count: number; href?: string }[];
  barColor?: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyText}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const label = (
          <span
            className={`w-32 shrink-0 truncate font-medium text-slate-700 sm:w-44 ${item.href ? "hover:underline" : ""}`}
          >
            {item.label}
          </span>
        );
        return (
          <div key={item.key} className="flex items-center gap-3 text-sm">
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-400">{i + 1}.</span>
            {item.href ? (
              <Link href={item.href} className="flex shrink-0 items-center rounded-lg hover:bg-slate-50">
                {label}
              </Link>
            ) : (
              label
            )}
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-semibold text-slate-900">{item.count}</span>
          </div>
        );
      })}
    </div>
  );
}
