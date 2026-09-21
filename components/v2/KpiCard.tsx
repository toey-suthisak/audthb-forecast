import type { ReactNode } from "react";

// A single labeled figure with an optional change/sub-line -- the v2
// dashboard's repeated building block (rate, score, action bias,
// forecast horizons all use this shape in the mockup).
export default function KpiCard({
  label,
  value,
  valueClassName = "",
  sub,
  badge,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  sub?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{label}</p>
        {badge}
      </div>
      <p className={`font-mono mt-1 text-2xl font-semibold text-v2-foreground ${valueClassName}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-v2-muted">{sub}</div>}
    </div>
  );
}
