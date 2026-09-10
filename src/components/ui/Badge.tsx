import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "green" | "red" | "amber" | "blue" | "purple" | "cyan" | "indigo";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  green: "bg-brand-green-50 text-brand-green-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-brand-blue-50 text-brand-blue-700",
  purple: "bg-purple-50 text-purple-700",
  cyan: "bg-cyan-50 text-cyan-700",
  indigo: "bg-indigo-50 text-indigo-700",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
