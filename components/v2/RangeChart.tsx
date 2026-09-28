"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { PivotLevels } from "@/lib/technical-outlook-data";

export type RangePoint = { date: string; close: number };

// Real multi-timeframe resolutions, not just different zoom windows into
// the same daily series -- 1H/4H come from real intraday OHLC bars
// (market_prices, aggregated server-side, see get_hourly_price_bars),
// DAILY from this app's own real daily bars (get_daily_price_bars),
// WEEKLY from the longer real RBA F11.1 series (backtest_daily_rates,
// 2023 onward -- the live feed alone only has ~2 real weeks, nowhere
// near enough for a meaningful weekly view). Each timeframe carries its
// own real pivot basis too (see lib/technical-outlook-data.ts), not the
// single daily pivot reused everywhere.
export type TimeframeKey = "1H" | "4H" | "DAILY" | "WEEKLY";
export const TIMEFRAME_KEYS: TimeframeKey[] = ["1H", "4H", "DAILY", "WEEKLY"];

const STR = {
  en: {
    label: { "1H": "1H", "4H": "4H", DAILY: "Daily", WEEKLY: "Weekly" } as Record<TimeframeKey, string>,
    unit: { "1H": "1H bar(s)", "4H": "4H bar(s)", DAILY: "real day(s)", WEEKLY: "real week(s)" } as Record<TimeframeKey, string>,
    showing: (n: number, unit: string, from: string, to: string) => `Showing ${n} ${unit}, ${from} to ${to}`,
    notEnough: "Not enough price history to chart at this resolution yet.",
    currentPrice: "Current price",
    change1H: "1H change",
    swingRange: (days: number) => `${days}-day range`,
    pivotBasis: (label: string) => `Pivot based on ${label}`,
  },
  th: {
    label: { "1H": "1 ชม.", "4H": "4 ชม.", DAILY: "รายวัน", WEEKLY: "รายสัปดาห์" } as Record<TimeframeKey, string>,
    unit: { "1H": "แท่ง 1 ชม.", "4H": "แท่ง 4 ชม.", DAILY: "วันจริง", WEEKLY: "สัปดาห์จริง" } as Record<TimeframeKey, string>,
    showing: (n: number, unit: string, from: string, to: string) => `แสดงข้อมูลจริง ${n} ${unit} จาก ${from} ถึง ${to}`,
    notEnough: "ข้อมูลราคายังไม่พอสำหรับตีกราฟที่ความละเอียดนี้",
    currentPrice: "ราคาปัจจุบัน",
    change1H: "เปลี่ยนแปลง 1H",
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    pivotBasis: (label: string) => `คำนวณ Pivot จาก ${label}`,
  },
} as const;

const CHART_WIDTH = 720;
const CHART_HEIGHT = 340;
const PAD_LEFT = 80;

// Simple quadratic-bezier-through-midpoints smoothing -- each raw point
// stays a control point, the curve passes through the midpoint between
// consecutive points, giving a smooth line without ever overshooting
// past the real data (unlike a cardinal/Catmull-Rom spline, which can).
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    d += ` Q${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` T${last.x.toFixed(1)},${last.y.toFixed(1)}`;
  return d;
}

// 1H/4H pivots are based on a bar identified by a full ISO timestamp
// (not a calendar date like DAILY/WEEKLY) -- render it as a real local
// date+time so the caption stays readable instead of dumping a raw ISO
// string.
function formatBasis(dateOrIso: string, timeframe: TimeframeKey): string {
  if (timeframe !== "1H" && timeframe !== "4H") return dateOrIso;
  const d = new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) return dateOrIso;
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function RangeChart({
  timeframes,
  locale,
  defaultTimeframe = "DAILY",
  currentRate = null,
  change1H = null,
  swingLow = null,
  swingHigh = null,
  swingDays = null,
}: {
  timeframes: Record<TimeframeKey, { series: RangePoint[]; pivots: PivotLevels | null }>;
  locale: Locale;
  defaultTimeframe?: TimeframeKey;
  currentRate?: number | null;
  change1H?: number | null;
  swingLow?: number | null;
  swingHigh?: number | null;
  swingDays?: number | null;
}) {
  const t = STR[locale];
  const [timeframe, setTimeframe] = useState<TimeframeKey>(defaultTimeframe);

  const active = timeframes[timeframe];
  const series = active.series;
  const pivots = active.pivots;

  const timeframeBar = (
    <div className="flex items-center gap-1.5">
      {TIMEFRAME_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setTimeframe(key)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            timeframe === key
              ? "bg-blue-600 text-white shadow-sm"
              : "text-v2-muted hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {t.label[key]}
        </button>
      ))}
    </div>
  );

  if (series.length < 2) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div />
          {timeframeBar}
        </div>
        <p className="text-sm text-v2-muted">{t.notEnough}</p>
      </div>
    );
  }

  const closes = series.map((p) => p.close);

  const pivotLevels = pivots ? [pivots.r3, pivots.r2, pivots.r1, pivots.pivot, pivots.s1, pivots.s2, pivots.s3] : [];
  const allValues = [...closes, ...pivotLevels, ...(currentRate !== null ? [currentRate] : [])];

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.1 || 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const plotWidth = CHART_WIDTH - PAD_LEFT;
  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;
  const yFor = (v: number) => CHART_HEIGHT - ((v - min) / span) * CHART_HEIGHT;

  const points = closes.map((v, i) => ({ x: PAD_LEFT + i * stepX, y: yFor(v) }));
  const path = smoothPath(points);

  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${CHART_HEIGHT} L${PAD_LEFT},${CHART_HEIGHT} Z`;

  const lastPoint = points[points.length - 1];

  const referenceLines: { value: number; label: string; emphasis?: boolean }[] = pivots
    ? [
        { value: pivots.r3, label: "R3" },
        { value: pivots.r2, label: "R2" },
        { value: pivots.r1, label: "R1" },
        { value: pivots.pivot, label: "P", emphasis: true },
        { value: pivots.s1, label: "S1" },
        { value: pivots.s2, label: "S2" },
        { value: pivots.s3, label: "S3" },
      ]
    : [];

  // Faint horizontal gridlines for scale reference, independent of the
  // pivot levels above -- purely visual, evenly spaced across the
  // plotted min/max.
  const gridlineCount = 4;
  const gridlines = Array.from({ length: gridlineCount + 1 }, (_, i) => CHART_HEIGHT * (i / gridlineCount));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex flex-wrap items-start gap-8">
          {currentRate !== null && (
            <div>
              <p className="text-xs text-v2-muted">{t.currentPrice}</p>
              <p className="font-mono text-3xl font-semibold text-v2-foreground">{currentRate.toFixed(4)}</p>
            </div>
          )}
          {change1H !== null && (
            <div>
              <p className="text-xs text-v2-muted">{t.change1H}</p>
              <p className={`font-mono text-lg font-semibold ${change1H >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {change1H >= 0 ? "+" : ""}
                {change1H.toFixed(2)}%
              </p>
            </div>
          )}
          {swingLow !== null && swingHigh !== null && swingDays !== null && (
            <div>
              <p className="text-xs text-v2-muted">{t.swingRange(swingDays)}</p>
              <p className="font-mono text-lg font-semibold text-v2-foreground">
                {swingLow.toFixed(4)} - {swingHigh.toFixed(4)}
              </p>
            </div>
          )}
        </div>

        {timeframeBar}
      </div>

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="w-full h-[340px]">
        <defs>
          <linearGradient id="v2-range-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" className="text-blue-500" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-blue-500" />
          </linearGradient>
        </defs>

        {gridlines.map((y) => (
          <line key={y} x1={PAD_LEFT} x2={CHART_WIDTH} y1={y} y2={y} strokeWidth={1} className="stroke-slate-100 dark:stroke-slate-800/60" />
        ))}

        {referenceLines.map((line) => {
          const y = yFor(line.value);
          return (
            <g key={line.label}>
              <line
                x1={PAD_LEFT}
                x2={CHART_WIDTH}
                y1={y}
                y2={y}
                strokeWidth={line.emphasis ? 1.5 : 1}
                strokeDasharray={line.emphasis ? "2 3" : "4 3"}
                className={line.emphasis ? "stroke-indigo-400 dark:stroke-indigo-400" : "stroke-slate-300 dark:stroke-slate-700"}
              />
              <text x={0} y={y} dy="0.32em" className="fill-v2-muted font-mono" style={{ fontSize: "10px" }}>
                {line.label} {line.value.toFixed(4)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#v2-range-fill)" stroke="none" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400" />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={5}
          strokeWidth={2.5}
          stroke="currentColor"
          className="fill-white dark:fill-slate-900 text-blue-600 dark:text-blue-400"
        />
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <p className="text-[11px] text-v2-muted">
          {t.showing(series.length, t.unit[timeframe], series[0].date, series[series.length - 1].date)}
        </p>
        {pivots && <p className="text-[11px] text-v2-muted">{t.pivotBasis(formatBasis(pivots.basedOnDate, timeframe))}</p>}
      </div>
    </div>
  );
}
