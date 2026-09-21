// Hand-rolled SVG donut, same no-charting-library convention as
// TrendChart.tsx / TechnicalOutlook.tsx's PriceChart -- a ring showing
// `value`/`max` as a percentage, colored by how close it is to full.
export default function DonutGauge({
  value,
  max = 100,
  size = 96,
  strokeWidth = 10,
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const dashOffset = circumference * (1 - pct);

  const color = pct >= 0.85 ? "text-emerald-500" : pct >= 0.6 ? "text-blue-500" : pct >= 0.35 ? "text-amber-500" : "text-red-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`${color} transition-[stroke-dashoffset] duration-500`}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold text-v2-foreground leading-none">{label ?? value.toFixed(1)}</span>
        {sublabel && <span className="text-[10px] text-v2-muted mt-0.5">{sublabel}</span>}
      </div>
    </div>
  );
}
