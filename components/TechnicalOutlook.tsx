import type { TechnicalOutlook as TechnicalOutlookData, PricePoint, ForecastEntry } from "@/lib/technical-outlook-data";
import type { ForecastDirection } from "@/lib/forecast-data";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import StatusBadge from "@/components/StatusBadge";
import InfoTip from "@/components/InfoTip";
import { tLabel, type Locale } from "@/lib/i18n";

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
    trend: (n: number) => `Trend (SMA ${n})`,
    momentum: (n: number) => `Momentum (RSI ${n})`,
    priceLegend: "Price",
    smaLegend: (n: number) => `SMA(${n})`,
    forecastHeading: "Forecast",
    forecastTooltip:
      "Derived from today's Core FX Score using a slope/intercept fit against real resolved forecasts per horizon, shrunk toward the original naive assumption since the real correlation is still weak. Track Record below is the only honest measure of how well each one actually performs.",
    forecastAllNeutral:
      "All three read NEUTRAL because Core FX Score is inside the -15 to +15 neutral band -- every horizon uses the same directional call, only the predicted move size differs.",
    forecastUnavailable: "Core FX Score is not available right now -- unable to calculate a forecast.",
    forecastPriceRange: (low: string, high: string) => `Price range: ${low} to ${high}`,
    forecastDirectionCorrect: (pct: string, n: number, basePct: string) =>
      `Direction correct ${pct}% of last ${n} (baseline ${basePct}%)`,
    forecastNotEnough: (extra: string) => `Not enough resolved forecasts yet to show accuracy${extra}.`,
    forecastCaution: "Caution",
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
    trend: (n: number) => `แนวโน้ม (SMA ${n} วัน)`,
    momentum: (n: number) => `Momentum (RSI ${n} วัน)`,
    priceLegend: "ราคา",
    smaLegend: (n: number) => `SMA(${n})`,
    forecastHeading: "พยากรณ์",
    forecastTooltip:
      "คำนวณจาก Core FX Score ของวันนี้ด้วยค่า slope/intercept ที่ปรับเทียบจากผลพยากรณ์จริงที่มีผลแล้วในแต่ละกรอบเวลา แล้วดึงเข้าใกล้สมมติฐานเดิมเพราะความสัมพันธ์จริงยังอ่อน Track Record ด้านล่างคือตัวชี้วัดความแม่นยำจริงเพียงอย่างเดียวที่เชื่อถือได้",
    forecastAllNeutral:
      "ทั้งสามกรอบเวลาอ่านได้ NEUTRAL เพราะ Core FX Score อยู่ในช่วงเป็นกลาง -15 ถึง +15 -- ทุกกรอบเวลาใช้เกณฑ์ทิศทางเดียวกัน ต่างกันแค่ขนาดการเคลื่อนไหวที่คาดการณ์",
    forecastUnavailable: "ไม่มี Core FX Score ในขณะนี้ -- ไม่สามารถคำนวณพยากรณ์ได้",
    forecastPriceRange: (low: string, high: string) => `ช่วงราคา: ${low} ถึง ${high}`,
    forecastDirectionCorrect: (pct: string, n: number, basePct: string) =>
      `ทายทิศทางถูก ${pct}% จาก ${n} ครั้งล่าสุด (baseline ${basePct}%)`,
    forecastNotEnough: (extra: string) => `ยังมีข้อมูลไม่พอที่จะแสดงความแม่นยำ${extra}`,
    forecastCaution: "ข้อควรระวัง",
  },
} as const;

function forecastDirectionColor(direction: ForecastDirection) {
  if (direction === "BULLISH") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "BEARISH") return "text-red-700 dark:text-red-400";
  return "text-stone-700 dark:text-stone-300";
}

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
  smaShortPeriod,
  locale,
}: {
  series: PricePoint[];
  pivots: NonNullable<TechnicalOutlookData["pivots"]>;
  currentRate: number | null;
  smaShortPeriod: number | null;
  locale: Locale;
}) {
  const t = STR[locale];
  if (series.length < 2) return null;

  const closes = series.map((p) => p.close);
  const smaValues = series.map((p) => p.smaShort).filter((v): v is number => v !== null);
  const levels = [pivots.r2, pivots.r1, pivots.pivot, pivots.s1, pivots.s2];
  const allValues = [...closes, ...smaValues, ...levels, ...(currentRate !== null ? [currentRate] : [])];

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

  // SMA overlay only draws from the first index that has a real value --
  // early points stay undefined rather than padded/faked (see
  // rollingSma in lib/technical-outlook-data.ts).
  let smaPath = "";
  let smaStarted = false;
  series.forEach((point, i) => {
    if (point.smaShort === null) return;
    const x = CHART_PAD_LEFT + i * stepX;
    const y = yFor(point.smaShort);
    smaPath += `${smaStarted ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    smaStarted = true;
  });

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

      {smaPath && (
        <path
          d={smaPath.trim()}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-sky-600 dark:text-sky-400"
          stroke="currentColor"
        />
      )}

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

function ChartLegend({ smaShortPeriod, locale }: { smaShortPeriod: number | null; locale: Locale }) {
  const t = STR[locale];
  return (
    <div className="flex items-center gap-4 mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 bg-stone-900 dark:bg-stone-100" />
        {t.priceLegend}
      </span>
      {smaShortPeriod !== null && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-sky-600 dark:bg-sky-400" />
          {t.smaLegend(smaShortPeriod)}
        </span>
      )}
    </div>
  );
}

function ForecastPanel({
  outlook,
  locale,
}: {
  outlook: TechnicalOutlookData;
  locale: Locale;
}) {
  const t = STR[locale];

  return (
    <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
      <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest inline-flex items-center">
        {t.forecastHeading}
        <InfoTip text={t.forecastTooltip} />
      </p>

      {outlook.forecasts.length > 0 ? (
        <>
          {outlook.forecastAllNeutral && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
              {t.forecastAllNeutral}
            </p>
          )}

          <div className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
            {outlook.forecasts.map((forecast: ForecastEntry) => (
              <div key={forecast.horizon} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-500 shrink-0">
                    {forecast.horizon}
                  </span>
                  <p className={`text-lg font-semibold ${forecastDirectionColor(forecast.direction)}`}>
                    {tLabel(forecast.direction, locale)}
                  </p>
                  <StatusBadge label={tLabel("Uncalibrated", locale)} tone="amber" />
                  <span className="text-xs text-stone-600 dark:text-stone-400 ml-auto">
                    {forecast.predictedMovePct >= 0 ? "+" : ""}
                    {forecast.predictedMovePct.toFixed(2)}% ({forecast.predictedRangeLowPct.toFixed(2)}% to{" "}
                    {forecast.predictedRangeHighPct.toFixed(2)}%)
                  </span>
                </div>

                {forecast.priceRange && (
                  <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5">
                    {t.forecastPriceRange(forecast.priceRange.low.toFixed(4), forecast.priceRange.high.toFixed(4))}
                  </p>
                )}

                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                  {forecast.trackRecord && !forecast.trackRecord.insufficientData ? (
                    t.forecastDirectionCorrect(
                      (forecast.trackRecord.directionalAccuracyPct ?? 0).toFixed(1),
                      forecast.trackRecord.sampleSize,
                      (forecast.trackRecord.baselineAccuracyPct ?? 0).toFixed(1),
                    )
                  ) : (
                    t.forecastNotEnough(
                      forecast.trackRecord
                        ? ` (${forecast.trackRecord.sampleSize}/${forecast.trackRecord.minSampleSize})`
                        : "",
                    )
                  )}
                </p>
              </div>
            ))}
          </div>

          {outlook.forecastCautionNotes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                {t.forecastCaution}
              </p>
              <ul className="mt-1 space-y-1">
                {outlook.forecastCautionNotes.map((note, i) => (
                  <li key={i} className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{t.forecastUnavailable}</p>
      )}
    </div>
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
            smaShortPeriod={outlook.smaShortPeriod}
            locale={locale}
          />
          <ChartLegend smaShortPeriod={outlook.smaShortPeriod} locale={locale} />

          {(outlook.smaShortValue !== null || outlook.rsiValue !== null) && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              {outlook.smaShortValue !== null && outlook.smaShortPeriod !== null && (
                <div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{t.trend(outlook.smaShortPeriod)}</p>
                  <Figure value={outlook.smaShortValue.toFixed(4)} className="block text-base font-semibold" />
                </div>
              )}
              {outlook.rsiValue !== null && outlook.rsiPeriod !== null && (
                <div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{t.momentum(outlook.rsiPeriod)}</p>
                  <Figure value={outlook.rsiValue.toFixed(1)} className="block text-base font-semibold" />
                </div>
              )}
            </div>
          )}

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

          <ForecastPanel outlook={outlook} locale={locale} />

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
