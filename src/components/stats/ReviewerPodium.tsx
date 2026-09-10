import type { ReviewerCount } from "@/lib/stats/getStats";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "?";
}

function errorsWord(count: number): string {
  if (count === 1) return "chyba";
  if (count >= 2 && count <= 4) return "chyby";
  return "chyb";
}

const SLOTS = [
  { rank: 2, medal: "🥈", height: "h-20", ring: "ring-slate-300", avatar: "bg-slate-100 text-slate-600" },
  { rank: 1, medal: "🥇", height: "h-28", ring: "ring-amber-400", avatar: "bg-amber-100 text-amber-700" },
  { rank: 3, medal: "🥉", height: "h-14", ring: "ring-amber-700", avatar: "bg-amber-50 text-amber-800" },
] as const;

/** Pódium 2.-1.-3. místa pro nejpilnější kontrolory — "zábavná" část /statistics. */
export function ReviewerPodium({ top3 }: { top3: ReviewerCount[] }) {
  if (top3.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Zatím žádná vyřešená chyba v tomhle období — pódium čeká na první medaili 🏅
      </p>
    );
  }

  return (
    <div className="flex items-end justify-center gap-4 pt-6 sm:gap-8">
      {SLOTS.map((slot) => {
        const data = top3[slot.rank - 1];
        return (
          <div key={slot.rank} className="flex w-20 flex-col items-center gap-2 sm:w-28">
            {data ? (
              <>
                <div className="text-2xl">{slot.medal}</div>
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ring-4 ${slot.avatar} ${slot.ring}`}
                >
                  {initialsOf(data.name)}
                </div>
                <p className="max-w-full truncate text-sm font-semibold text-slate-900">{data.name}</p>
                <p className="text-xs text-slate-500">
                  {data.count} {errorsWord(data.count)}
                </p>
              </>
            ) : (
              <div className="h-[86px]" />
            )}
            <div
              className={`flex w-full items-start justify-center rounded-t-xl bg-gradient-to-t from-brand-blue-100 to-brand-blue-50 pt-2 text-lg font-bold text-brand-blue-600 ${slot.height}`}
            >
              #{slot.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}
