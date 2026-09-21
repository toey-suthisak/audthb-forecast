import type { TechnicalOutlook as TechnicalOutlookData, PricePoint } from "@/lib/technical-outlook-data";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import type { Locale } from "@/lib/i18n";

const STR = {
  en: {
    title: "Technical Outlook",
    currentPrice: "Current price",
    pivot: "Pivot",
    resistance: "Resistance",
    support: "Support",
    swingRange: (days: number) => `${days}-day range`,
    actionBias: "Action bias",
    basedOn: (date: string) => `Pivot based on ${date}'s close`,
    chartAria: (from: string, to: string) => `AUD/THB price with pivot support/resistance levels, ${from} to ${to}`,
  },
  th: {
    title: "มุมมองทางเทคนิค",
    currentPrice: "ราคาปัจจุบัน",
    pivot: "จุดหมุน",
    resistance: "แนวต้าน",
    support: "แนวรับ",
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    actionBias: "แนวทาง Action",
    basedOn: (date: string) => `คำนวณ Pivot จากราคาปิดวันที่ ${date}`,
    chartAria: (from: string, to: string) => `กราฟราคา AUD/THB พร้อมแนวรับ-แนวต้าน จาก ${from} ถึง ${to}`,
  },
} as const;

function biasColor(direction: TechnicalOutlookData["actionBias"]["direction"]) {
  if (direction === "POSTFUND") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "PREFUND") return "text-red-700 dark:text-red-400";
  return "text-stone-500 dark:text-stone-400";
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const CHART_PAD_LEFT = 52;

// Plain hand-rolled SVG, same convention as components/TrendChart.tsx --
// no charting library in this codebase. The price line and every
// reference line share one scale computed from both the price series
// AND the pivot levels, so a level the price hasn't reached yet (e.g.
// R2 during a quiet week) still draws on-chart instead of clipping.
function PriceChart({
  series,
  pivots,
  currentRate,
  locale,
}: {
  series: PricePoint[];
  pivots: NonNullable<TechnicalOutlookData["pivots"]>;
  currentRate: number | null;
  locale: Locale;
}) {
  const t = STR[locale];
  if (series.length < 2) return null;

  const closes = series.map((p) => p.close);
  const levels = [pivots.r2, pivots.r1, pivots.pivot, pivots.s1, pivots.s2];
  const allValues = [...closes, ...levels, ...(currentRate !== null ? [currentRate] : [])];

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.08 || 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const plotWidth = CHART_WIDTH - CHART_PAD_LEFT;
  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;
  const yFor = (value: number) => CHART_HEIGHT - ((value - min) / span) * CHART_HEIGHT;

  const path = closes
    .map((v, i) => {
      const x = CHART_PAD_LEFT + i * stepX;
      const y = yFor(v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastX = CHART_PAD_LEFT + (series.length - 1) * stepX;
  const lastY = yFor(closes[closes.length - 1]);

  const referenceLines: { value: number; label: string; emphasis?: boolean }[] = [
    { value: pivots.r2, label: "R2" },
    { value: pivots.r1, label: "R1" },
    { value: pivots.pivot, label: t.pivot, emphasis: true },
    { value: pivots.s1, label: "S1" },
    { value: pivots.s2, label: "S2" },
  ];

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="w-full h-[160px] mt-3"
      role="img"
      aria-label={t.chartAria(series[0].date, series[series.length - 1].date)}
    >
      {referenceLines.map((line) => {
        const y = yFor(line.value);
        return (
          <g key={line.label}>
            <line
              x1={CHART_PAD_LEFT}
              x2={CHART_WIDTH}
              y1={y}
              y2={y}
              strokeWidth={line.emphasis ? 1.25 : 1}
              strokeDasharray={line.emphasis ? "2 3" : "4 3"}
              className={line.emphasis ? "stroke-brass-500 dark:stroke-brass-400" : "stroke-stone-300 dark:stroke-stone-700"}
            />
            <text
              x={0}
              y={y}
              dy="0.32em"
              className="fill-stone-500 dark:fill-stone-400"
              style={{ fontSize: "9px" }}
            >
              {line.label}
            </text>
          </g>
        );
      })}

      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-stone-900 dark:text-stone-100"
      />
      <circle cx={lastX} cy={lastY} r={3.5} fill="currentColor" className="text-stone-900 dark:text-stone-100" />
    </svg>
  );
}

export default function TechnicalOutlook({
  outlook,
  locale,
}: {
  outlook: TechnicalOutlookData;
  locale: Locale;
}) {
  const t = STR[locale];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        {t.title}
      </h2>

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
        {outlook.disclaimer}
      </p>

      {!outlook.available || !outlook.pivots ? (
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-3">
          {outlook.error}
        </p>
      ) : (
        <>
          {outlook.currentRate !== null && (
            <div className="mt-4">
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.currentPrice}</p>
              <Figure value={outlook.currentRate.toFixed(4)} className="block text-2xl font-semibold" />
            </div>
          )}

          <PriceChart
            series={outlook.priceSeries}
            pivots={outlook.pivots}
            currentRate={outlook.currentRate}
            locale={locale}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.resistance} 2</p>
              <Figure value={outlook.pivots.r2.toFixed(4)} className="block text-base font-semibold" />
            </div>
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.resistance} 1</p>
              <Figure value={outlook.pivots.r1.toFixed(4)} className="block text-base font-semibold" />
            </div>
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.support} 1</p>
              <Figure value={outlook.pivots.s1.toFixed(4)} className="block text-base font-semibold" />
            </div>
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.support} 2</p>
              <Figure value={outlook.pivots.s2.toFixed(4)} className="block text-base font-semibold" />
            </div>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-500 mt-2">
            {t.pivot}: <Figure value={outlook.pivots.pivot.toFixed(4)} className="font-semibold" /> ({t.basedOn(outlook.pivots.basedOnDate)})
            {outlook.swingHigh !== null && outlook.swingLow !== null ? (
              <> · {t.swingRange(outlook.swingLookbackDays)}: {outlook.swingLow.toFixed(4)} - {outlook.swingHigh.toFixed(4)}</>
            ) : null}
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-stone-700 dark:text-stone-300 list-disc list-inside">
            {outlook.narrative.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.actionBias}</p>
            <p className={`text-base font-semibold ${biasColor(outlook.actionBias.direction)}`}>
              {outlook.actionBias.label}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-500 mt-1 leading-relaxed">
              {outlook.actionBias.note}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
