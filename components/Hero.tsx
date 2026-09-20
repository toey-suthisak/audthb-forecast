import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import { getEventRisk } from "@/lib/event-calendar-data";
import { getConfidence, type ConfidenceLevel } from "@/lib/confidence-data";
import { buildForecast, FORECAST_HORIZONS, FORECAST_VERSION, type ForecastDirection } from "@/lib/forecast-data";
import { getEvaluationSummary } from "@/lib/evaluation-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import ScoreGauge from "@/components/ScoreGauge";
import InfoTip from "@/components/InfoTip";
import Figure from "@/components/Figure";
import { tLabel, freshnessLabel, type Locale } from "@/lib/i18n";

function confidenceTone(level: ConfidenceLevel): BadgeTone {
  if (level === "HIGH") return "emerald";
  if (level === "MEDIUM") return "amber";
  return "red";
}

function formatHoursUntil(hours: number, locale: Locale) {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return locale === "th" ? `${mins} นาที` : `${mins} min`;
  }
  return locale === "th" ? `${hours.toFixed(1)} ชม.` : `${hours.toFixed(1)}h`;
}

function freshnessTone(status: string): BadgeTone {
  if (status === "FRESH") return "emerald";
  if (status === "DELAYED") return "amber";
  if (status === "MARKET_CLOSED") return "slate";
  return "red";
}

function changeColor(value: number | null) {
  if (value === null) return "text-stone-600 dark:text-stone-400";
  if (value > 0) return "text-emerald-700 dark:text-emerald-400";
  if (value < 0) return "text-red-700 dark:text-red-400";
  return "text-stone-600 dark:text-stone-400";
}

function scoreTextColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score >= 15) return "text-emerald-700 dark:text-emerald-400";
  if (score <= -15) return "text-red-700 dark:text-red-400";
  return "text-amber-700 dark:text-amber-400";
}

function formatFactorScore(score: number | null) {
  if (score === null) return null;
  return `${score > 0 ? "+" : ""}${score}`;
}

// Matches ScoreBreakdown's own per-factor coloring (sign-based) --
// distinct from scoreTextColor above, which bands the aggregate score
// against the -15/+15 bias thresholds instead.
function factorScoreColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score > 0) return "text-emerald-700 dark:text-emerald-400";
  if (score < 0) return "text-red-700 dark:text-red-400";
  return "text-stone-600 dark:text-stone-300";
}

function forecastDirectionColor(direction: ForecastDirection) {
  if (direction === "BULLISH") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "BEARISH") return "text-red-700 dark:text-red-400";
  return "text-stone-700 dark:text-stone-300";
}

function coreFeeds(data: DashboardData, locale: Locale) {
  return [
    { label: locale === "th" ? "ตรง" : "Direct", status: data.directFreshness.status },
    { label: "AUD/USD", status: data.audUsdFreshness.status },
    { label: "USD/THB", status: data.usdThbFreshness.status },
  ];
}

function feedDotColor(status: string) {
  if (status === "FRESH") return "text-emerald-500 dark:text-emerald-400";
  if (status === "DELAYED") return "text-amber-500 dark:text-amber-400";
  if (status === "MARKET_CLOSED") return "text-stone-400 dark:text-stone-600";
  return "text-red-500 dark:text-red-400";
}

const STR = {
  en: {
    spot: "AUD/THB Spot",
    range: "Range",
    updated: (time: string, source: string) => `Updated ${time} (Bangkok) via ${source}`,
    forecast: "Forecast",
    forecastTooltip:
      "Derived from today's Core FX Score using a fixed, uncalibrated formula per horizon -- it is not a statistically fitted prediction. Track Record below is the only honest measure of how well each one actually performs.",
    allNeutral: (score: number) =>
      `All three read NEUTRAL because Core FX Score (${score}) is inside the -15 to +15 neutral band -- every horizon uses the same directional call, only the predicted move size differs.`,
    priceRange: (low: string, high: string) => `Price range: ${low} to ${high}`,
    directionCorrect: (pct: string, n: number, basePct: string) =>
      `Direction correct ${pct}% of last ${n} (baseline ${basePct}%)`,
    notEnough: (extra: string) => `Not enough resolved forecasts yet to show accuracy${extra}.`,
    caution: "Caution",
    noForecast: "Core FX Score is not available right now -- unable to calculate a forecast.",
    coreFxScore: "Core FX Score",
    coreFxScoreTooltip:
      "One score combining 7 market and economic signals: -100 (bearish AUD) to +100 (bullish AUD). Not a price prediction.",
    confidence: "Confidence",
    eventRisk: (level: string, name: string, currency: string, hours: string) =>
      `Event Risk (${level}): ${name} (${currency}) in ${hours} -- expect volatility, treat this score with extra caution.`,
    modelCoverage: "Model Coverage",
    modelCoverageTooltip: "How much of the model actually had data this run. Lower means fewer signals than usual.",
    modelCoverageLine1: "Coverage is the share of data actually available right now, not the accuracy of the score.",
    modelCoverageLine2:
      "Gold isn't included in the score yet, but coverage can still reach 100/100 when all other data is complete, and drops when data is missing or the market is closed.",
    factorsHeading: "Factors behind this score",
    viewBreakdown: "View full Score Breakdown →",
    eventRiskAround: (name: string, currency: string, hours: string) =>
      `${name} (${currency}) in ${hours} -- expect volatility around that time.`,
    confidenceCaution: (level: string) => `Confidence is currently ${level} -- see reasons above.`,
    coverageCaution: (coverage: string) =>
      `Model coverage is only ${coverage}/100 right now -- some signals are missing or delayed.`,
    marketClosedCaution: "AUD/THB market is currently closed -- these ranges assume normal trading conditions.",
    factors: {
      priceMomentum: {
        name: "Price / Momentum",
        tooltip: "Shows what the market is doing right now, before slower news or data can catch up.",
        weightLabel: "FX Weight: 35%",
      },
      crossCurrency: {
        name: "Cross Currency",
        tooltip: "Double-checks the price a second way, so one glitchy data feed can't fool the model.",
        weightLabel: "FX Weight: 20%",
      },
      relativeMarket: {
        name: "Relative Market",
        tooltip: "Money flows and regional risk appetite can move AUD/THB even when nothing changes locally.",
        weightLabel: (w: string) => `Weight: ${w}/15`,
      },
      commodity: {
        name: "Commodity",
        tooltip: "Iron ore and oil prices move AUD/THB on their own, separate from currency markets.",
        weightLabel: (w: string) => `Weight: ${w}/8`,
      },
      meanReversion: {
        name: "Mean Reversion",
        tooltip: "A price that moved too far too fast today tends to snap back a little.",
        weightLabel: "FX Weight: 5%",
      },
      macro: {
        name: "Macro / Policy",
        tooltip: "Rates, inflation, jobs and growth set the bigger trend under the day's price swings.",
        weightLabel: (w: string) => `Weight: ${w}/10`,
      },
      risk: {
        name: "Risk / VIXY",
        tooltip: "AUD is a 'risk' currency -- investors sell it for safety when markets get volatile.",
        weightLabel: (w: string) => `Weight: ${w}/7`,
      },
    },
  },
  th: {
    spot: "AUD/THB ราคาปัจจุบัน",
    range: "ช่วงราคา",
    updated: (time: string, source: string) => `อัปเดต ${time} (เวลาไทย) จาก ${source}`,
    forecast: "พยากรณ์",
    forecastTooltip:
      "คำนวณจาก Core FX Score ของวันนี้ด้วยสูตรคงที่ที่ยังไม่ได้ปรับเทียบในแต่ละกรอบเวลา -- ไม่ใช่การพยากรณ์ที่ผ่านการทดสอบทางสถิติ Track Record ด้านล่างคือตัวชี้วัดความแม่นยำจริงเพียงอย่างเดียวที่เชื่อถือได้",
    allNeutral: (score: number) =>
      `ทั้งสามกรอบเวลาอ่านได้ NEUTRAL เพราะ Core FX Score (${score}) อยู่ในช่วงเป็นกลาง -15 ถึง +15 -- ทุกกรอบเวลาใช้เกณฑ์ทิศทางเดียวกัน ต่างกันแค่ขนาดการเคลื่อนไหวที่คาดการณ์`,
    priceRange: (low: string, high: string) => `ช่วงราคา: ${low} ถึง ${high}`,
    directionCorrect: (pct: string, n: number, basePct: string) =>
      `ทายทิศทางถูก ${pct}% จาก ${n} ครั้งล่าสุด (baseline ${basePct}%)`,
    notEnough: (extra: string) => `ยังมีข้อมูลไม่พอที่จะแสดงความแม่นยำ${extra}`,
    caution: "ข้อควรระวัง",
    noForecast: "ไม่มี Core FX Score ในขณะนี้ -- ไม่สามารถคำนวณพยากรณ์ได้",
    coreFxScore: "Core FX Score",
    coreFxScoreTooltip:
      "คะแนนเดียวที่รวม 7 สัญญาณตลาดและเศรษฐกิจ: -100 (ขาลง AUD) ถึง +100 (ขาขึ้น AUD) ไม่ใช่การพยากรณ์ราคา",
    confidence: "ความมั่นใจ",
    eventRisk: (level: string, name: string, currency: string, hours: string) =>
      `ความเสี่ยงจากข่าว (${level}): ${name} (${currency}) ในอีก ${hours} -- คาดว่าจะผันผวน ควรใช้คะแนนนี้ด้วยความระมัดระวังเป็นพิเศษ`,
    modelCoverage: "ความครบถ้วนของข้อมูล",
    modelCoverageTooltip: "ข้อมูลที่โมเดลได้รับจริงในรอบนี้มีมากแค่ไหน ยิ่งต่ำยิ่งมีสัญญาณน้อยกว่าปกติ",
    modelCoverageLine1: "ความครบถ้วนคือสัดส่วนข้อมูลที่มีอยู่จริงตอนนี้ ไม่ใช่ความแม่นยำของคะแนน",
    modelCoverageLine2:
      "ทองคำยังไม่ถูกนำไปคิดคะแนน แต่ความครบถ้วนยังขึ้นถึง 100/100 ได้เมื่อข้อมูลอื่นครบ และจะลดลงเมื่อข้อมูลขาดหายหรือตลาดปิด",
    factorsHeading: "ปัจจัยที่อยู่เบื้องหลังคะแนนนี้",
    viewBreakdown: "ดู Score Breakdown แบบเต็ม →",
    eventRiskAround: (name: string, currency: string, hours: string) =>
      `${name} (${currency}) ในอีก ${hours} -- คาดว่าจะผันผวนช่วงนั้น`,
    confidenceCaution: (level: string) => `ตอนนี้ความมั่นใจอยู่ที่ระดับ ${level} -- ดูเหตุผลด้านบน`,
    coverageCaution: (coverage: string) =>
      `ความครบถ้วนของข้อมูลตอนนี้มีแค่ ${coverage}/100 -- บางสัญญาณขาดหายหรือมาช้า`,
    marketClosedCaution: "ตลาด AUD/THB ปิดอยู่ในขณะนี้ -- ช่วงราคานี้สมมุติสภาวะการซื้อขายปกติ",
    factors: {
      priceMomentum: {
        name: "ราคา / โมเมนตัม",
        tooltip: "แสดงสิ่งที่ตลาดกำลังทำอยู่ตอนนี้ ก่อนที่ข่าวหรือข้อมูลอื่นที่ช้ากว่าจะตามทัน",
        weightLabel: "น้ำหนัก FX: 35%",
      },
      crossCurrency: {
        name: "Cross Currency",
        tooltip: "ตรวจสอบราคาซ้ำอีกทาง เพื่อไม่ให้ฟีดข้อมูลที่ผิดพลาดหลอกโมเดลได้",
        weightLabel: "น้ำหนัก FX: 20%",
      },
      relativeMarket: {
        name: "Relative Market",
        tooltip: "กระแสเงินทุนและความเสี่ยงในภูมิภาคสามารถขยับ AUD/THB ได้แม้ไม่มีอะไรเปลี่ยนในประเทศ",
        weightLabel: (w: string) => `น้ำหนัก: ${w}/15`,
      },
      commodity: {
        name: "สินค้าโภคภัณฑ์",
        tooltip: "ราคาแร่เหล็กและน้ำมันขยับ AUD/THB ได้เอง แยกจากตลาดค่าเงิน",
        weightLabel: (w: string) => `น้ำหนัก: ${w}/8`,
      },
      meanReversion: {
        name: "Mean Reversion",
        tooltip: "ราคาที่วิ่งไปไกลเกินไปในวันนั้นมักจะดีดกลับมาบ้าง",
        weightLabel: "น้ำหนัก FX: 5%",
      },
      macro: {
        name: "Macro / นโยบาย",
        tooltip: "ดอกเบี้ย เงินเฟ้อ การจ้างงาน และการเติบโตทางเศรษฐกิจ กำหนดแนวโน้มใหญ่ใต้ความผันผวนรายวัน",
        weightLabel: (w: string) => `น้ำหนัก: ${w}/10`,
      },
      risk: {
        name: "ความเสี่ยง / VIXY",
        tooltip: "AUD เป็น 'risk currency' -- นักลงทุนขายเพื่อความปลอดภัยเมื่อตลาดผันผวน",
        weightLabel: (w: string) => `น้ำหนัก: ${w}/7`,
      },
    },
  },
} as const;

export default async function Hero({ data, locale }: { data: DashboardData; locale: Locale }) {
  const eventRisk = await getEventRisk();
  const confidence = await getConfidence(data, locale);
  const t = STR[locale];

  const referenceRate = data.latestPrice ? Number(data.latestPrice.rate) : null;

  // Top-level score per factor, with the same name/tooltip/weight used on
  // the full /score-breakdown page -- just without that page's nested
  // sub-factor detail, which is one click away via the link below.
  const scoreFactors: { name: string; tooltip: string; weightLabel: string; score: number | null }[] = [
    {
      name: t.factors.priceMomentum.name,
      tooltip: t.factors.priceMomentum.tooltip,
      weightLabel: t.factors.priceMomentum.weightLabel,
      score: data.priceMomentumScore,
    },
    {
      name: t.factors.crossCurrency.name,
      tooltip: t.factors.crossCurrency.tooltip,
      weightLabel: t.factors.crossCurrency.weightLabel,
      score: data.crossCurrencyScore,
    },
    {
      name: t.factors.relativeMarket.name,
      tooltip: t.factors.relativeMarket.tooltip,
      weightLabel: t.factors.relativeMarket.weightLabel(data.relativeMarketEffectiveWeight.toFixed(1)),
      score: data.relativeMarketScore,
    },
    {
      name: t.factors.commodity.name,
      tooltip: t.factors.commodity.tooltip,
      weightLabel: t.factors.commodity.weightLabel(data.commodityEffectiveFxWeight.toFixed(1)),
      score: data.commodityScore,
    },
    {
      name: t.factors.meanReversion.name,
      tooltip: t.factors.meanReversion.tooltip,
      weightLabel: t.factors.meanReversion.weightLabel,
      score: data.meanReversionScore,
    },
    {
      name: t.factors.macro.name,
      tooltip: t.factors.macro.tooltip,
      weightLabel: t.factors.macro.weightLabel(data.macroEffectiveFxWeight.toFixed(1)),
      score: data.macroScore,
    },
    {
      name: t.factors.risk.name,
      tooltip: t.factors.risk.tooltip,
      weightLabel: t.factors.risk.weightLabel(data.riskEffectiveWeight.toFixed(1)),
      score: data.riskScore,
    },
  ];

  // Track Record's own numbers for each horizon/version, reused here so
  // the line under each prediction states the model's actual measured
  // performance instead of a static "not tested yet" -- the same
  // honesty rule the backtest page follows for its badges.
  const evaluation = await getEvaluationSummary();

  const forecasts =
    data.coreFxScore !== null
      ? FORECAST_HORIZONS.map((horizon) => {
          const forecast = buildForecast(horizon, data.coreFxScore!, referenceRate);
          return {
            horizon,
            forecast,
            trackRecord: evaluation.groups.find(
              (g) => g.horizon === horizon && g.forecastVersion === FORECAST_VERSION,
            ),
            priceRange:
              referenceRate !== null
                ? {
                    low: referenceRate * (1 + forecast.predictedRangeLowPct / 100),
                    high: referenceRate * (1 + forecast.predictedRangeHighPct / 100),
                  }
                : null,
          };
        })
      : [];

  // Every horizon's direction comes from the same Core FX Score threshold
  // (>=15 BULLISH, <=-15 BEARISH) -- only the move-size scale differs by
  // horizon, not the directional call itself. Spelled out here so a score
  // sitting inside that band (as most quiet days do) doesn't read as a
  // bug when all three show NEUTRAL together.
  const allNeutral =
    forecasts.length > 0 && forecasts.every((f) => f.forecast.predictedDirection === "NEUTRAL");

  // Reasons to treat any of the above with extra care -- pulled from
  // signals already computed elsewhere on this page (Confidence, Event
  // Risk, Model Coverage, market hours), never invented for this panel.
  const cautionNotes: string[] = [];
  if (eventRisk.level !== "NONE" && eventRisk.event && eventRisk.hoursUntil !== null) {
    cautionNotes.push(
      t.eventRiskAround(eventRisk.event.eventName, eventRisk.event.currency, formatHoursUntil(eventRisk.hoursUntil, locale)),
    );
  }
  if (confidence.level !== "HIGH") {
    cautionNotes.push(t.confidenceCaution(tLabel(confidence.level, locale)));
  }
  if (data.availableCoreWeight < 100) {
    cautionNotes.push(t.coverageCaution(data.availableCoreWeight.toFixed(1)));
  }
  if (data.latestPriceFreshness.status === "MARKET_CLOSED") {
    cautionNotes.push(t.marketClosedCaution);
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* RATE */}
        <div className="md:border-r border-stone-200 dark:border-stone-800 md:pr-8">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest">
              {t.spot}
            </p>

            {data.latestPrice && (
              <StatusBadge
                label={freshnessLabel(data.latestPriceFreshness.status, locale)}
                tone={freshnessTone(data.latestPriceFreshness.status)}
              />
            )}
          </div>

          <Figure
            value={data.latestPrice ? Number(data.latestPrice.rate).toFixed(4) : null}
            className="block mt-2 text-4xl sm:text-5xl font-semibold tracking-tight"
          />

          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-4 text-sm">
            <span className="inline-flex items-baseline gap-1">
              1H
              <Figure
                value={data.change1H !== null ? `${data.change1H >= 0 ? "+" : ""}${data.change1H.toFixed(2)}%` : null}
                className={changeColor(data.change1H)}
              />
            </span>

            <span className="inline-flex items-baseline gap-1">
              4H
              <Figure
                value={data.change4H !== null ? `${data.change4H >= 0 ? "+" : ""}${data.change4H.toFixed(2)}%` : null}
                className={changeColor(data.change4H)}
              />
            </span>

            <span className="inline-flex items-baseline gap-1 text-stone-600 dark:text-stone-400">
              {t.range}
              <Figure
                value={
                  data.intradayLow !== null && data.intradayHigh !== null
                    ? `${data.intradayLow.toFixed(4)} - ${data.intradayHigh.toFixed(4)}`
                    : null
                }
              />
            </span>
          </div>

          {data.latestPrice && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-3">
              {t.updated(
                new Date(data.latestPrice.market_timestamp).toLocaleString("en-GB", {
                  timeZone: "Asia/Bangkok",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }),
                data.latestPrice.source ?? "",
              )}
            </p>
          )}

          {/* DATA HEALTH -- three small dots, one per core feed, instead of
              a narrated "X/3 fresh" sentence. */}
          <div
            className="flex items-center gap-1.5 mt-1.5"
            aria-label={`${locale === "th" ? "สถานะฟีดหลัก" : "Core feed status"}: ${coreFeeds(data, locale)
              .map((f) => `${f.label} ${f.status.toLowerCase().replace("_", " ")}`)
              .join(", ")}`}
          >
            {coreFeeds(data, locale).map((f) => (
              <span
                key={f.label}
                title={`${f.label}: ${f.status}`}
                className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${feedDotColor(f.status)}`}
              />
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest inline-flex items-center">
              {t.forecast}
              <InfoTip text={t.forecastTooltip} />
            </p>

            {forecasts.length > 0 ? (
              <>
                {allNeutral && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                    {t.allNeutral(data.coreFxScore!)}
                  </p>
                )}

                <div className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
                  {forecasts.map(({ horizon, forecast, trackRecord, priceRange }) => (
                    <div key={horizon} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold text-stone-500 dark:text-stone-500 shrink-0">
                          {horizon}
                        </span>
                        <p className={`text-lg font-semibold ${forecastDirectionColor(forecast.predictedDirection)}`}>
                          {tLabel(forecast.predictedDirection, locale)}
                        </p>
                        <StatusBadge label={tLabel("Uncalibrated", locale)} tone="amber" />
                        <span className="text-xs text-stone-600 dark:text-stone-400 ml-auto">
                          {forecast.predictedMovePct >= 0 ? "+" : ""}
                          {forecast.predictedMovePct.toFixed(2)}% ({forecast.predictedRangeLowPct.toFixed(2)}% to{" "}
                          {forecast.predictedRangeHighPct.toFixed(2)}%)
                        </span>
                      </div>

                      {priceRange && (
                        <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5">
                          {t.priceRange(priceRange.low.toFixed(4), priceRange.high.toFixed(4))}
                        </p>
                      )}

                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                        {trackRecord && !trackRecord.insufficientData ? (
                          t.directionCorrect(
                            (trackRecord.model.directionalAccuracy! * 100).toFixed(1),
                            trackRecord.sampleSize,
                            (trackRecord.baselineNoChange.directionalAccuracy! * 100).toFixed(1),
                          )
                        ) : (
                          t.notEnough(trackRecord ? ` (${trackRecord.sampleSize}/${trackRecord.minSampleSize})` : "")
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {cautionNotes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                      {t.caution}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {cautionNotes.map((note, i) => (
                        <li key={i} className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                {t.noForecast}
              </p>
            )}
          </div>
        </div>

        {/* CORE FX SCORE */}
        <div>
          <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest inline-flex items-center">
            {t.coreFxScore}
            <InfoTip text={t.coreFxScoreTooltip} />
          </p>

          <div className="flex flex-wrap items-baseline gap-3 mt-2">
            <Figure
              value={data.coreFxScore !== null ? String(data.coreFxScore) : null}
              className={`text-4xl sm:text-5xl font-semibold tracking-tight ${scoreTextColor(data.coreFxScore)}`}
            />

            <p className="text-lg font-semibold text-stone-700 dark:text-stone-300">{tLabel(data.coreBias, locale)}</p>
          </div>

          <div className="mt-2 inline-flex items-center">
            <StatusBadge label={`${t.confidence}: ${tLabel(confidence.level, locale)}`} tone={confidenceTone(confidence.level)} />
            <InfoTip text={confidence.reasons.join(". ") + "."} />
          </div>

          <ScoreGauge score={data.coreFxScore} />

          {eventRisk.level !== "NONE" && eventRisk.event && eventRisk.hoursUntil !== null && (
            <div
              className={`mt-4 rounded-md px-3 py-2 text-xs leading-relaxed ${
                eventRisk.level === "HIGH"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {t.eventRisk(
                tLabel(eventRisk.level, locale),
                eventRisk.event.eventName,
                eventRisk.event.currency,
                formatHoursUntil(eventRisk.hoursUntil, locale),
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-600 dark:text-stone-400 inline-flex items-center">
                {t.modelCoverage}
                <InfoTip text={t.modelCoverageTooltip} />
              </p>
              <p className="text-lg font-semibold font-mono tabular-nums">
                {data.availableCoreWeight.toFixed(1)}/100
              </p>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              {t.modelCoverageLine1}
            </p>

            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              {t.modelCoverageLine2}
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-400">{t.factorsHeading}</p>

            <div className="mt-1">
              {scoreFactors.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between gap-3 py-3 border-b border-stone-200 dark:border-stone-800 last:border-b-0"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate">{f.name}</span>
                    <InfoTip text={f.tooltip} />
                  </span>

                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-stone-600 hidden sm:inline">{f.weightLabel}</span>
                    <Figure value={formatFactorScore(f.score)} className={`text-base font-semibold ${factorScoreColor(f.score)}`} />
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/score-breakdown"
              className="mt-3 inline-block text-xs font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2"
            >
              {t.viewBreakdown}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
