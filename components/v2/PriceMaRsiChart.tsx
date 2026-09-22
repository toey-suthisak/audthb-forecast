"use client";

import type { Locale } from "@/lib/i18n";
import type { PriceStudyPoint } from "@/lib/long-term-technicals-data";

const STR = {
  en: { price: "AUD/THB", sma50: "MA50", sma200: "MA200", rsi: "RSI(14)", overbought: "Overbought (70)", oversold: "Oversold (30)" },
  th: { price: "AUD/THB", sma50: "MA50", sma200: "MA200", rsi: "RSI(14)", overbought: "Overbought (70)", oversold: "Oversold (30)" },
} as const;

const WIDTH = 720;
const PRICE_HEIGHT = 200;
const GAP = 20;
const RSI_HEIGHT = 90;
const TOTAL_HEIGHT = PRICE_HEIGHT + GAP + RSI_HEIGHT;
const PAD_LEFT = 4;

function pathFor(values: (number | null)[], stepX: number, yFor: (v: number) => number): string {
  let d = "";
  let started = false;
  values.forEach((v, i) => {
    if (v === null) {
      started = false;
      return;
    }
    const x = PAD_LEFT + i * stepX;
    const y = yFor(v);
    d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    started = true;
  });
  return d.trim();
}

export default function PriceMaRsiChart({ points, locale }: { points: PriceStudyPoint[]; locale: Locale }) {
  const t = STR[locale];

  if (points.length < 2) return null;

  const stepX = (WIDTH - PAD_LEFT * 2) / (points.length - 1);

  const closes = points.map((p) => p.close);
  const smaValues = points.flatMap((p) => [p.sma50, p.sma200]).filter((v): v is number => v !== null);
  const allPriceValues = [...closes, ...smaValues];
  const rawMin = Math.min(...allPriceValues);
  const rawMax = Math.max(...allPriceValues);
  const pad = (rawMax - rawMin) * 0.08 || 0.01;
  const priceMin = rawMin - pad;
  const priceMax = rawMax + pad;
  const priceSpan = priceMax - priceMin || 1;
  const yForPrice = (v: number) => PRICE_HEIGHT - ((v - priceMin) / priceSpan) * PRICE_HEIGHT;

  const yForRsi = (v: number) => PRICE_HEIGHT + GAP + RSI_HEIGHT - (v / 100) * RSI_HEIGHT;

  const closePath = pathFor(closes, stepX, yForPrice);
  const sma50Path = pathFor(points.map((p) => p.sma50), stepX, yForPrice);
  const sma200Path = pathFor(points.map((p) => p.sma200), stepX, yForPrice);
  const rsiPath = pathFor(points.map((p) => p.rsi14), stepX, yForRsi);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-2 text-[11px] text-v2-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-blue-600" /> {t.price}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-amber-500" /> {t.sma50}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-indigo-500" /> {t.sma200}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-teal-500" /> {t.rsi}
        </span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`} preserveAspectRatio="none" className="w-full" style={{ height: TOTAL_HEIGHT }}>
        <path d={closePath} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400" />
        <path d={sma50Path} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="text-amber-500" />
        <path d={sma200Path} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500" />

        <line x1={0} x2={WIDTH} y1={PRICE_HEIGHT + GAP / 2} y2={PRICE_HEIGHT + GAP / 2} className="stroke-v2-border" strokeWidth={1} />

        <line x1={0} x2={WIDTH} y1={yForRsi(70)} y2={yForRsi(70)} strokeDasharray="3 3" className="stroke-red-400/60" strokeWidth={1} />
        <line x1={0} x2={WIDTH} y1={yForRsi(30)} y2={yForRsi(30)} strokeDasharray="3 3" className="stroke-emerald-400/60" strokeWidth={1} />
        <text x={WIDTH} y={yForRsi(70)} dy="-3" textAnchor="end" className="fill-v2-muted" style={{ fontSize: "9px" }}>
          70
        </text>
        <text x={WIDTH} y={yForRsi(30)} dy="10" textAnchor="end" className="fill-v2-muted" style={{ fontSize: "9px" }}>
          30
        </text>
        <path d={rsiPath} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="text-teal-500" />
      </svg>

      <div className="flex items-center justify-between text-[11px] text-v2-muted mt-1">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
