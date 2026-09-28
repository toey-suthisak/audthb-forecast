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
    nowTag: "Now",
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
    nowTag: "ตอนนี้",
  },
} as const;

const CHART_WIDTH = 720;
const CHART_HEIGHT = 340;
// Left edge only needs a hair of margin -- labels used to live here (hence
// the old wide PAD_LEFT), but they've moved to a dedicated right-hand
// gutter next to where the eye already is (the current price/last point),
// which also frees this side for more of the actual price line.
const PAD_LEFT = 8;
// Right-hand label gutter: wide enough for "R3 23.7500"-style tags.
const PAD_RIGHT = 68;

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

  // Scale is driven by the real price series alone (plus the current
  // rate), never by pivot levels -- a pivot computed from a single
  // recent bar (especially 1H/4H) can sit in a much tighter band than
  // the series' own real swing over its full visible window, and
  // forcing every pivot line into that scale used to squeeze the whole
  // R3-S3 ladder into an unreadable cluster of overlapping labels while
  // the price line dominated the rest of the chart. Pivot lines that
  // fall outside this real price-driven window are simply not drawn
  // (see referenceLines below) instead of distorting the scale to fit
  // them -- a level far from the visible price action isn't relevant to
  // what's on screen right now anyway.
  const priceValues = [...closes, ...(currentRate !== null ? [currentRate] : [])];

  const rawMin = Math.min(...priceValues);
  const rawMax = Math.max(...priceValues);
  const padding = (rawMax - rawMin) * 0.12 || 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotRight = CHART_WIDTH - PAD_RIGHT;
  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;
  const yFor = (v: number) => CHART_HEIGHT - ((v - min) / span) * CHART_HEIGHT;

  const points = closes.map((v, i) => ({ x: PAD_LEFT + i * stepX, y: yFor(v) }));
  const path = smoothPath(points);

  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${CHART_HEIGHT} L${PAD_LEFT},${CHART_HEIGHT} Z`;

  const lastPoint = points[points.length - 1];

  // A single-bar pivot ladder (R3..S3) sits in a much tighter band than
  // the price series' own full-window swing, especially on WEEKLY/1H
  // where one bar's high-low is tiny next to the chart's real range. Text
  // labels drawn at their true y can then land within a few px of each
  // other and overlap into an unreadable smear. The dashed lines stay at
  // their real, accurate y -- only the text labels get spread apart
  // (min 11px gap) via a two-pass declutter, with a short leader when a
  // label's forced position no longer sits on its own line.
  //
  // Each line also carries a `kind` (resistance/support/pivot/current) for
  // color-coding and a `near` flag: R1/P/S1 are the levels every other
  // narrative on this page already talks about (the ones a price move
  // actually has to clear next), so they're drawn bolder and full-opacity;
  // the outer R2/R3/S2/S3 rungs are real but secondary, so they recede
  // (thinner, lighter) instead of competing for attention.
  type LineKind = "resistance" | "support" | "pivot" | "current";
  type RefLineInput = { value: number; label: string; kind: LineKind; near: boolean };
  const pivotLines: RefLineInput[] = pivots
    ? (
        [
          { value: pivots.r3, label: "R3", kind: "resistance", near: false },
          { value: pivots.r2, label: "R2", kind: "resistance", near: false },
          { value: pivots.r1, label: "R1", kind: "resistance", near: true },
          { value: pivots.pivot, label: "P", kind: "pivot", near: true },
          { value: pivots.s1, label: "S1", kind: "support", near: true },
          { value: pivots.s2, label: "S2", kind: "support", near: false },
          { value: pivots.s3, label: "S3", kind: "support", near: false },
        ] as RefLineInput[]
      ).filter((line) => line.value >= min && line.value <= max)
    : [];

  // The live price as its own full-width reference line (same pattern as
  // most trading charts) ties the pivot ladder directly to "where are we
  // right now" instead of leaving that connection to the big number above
  // the chart, disconnected from the R/S levels.
  const nowLine: { value: number; label: string; kind: LineKind; near: boolean }[] =
    currentRate !== null && currentRate >= min && currentRate <= max
      ? [{ value: currentRate, label: t.nowTag, kind: "current", near: true }]
      : [];

  const LABEL_MIN_GAP = 11;
  const referenceLines = [...pivotLines, ...nowLine]
    .map((line) => ({ ...line, y: yFor(line.value), labelY: yFor(line.value) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < referenceLines.length; i++) {
    referenceLines[i].labelY = Math.max(referenceLines[i].labelY, referenceLines[i - 1].labelY + LABEL_MIN_GAP);
  }
  if (referenceLines.length > 0) {
    const lastIndex = referenceLines.length - 1;
    referenceLines[lastIndex].labelY = Math.min(referenceLines[lastIndex].labelY, CHART_HEIGHT - 4);
    for (let i = lastIndex - 1; i >= 0; i--) {
      referenceLines[i].labelY = Math.min(referenceLines[i].labelY, referenceLines[i + 1].labelY - LABEL_MIN_GAP);
    }
    referenceLines[0].labelY = Math.max(referenceLines[0].labelY, 4);
  }

  // Faint horizontal gridlines only when there's no pivot ladder to serve
  // as a scale reference instead -- with pivots on screen, generic
  // gridlines just add lines that don't mean anything on top of ones that
  // do.
  const gridlineCount = 4;
  const gridlines =
    referenceLines.length > 0 ? [] : Array.from({ length: gridlineCount + 1 }, (_, i) => CHART_HEIGHT * (i / gridlineCount));

  const LINE_STYLE: Record<LineKind, { stroke: string; text: string }> = {
    resistance: { stroke: "stroke-rose-300 dark:stroke-rose-800/70", text: "fill-rose-600 dark:fill-rose-400" },
    support: { stroke: "stroke-emerald-300 dark:stroke-emerald-800/70", text: "fill-emerald-600 dark:fill-emerald-400" },
    pivot: { stroke: "stroke-indigo-400 dark:stroke-indigo-400", text: "fill-indigo-600 dark:fill-indigo-400" },
    current: { stroke: "stroke-blue-500 dark:stroke-blue-400", text: "fill-blue-600 dark:fill-blue-400" },
  };

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
          <line key={y} x1={PAD_LEFT} x2={plotRight} y1={y} y2={y} strokeWidth={1} className="stroke-slate-100 dark:stroke-slate-800/60" />
        ))}

        {referenceLines.map((line) => {
          const labelShifted = Math.abs(line.labelY - line.y) > 2;
          const style = LINE_STYLE[line.kind];
          const isCurrent = line.kind === "current";
          return (
            <g key={`${line.kind}-${line.label}`}>
              <line
                x1={PAD_LEFT}
                x2={plotRight}
                y1={line.y}
                y2={line.y}
                strokeWidth={isCurrent ? 1.5 : line.near ? 1.25 : 0.75}
                strokeDasharray={isCurrent ? undefined : line.kind === "pivot" ? "2 3" : line.near ? "4 3" : "2 4"}
                className={style.stroke}
                opacity={isCurrent || line.near ? 1 : 0.55}
              />
              {labelShifted && (
                <line
                  x1={plotRight}
                  x2={plotRight + 6}
                  y1={line.y}
                  y2={line.labelY}
                  strokeWidth={0.75}
                  className={style.stroke}
                  opacity={0.55}
                />
              )}
              <text
                x={plotRight + 8}
                y={line.labelY}
                dy="0.32em"
                className={`${style.text} font-mono ${isCurrent ? "font-semibold" : "font-medium"}`}
                style={{ fontSize: line.near || isCurrent ? "10px" : "9px" }}
                opacity={isCurrent || line.near ? 1 : 0.8}
              >
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
