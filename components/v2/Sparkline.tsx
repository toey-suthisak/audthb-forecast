// Tiny inline SVG line -- same hand-rolled convention as the rest of
// this app's charts (see TrendChart.tsx). Used in watchlist rows; a
// series with fewer than 2 real points renders nothing rather than a
// flat fake line.
export default function Sparkline({
  points,
  width = 64,
  height = 24,
  positive,
}: {
  points: number[];
  width?: number;
  height?: number;
  positive: boolean | null;
}) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const path = points
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive === null ? "text-slate-400" : positive ? "text-emerald-500" : "text-red-500";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={color}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
