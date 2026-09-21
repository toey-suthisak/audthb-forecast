"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

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
  },
  th: {
    label: (days: RangeDays) => (days === 365 ? "ทั้งหมด" : `${days} วัน`),
    showing: (n: number, from: string, to: string) => `แสดงข้อมูลจริง ${n} วัน จาก ${from} ถึง ${to}`,
    notEnough: "ข้อมูลราคายังไม่พอสำหรับตีกราฟ",
  },
} as const;

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;

export default function RangeChart({
  series,
  locale,
}: {
  series: RangePoint[];
  locale: Locale;
}) {
  const t = STR[locale];
  const [range, setRange] = useState<RangeDays>(30);

  if (series.length < 2) {
    return <p className="text-sm text-v2-muted">{t.notEnough}</p>;
  }

  const sliced = series.slice(-range);
  const closes = sliced.map((p) => p.close);
  const rawMin = Math.min(...closes);
  const rawMax = Math.max(...closes);
  const padding = (rawMax - rawMin) * 0.1 || 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const stepX = sliced.length > 1 ? CHART_WIDTH / (sliced.length - 1) : 0;
  const yFor = (v: number) => CHART_HEIGHT - ((v - min) / span) * CHART_HEIGHT;

  const path = closes
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");

  const areaPath = `${path} L${((sliced.length - 1) * stepX).toFixed(1)},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;

  const lastY = yFor(closes[closes.length - 1]);
  const lastX = (sliced.length - 1) * stepX;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
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

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="w-full h-[220px]">
        <defs>
          <linearGradient id="v2-range-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" className="text-blue-500" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-blue-500" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#v2-range-fill)" stroke="none" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400" />
        <circle cx={lastX} cy={lastY} r={3.5} fill="currentColor" className="text-blue-600 dark:text-blue-400" />
      </svg>

      <p className="text-[11px] text-v2-muted mt-2">
        {t.showing(sliced.length, sliced[0].date, sliced[sliced.length - 1].date)}
      </p>
    </div>
  );
}
