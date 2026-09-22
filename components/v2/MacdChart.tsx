"use client";

import type { Locale } from "@/lib/i18n";
import type { MacdStudyPoint } from "@/lib/long-term-technicals-data";

const STR = {
  en: { macd: "MACD", signal: "Signal", histogram: "Histogram" },
  th: { macd: "MACD", signal: "Signal", histogram: "Histogram" },
} as const;

const WIDTH = 720;
const HEIGHT = 170;
const PAD_LEFT = 4;

export default function MacdChart({ points, locale }: { points: MacdStudyPoint[]; locale: Locale }) {
  const t = STR[locale];

  if (points.length < 2) return null;

  const stepX = (WIDTH - PAD_LEFT * 2) / (points.length - 1);

  const allValues = points.flatMap((p) => [p.macd, p.signal, p.histogram]).filter((v): v is number => v !== null);
  if (allValues.length === 0) return null;

  const rawMax = Math.max(...allValues.map((v) => Math.abs(v)));
  const span = rawMax * 1.15 || 0.01;
  const yFor = (v: number) => HEIGHT / 2 - (v / span) * (HEIGHT / 2);
  const zeroY = yFor(0);

  const barWidth = Math.max(1, stepX * 0.6);

  let macdPath = "";
  let started = false;
  points.forEach((p, i) => {
    if (p.macd === null) {
      started = false;
      return;
    }
    const x = PAD_LEFT + i * stepX;
    const y = yFor(p.macd);
    macdPath += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    started = true;
  });

  let signalPath = "";
  started = false;
  points.forEach((p, i) => {
    if (p.signal === null) {
      started = false;
      return;
    }
    const x = PAD_LEFT + i * stepX;
    const y = yFor(p.signal);
    signalPath += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    started = true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-2 text-[11px] text-v2-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-blue-600" /> {t.macd}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-amber-500" /> {t.signal}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/60" /> {t.histogram}
        </span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="w-full" style={{ height: HEIGHT }}>
        <line x1={0} x2={WIDTH} y1={zeroY} y2={zeroY} className="stroke-v2-border" strokeWidth={1} />

        {points.map((p, i) => {
          if (p.histogram === null) return null;
          const x = PAD_LEFT + i * stepX - barWidth / 2;
          const y = p.histogram >= 0 ? yFor(p.histogram) : zeroY;
          const h = Math.abs(yFor(p.histogram) - zeroY);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(0.5, h)}
              className={p.histogram >= 0 ? "fill-emerald-500/60" : "fill-red-500/60"}
            />
          );
        })}

        <path d={signalPath} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="text-amber-500" />
        <path d={macdPath} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400" />
      </svg>

      <div className="flex items-center justify-between text-[11px] text-v2-muted mt-1">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
