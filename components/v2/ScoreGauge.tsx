// Semi-circle "speedometer" gauge for the Core FX Score's real -100..+100
// value -- same hand-rolled-SVG, no-library convention as DonutGauge,
// just adapted to a bipolar scale (a flat 0-100 donut doesn't represent
// a signed value honestly). Dash-offset reveal trick (see DonutGauge)
// applied to an arc path instead of a full circle; a needle points at
// the real value along the same arc.
export default function ScoreGauge({ value, size = 220 }: { value: number | null; size?: number }) {
  const width = size;
  const height = size * 0.6;
  const strokeWidth = size * 0.055;
  const cx = width / 2;
  const cy = height - strokeWidth / 2 - 2;
  const r = width / 2 - strokeWidth / 2 - 2;

  const f = value === null ? 0.5 : Math.max(0, Math.min(1, (value + 100) / 200));
  const circumference = Math.PI * r;
  const angleRad = ((180 - f * 180) * Math.PI) / 180;
  const needleLen = r - strokeWidth * 0.9;
  const nx = cx + needleLen * Math.cos(angleRad);
  const ny = cy - needleLen * Math.sin(angleRad);

  const arcPath = `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`;
  const gradId = "score-gauge-gradient";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="48%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      <path d={arcPath} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" className="stroke-slate-100 dark:stroke-slate-800" />
      <path
        d={arcPath}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={`url(#${gradId})`}
        strokeDasharray={circumference}
        strokeDashoffset={0}
        opacity={0.35}
      />
      <path
        d={arcPath}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={`url(#${gradId})`}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - f)}
        className="transition-[stroke-dashoffset] duration-500"
      />

      {value !== null && (
        <g className="text-v2-foreground">
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth={strokeWidth * 0.28} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={strokeWidth * 0.45} fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
