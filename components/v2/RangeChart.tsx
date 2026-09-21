"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { PivotLevels } from "@/lib/technical-outlook-data";

export type RangePoint = { date: string; close: number };

// Ranges are daily-bar granularity (this app's real price history is
// stored as one bar per Bangkok day -- see get_daily_price_bars in
// supabase/migrations), not the mockup's literal "1D" intraday view --
// renamed to what's actually being shown rather than promising
// intraday resolution this component doesn't have. Real history is
// currently only ~10 days deep, so every range button shows the same
// handful of real points until more real data accumulates -- no padding.
const RANGE_DAYS = [7, 30, 90, 365] as const;
type RangeDays = (typeof RANGE_DAYS)[number];

const STR = {
  en: {
    label: (days: RangeDays) => (days === 365 ? "All" : `${days}D`),
    showing: (n: number, from: string, to: string) => `Showing ${n} real day(s), ${from} to ${to}`,
    notEnough: "Not enough price history to chart yet.",
    currentPrice: "Current price",
    change1H: "1H change",
    swingRange: (days: number) => `${days}-day range`,
    pivotBasis: (date: string) => `Pivot based on ${date}'s close`,
  },
  th: {
    label: (days: RangeDays) => (days === 365 ? "ทั้งหมด" : `${days} วัน`),
    showing: (n: number, from: string, to: string) => `แสดงข้อมูลจริง ${n} วัน จาก ${from} ถึง ${to}`,
    notEnough: "ข้อมูลราคายังไม่พอสำหรับตีกราฟ",
    currentPrice: "ราคาปัจจุบัน",
    change1H: "เปลี่ยนแปลง 1H",
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    pivotBasis: (date: string) => `คำนวณ Pivot จากราคาปิดวันที่ ${date}`,
  },
} as const;

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PAD_LEFT = 78;

export default function RangeChart({
  series,
  locale,
  pivots = null,
  currentRate = null,
  change1H = null,
  swingLow = null,
  swingHigh = null,
  swingDays = null,
}: {
  series: RangePoint[];
  locale: Locale;
  pivots?: PivotLevels | null;
  currentRate?: number | null;
  change1H?: number | null;
  swingLow?: number | null;
  swingHigh?: number | null;
  swingDays?: number | null;
}) {
  const t = STR[locale];
  const [range, setRange] = useState<RangeDays>(30);

  if (series.length < 2) {
    return <p className="text-sm text-v2-muted">{t.notEnough}</p>;
  }

  const sliced = series.slice(-range);
  const closes = sliced.map((p) => p.close);

  const pivotLevels = pivots ? [pivots.r3, pivots.r2, pivots.r1, pivots.pivot, pivots.s1, pivots.s2, pivots.s3] : [];
  const allValues = [...closes, ...pivotLevels, ...(currentRate !== null ? [currentRate] : [])];

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.08 || 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const plotWidth = CHART_WIDTH - PAD_LEFT;
  const stepX = sliced.length > 1 ? plotWidth / (sliced.length - 1) : 0;
  const yFor = (v: number) => CHART_HEIGHT - ((v - min) / span) * CHART_HEIGHT;

  const path = closes
    .map((v, i) => `${i === 0 ? "M" : "L"}${(PAD_LEFT + i * stepX).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");

  const areaPath = `${path} L${(PAD_LEFT + (sliced.length - 1) * stepX).toFixed(1)},${CHART_HEIGHT} L${PAD_LEFT},${CHART_HEIGHT} Z`;

  const lastY = yFor(closes[closes.length - 1]);
  const lastX = PAD_LEFT + (sliced.length - 1) * stepX;

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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-start gap-8">
          {currentRate !== null && (
            <div>
              <p className="text-xs text-v2-muted">{t.currentPrice}</p>
              <p className="font-mono text-2xl font-semibold text-v2-foreground">{currentRate.toFixed(4)}</p>
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

        <div className="flex items-center gap-1.5">
          {RANGE_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRange(days)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === days
                  ? "bg-blue-600 text-white"
                  : "text-v2-muted hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t.label(days)}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="w-full h-[260px]">
        <defs>
          <linearGradient id="v2-range-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" className="text-blue-500" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-blue-500" />
          </linearGradient>
        </defs>

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
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400" />
        <circle cx={lastX} cy={lastY} r={3.5} fill="currentColor" className="text-blue-600 dark:text-blue-400" />
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <p className="text-[11px] text-v2-muted">{t.showing(sliced.length, sliced[0].date, sliced[sliced.length - 1].date)}</p>
        {pivots && <p className="text-[11px] text-v2-muted">{t.pivotBasis(pivots.basedOnDate)}</p>}
      </div>
    </div>
  );
}
