import Link from "next/link";
import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import RangeChart from "@/components/v2/RangeChart";
import WatchlistRow from "@/components/v2/WatchlistRow";
import { getLocale } from "@/lib/i18n-server";
import { tLabel } from "@/lib/i18n";
import { getDashboardData } from "@/lib/dashboard-data";
import { getTechnicalOutlook } from "@/lib/technical-outlook-data";
import { getDecisionSnapshot } from "@/lib/decision-snapshot-data";
import { getAlerts } from "@/lib/alerts-data";
import { getRelatedMarkets } from "@/lib/watchlist-data";
import { getEconomicConsensus } from "@/lib/economic-consensus-data";
import { computeContributions, rawFactorsFromDashboard, type FactorKey } from "@/lib/score-factors";
import type { ChipTone } from "@/components/v2/BadgeChip";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    rate: "AUD/THB",
    ratePair: null,
    live: "LIVE",
    updated: (time: string) => `Updated ${time} (Bangkok) via TwelveData`,
    high: "High",
    low: "Low",
    today: "Today's Range",
    fxScore: "FX Score",
    confidence: "Confidence",
    scoreDetails: "Score details",
    outlookToday: "Today's Outlook",
    outlookDesc: (label: string) => `Signals are ${label.toLowerCase()} right now -- no clear direction yet, waiting for the numbers to firm up.`,
    breakoutUp: "If it breaks above",
    breakoutDown: "If it breaks below",
    postfund: "Postfund",
    prefund: "Prefund",
    postfundHint: "benefits from a weaker THB",
    prefundHint: "reduces exposure to a weaker AUD",
    priceTechnical: "Price & Technical",
    change1H: "1H change",
    change4H: "4H change",
    swingRange: (days: number) => `${days}D Range`,
    todayRange: "Today's Range",
    technicalLevels: "Technical Levels",
    technicalSignals: "Technical Signals",
    trendShort: "Short-term trend",
    aboveSma: (n: number) => `Above SMA(${n})`,
    belowSma: (n: number) => `Below SMA(${n})`,
    smaCrossUp: (s: number, l: number) => `SMA(${s}) > SMA(${l})`,
    smaCrossDown: (s: number, l: number) => `SMA(${s}) < SMA(${l})`,
    forecast: "Forecast",
    directionalAccuracy: (pct: number, n: number) => `${pct.toFixed(1)}% directional accuracy from ${n} runs`,
    vsBaseline: (pct: number) => `(vs. baseline ${pct.toFixed(1)}%)`,
    notEnoughTrack: "Not enough resolved forecasts yet to score accuracy.",
    scoreBreakdown: "Score Breakdown",
    seeAll: "See full breakdown",
    upcoming: "Upcoming Events",
    noUpcoming: "No upcoming MEDIUM/HIGH-impact AUD/USD/THB events this week.",
    forecastLabel: "Forecast",
    previousLabel: "Previous",
    relatedMarkets: "Related Markets",
    caution: "Caution",
  },
  th: {
    rate: "AUD/THB",
    ratePair: "ออสเตรเลียดอลลาร์ / บาทไทย",
    live: "LIVE",
    updated: (time: string) => `อัปเดต ${time} (เวลาไทย) จาก TwelveData`,
    high: "สูงสุด",
    low: "ต่ำสุด",
    today: "ช่วงราคาวันนี้",
    fxScore: "FX Score",
    confidence: "ความมั่นใจ",
    scoreDetails: "ดูรายละเอียดคะแนน",
    outlookToday: "มุมมองวันนี้",
    outlookDesc: (label: string) => `สัญญาณตอนนี้ยังผสมกันอยู่ในระดับ${label} -- ยังไม่มีทิศทางชัดเจน รอตัวเลขที่แน่นกว่านี้`,
    breakoutUp: "ถ้าทะลุ",
    breakoutDown: "ถ้าหลุด",
    postfund: "Postfund",
    prefund: "Prefund",
    postfundHint: "ได้ประโยชน์หากบาทอ่อนค่า",
    prefundHint: "ลดความเสี่ยงหากออสเตรเลียดอลลาร์อ่อนค่า",
    priceTechnical: "ราคา & เทคนิค",
    change1H: "เปลี่ยนแปลง 1H",
    change4H: "เปลี่ยนแปลง 4H",
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    todayRange: "ช่วงราคาวันนี้",
    technicalLevels: "แนวรับ-แนวต้าน (Technical Levels)",
    technicalSignals: "สัญญาณทางเทคนิค",
    trendShort: "แนวโน้มระยะสั้น",
    aboveSma: (n: number) => `เหนือ SMA(${n})`,
    belowSma: (n: number) => `ใต้ SMA(${n})`,
    smaCrossUp: (s: number, l: number) => `SMA(${s}) > SMA(${l})`,
    smaCrossDown: (s: number, l: number) => `SMA(${s}) < SMA(${l})`,
    forecast: "คาดการณ์ราคา",
    directionalAccuracy: (pct: number, n: number) => `ความแม่นยำทิศทาง ${pct.toFixed(1)}% จาก ${n} ครั้ง`,
    vsBaseline: (pct: number) => `(เทียบกับ baseline ${pct.toFixed(1)}%)`,
    notEnoughTrack: "ข้อมูลผลลัพธ์ยังไม่พอสำหรับวัดความแม่นยำ",
    scoreBreakdown: "ปัจจัยขับเคลื่อน (Score Breakdown)",
    seeAll: "ดูรายละเอียดทั้งหมด",
    upcoming: "ข่าว / เหตุการณ์สำคัญ (Upcoming Events)",
    noUpcoming: "สัปดาห์นี้ไม่มีข่าวผลกระทบปานกลาง/สูงของ AUD/USD/THB",
    forecastLabel: "คาดการณ์",
    previousLabel: "ครั้งก่อน",
    relatedMarkets: "ภาพรวมตลาดที่เกี่ยวข้อง",
    caution: "ข้อควรระวัง",
  },
} as const;

const FACTOR_LABELS: Record<FactorKey, { en: string; th: string }> = {
  priceMomentum: { en: "Price / Momentum", th: "ราคา / โมเมนตัม" },
  crossCurrency: { en: "Cross Currency", th: "ค่าเงินคู่อื่น" },
  relativeMarket: { en: "Relative Market", th: "ตลาดเปรียบเทียบ" },
  commodity: { en: "Commodity", th: "สินค้าโภคภัณฑ์" },
  meanReversion: { en: "Mean Reversion", th: "การย้อนกลับค่าเฉลี่ย" },
  macro: { en: "Macro / Policy", th: "มหภาค / นโยบาย" },
  risk: { en: "Risk / VIXY", th: "ความเสี่ยง / VIXY" },
};

// Bar width scaled against the largest nominal factor weight (Price/
// Momentum, 35) -- so a factor at its own maximum score fills close to
// the full bar, not an arbitrary fixed scale.
const MAX_FACTOR_WEIGHT = 35;

function impactTone(impact: "HIGH" | "MEDIUM"): ChipTone {
  return impact === "HIGH" ? "red" : "amber";
}

function biasTone(direction: string): ChipTone {
  if (direction === "POSTFUND" || direction === "BULLISH") return "emerald";
  if (direction === "PREFUND" || direction === "BEARISH") return "red";
  return "slate";
}

function biasTextClass(direction: string): string {
  const tone = biasTone(direction);
  if (tone === "emerald") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "red") return "text-red-600 dark:text-red-400";
  return "text-v2-muted";
}

function DirectionArrow({ direction }: { direction: string }) {
  const symbol = direction === "BULLISH" ? "↑" : direction === "BEARISH" ? "↓" : "→";
  return <span className={`text-lg leading-none ${biasTextClass(direction)}`}>{symbol}</span>;
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  const symbol = trend === "up" ? "↑" : trend === "down" ? "↓" : "—";
  const cls = trend === "up" ? "text-emerald-600 dark:text-emerald-400" : trend === "down" ? "text-red-600 dark:text-red-400" : "text-v2-muted";
  return <span className={`text-sm leading-none ${cls}`}>{symbol}</span>;
}

function changeColorClass(pct: number | null): string {
  if (pct === null) return "text-v2-muted";
  if (pct > 0) return "text-emerald-600 dark:text-emerald-400";
  if (pct < 0) return "text-red-600 dark:text-red-400";
  return "text-v2-muted";
}

function formatEventDate(isoDate: string, locale: "en" | "th"): string {
  return new Date(isoDate).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = STR[locale];

  const data = await getDashboardData();
  const [technicalOutlook, decisionSnapshot, alerts, relatedMarkets, consensus] = await Promise.all([
    getTechnicalOutlook(locale, data),
    getDecisionSnapshot(data, locale),
    getAlerts(data, locale),
    getRelatedMarkets(data),
    getEconomicConsensus(),
  ]);

  const upcoming = consensus.events.filter((e) => e.actualValue === null).sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const rangeSeries = technicalOutlook.priceSeries.map((p) => ({ date: p.date, close: p.close }));

  const bars = technicalOutlook.priceSeries;
  const dailyChangePct =
    bars.length >= 2 && bars[bars.length - 2].close !== 0
      ? ((bars[bars.length - 1].close - bars[bars.length - 2].close) / bars[bars.length - 2].close) * 100
      : null;

  const updatedTime = data.latestPrice
    ? new Date(data.latestPrice.market_timestamp).toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      })
    : null;

  const gaugePct = data.coreFxScore !== null ? ((data.coreFxScore + 100) / 200) * 100 : 50;

  const { factors, availableWeight } = computeContributions(rawFactorsFromDashboard(data));

  const smaTrend: "up" | "down" | "flat" =
    technicalOutlook.smaShortValue === null || technicalOutlook.currentRate === null
      ? "flat"
      : technicalOutlook.currentRate >= technicalOutlook.smaShortValue
        ? "up"
        : "down";

  const rsiTrend: "up" | "down" | "flat" =
    technicalOutlook.rsiValue === null ? "flat" : technicalOutlook.rsiValue >= 60 ? "up" : technicalOutlook.rsiValue <= 40 ? "down" : "flat";

  const crossTrend: "up" | "down" | "flat" =
    technicalOutlook.smaShortValue === null || technicalOutlook.smaLongValue === null
      ? "flat"
      : technicalOutlook.smaShortValue >= technicalOutlook.smaLongValue
        ? "up"
        : "down";

  return (
    <div className="space-y-6">
      {/* Row 1: AUD/THB | FX Score | Today's Outlook */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{t.rate}</p>
              {t.ratePair && <p className="text-[11px] text-v2-muted">{t.ratePair}</p>}
            </div>
            <BadgeChip label={t.live} tone="emerald" dot />
          </div>
          <p className="font-mono mt-1 text-3xl font-semibold text-v2-foreground">
            {data.latestPrice ? Number(data.latestPrice.rate).toFixed(4) : "--"}
          </p>
          {data.change1H !== null && data.latestPrice && (
            <p className={`text-sm mt-1 ${changeColorClass(data.change1H)}`}>
              {data.change1H >= 0 ? "+" : ""}
              {((data.change1H * Number(data.latestPrice.rate)) / 100).toFixed(4)} ({data.change1H >= 0 ? "+" : ""}
              {data.change1H.toFixed(2)}%, 1H)
            </p>
          )}
          {updatedTime && <p className="text-[11px] text-v2-muted mt-1">{t.updated(updatedTime)}</p>}

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-v2-border text-xs text-v2-muted">
            <div>
              <p>{t.high}</p>
              <p className="font-mono text-v2-foreground">{data.intradayHigh?.toFixed(4) ?? "--"}</p>
            </div>
            <div>
              <p>{t.low}</p>
              <p className="font-mono text-v2-foreground">{data.intradayLow?.toFixed(4) ?? "--"}</p>
            </div>
            <div>
              <p>{t.today}</p>
              <p className={`font-mono ${changeColorClass(dailyChangePct)}`}>
                {dailyChangePct !== null ? `${dailyChangePct >= 0 ? "+" : ""}${dailyChangePct.toFixed(2)}%` : "--"}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{t.fxScore}</p>
          </div>
          <p
            className={`font-mono mt-1 text-4xl font-bold ${
              data.coreFxScore === null
                ? "text-v2-foreground"
                : data.coreFxScore >= 15
                  ? "text-emerald-600 dark:text-emerald-400"
                  : data.coreFxScore <= -15
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {data.coreFxScore !== null ? `${data.coreFxScore > 0 ? "+" : ""}${data.coreFxScore}` : "--"}
            <span className="text-base font-medium text-v2-muted ml-2">{tLabel(data.coreBias, locale)}</span>
          </p>

          <div className="mt-4">
            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-400 via-slate-200 to-emerald-400 dark:via-slate-700">
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white border-2 border-slate-500 dark:border-slate-300 shadow"
                style={{ left: `${gaugePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-v2-muted mt-1">
              <span>-100</span>
              <span>0</span>
              <span>+100</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-v2-border flex items-center justify-between gap-2">
            <BadgeChip
              label={`${t.confidence}: ${tLabel(decisionSnapshot.confidenceLevel, locale)}`}
              tone={decisionSnapshot.confidenceLevel === "HIGH" ? "emerald" : decisionSnapshot.confidenceLevel === "MEDIUM" ? "amber" : "red"}
            />
            <Link href="/analysis" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
              {t.scoreDetails} &rarr;
            </Link>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{t.outlookToday}</p>
          <p className={`text-2xl font-bold mt-1 ${biasTextClass(technicalOutlook.actionBias.direction)}`}>
            {technicalOutlook.actionBias.label}
          </p>
          <p className="text-xs text-v2-muted mt-2 leading-relaxed">{technicalOutlook.actionBias.note}</p>

          {technicalOutlook.pivots && (
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-v2-border">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-2.5">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  {t.breakoutUp} {technicalOutlook.pivots.r1.toFixed(4)}
                </p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t.postfund}</p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70">{t.postfundHint}</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5">
                <p className="text-[11px] text-red-700 dark:text-red-400">
                  {t.breakoutDown} {technicalOutlook.pivots.s1.toFixed(4)}
                </p>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t.prefund}</p>
                <p className="text-[10px] text-red-600/80 dark:text-red-400/70">{t.prefundHint}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Price chart | Technical Levels + Signals */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card title={t.priceTechnical}>
            <RangeChart
              series={rangeSeries}
              locale={locale}
              pivots={technicalOutlook.pivots}
              currentRate={technicalOutlook.currentRate}
            />
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-v2-border text-xs">
              <div>
                <p className="text-v2-muted">{t.change1H}</p>
                <p className={`font-mono ${changeColorClass(data.change1H)}`}>
                  {data.change1H !== null ? `${data.change1H >= 0 ? "+" : ""}${data.change1H.toFixed(2)}%` : "--"}
                </p>
              </div>
              <div>
                <p className="text-v2-muted">{t.change4H}</p>
                <p className={`font-mono ${changeColorClass(data.change4H)}`}>
                  {data.change4H !== null ? `${data.change4H >= 0 ? "+" : ""}${data.change4H.toFixed(2)}%` : "--"}
                </p>
              </div>
              <div>
                <p className="text-v2-muted">{t.swingRange(technicalOutlook.swingLookbackDays)}</p>
                <p className="font-mono text-v2-foreground">
                  {technicalOutlook.swingLow !== null && technicalOutlook.swingHigh !== null
                    ? `${technicalOutlook.swingLow.toFixed(4)} - ${technicalOutlook.swingHigh.toFixed(4)}`
                    : "--"}
                </p>
              </div>
              <div>
                <p className="text-v2-muted">{t.todayRange}</p>
                <p className="font-mono text-v2-foreground">
                  {data.intradayLow !== null && data.intradayHigh !== null
                    ? `${data.intradayLow.toFixed(4)} - ${data.intradayHigh.toFixed(4)}`
                    : "--"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title={t.technicalLevels}>
            {technicalOutlook.pivots ? (
              <div className="space-y-2 text-sm">
                {[
                  { label: "R2", value: technicalOutlook.pivots.r2, cls: "text-red-600 dark:text-red-400" },
                  { label: "R1", value: technicalOutlook.pivots.r1, cls: "text-red-600 dark:text-red-400" },
                  { label: "Pivot", value: technicalOutlook.pivots.pivot, cls: "text-v2-foreground" },
                  { label: "S1", value: technicalOutlook.pivots.s1, cls: "text-emerald-600 dark:text-emerald-400" },
                  { label: "S2", value: technicalOutlook.pivots.s2, cls: "text-emerald-600 dark:text-emerald-400" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-v2-muted">{row.label}</span>
                    <span className={`font-mono font-semibold ${row.cls}`}>{row.value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-v2-muted">{technicalOutlook.disclaimer}</p>
            )}
          </Card>

          <Card title={t.technicalSignals}>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-v2-muted">
                  {technicalOutlook.smaShortPeriod !== null ? `SMA(${technicalOutlook.smaShortPeriod})` : "SMA"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-v2-foreground">{technicalOutlook.smaShortValue?.toFixed(4) ?? "--"}</span>
                  <TrendArrow trend={smaTrend} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-v2-muted">
                  {technicalOutlook.rsiPeriod !== null ? `RSI(${technicalOutlook.rsiPeriod})` : "RSI"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-v2-foreground">{technicalOutlook.rsiValue?.toFixed(1) ?? "--"}</span>
                  <TrendArrow trend={rsiTrend} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-v2-muted">{t.trendShort}</span>
                <span className="flex items-center gap-2">
                  <span className="text-v2-foreground">
                    {technicalOutlook.smaShortPeriod !== null
                      ? smaTrend === "up"
                        ? t.aboveSma(technicalOutlook.smaShortPeriod)
                        : t.belowSma(technicalOutlook.smaShortPeriod)
                      : "--"}
                  </span>
                  <TrendArrow trend={smaTrend} />
                </span>
              </div>
              {technicalOutlook.smaLongPeriod !== null && technicalOutlook.smaShortPeriod !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-v2-muted">
                    {crossTrend === "up"
                      ? t.smaCrossUp(technicalOutlook.smaShortPeriod, technicalOutlook.smaLongPeriod)
                      : t.smaCrossDown(technicalOutlook.smaShortPeriod, technicalOutlook.smaLongPeriod)}
                  </span>
                  <TrendArrow trend={crossTrend} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Row 3: Forecast | Score Breakdown */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card title={t.forecast}>
            <div className="grid sm:grid-cols-3 gap-4">
              {technicalOutlook.forecasts.map((f) => (
                <div key={f.horizon} className="rounded-lg border border-v2-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-v2-muted">{f.horizon}</p>
                    <DirectionArrow direction={f.direction} />
                  </div>

                  <p className={`text-base font-semibold mt-1 ${biasTextClass(f.direction)}`}>{tLabel(f.direction, locale)}</p>

                  {f.priceRange && (
                    <p className="font-mono text-sm text-v2-foreground mt-2">
                      {f.priceRange.low.toFixed(4)} - {f.priceRange.high.toFixed(4)}
                    </p>
                  )}
                  <p className="text-xs text-v2-muted font-mono">
                    ({f.predictedRangeLowPct >= 0 ? "+" : ""}
                    {f.predictedRangeLowPct.toFixed(2)}% | {f.predictedRangeHighPct >= 0 ? "+" : ""}
                    {f.predictedRangeHighPct.toFixed(2)}%)
                  </p>

                  <div className="mt-3 pt-3 border-t border-v2-border">
                    {f.trackRecord && !f.trackRecord.insufficientData && f.trackRecord.directionalAccuracyPct !== null ? (
                      <p className="text-xs text-v2-muted leading-relaxed">
                        {t.directionalAccuracy(f.trackRecord.directionalAccuracyPct, f.trackRecord.sampleSize)}
                        {f.trackRecord.baselineAccuracyPct !== null && (
                          <>
                            <br />
                            {t.vsBaseline(f.trackRecord.baselineAccuracyPct)}
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-v2-muted">{t.notEnoughTrack}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={t.scoreBreakdown}>
            <div className="space-y-3">
              {factors.map((f) => {
                const label = FACTOR_LABELS[f.key][locale];
                const widthPct = f.contribution !== null ? Math.min(100, (Math.abs(f.contribution) / MAX_FACTOR_WEIGHT) * 100) : 0;
                const barColor = f.contribution === null || f.contribution === 0 ? "bg-slate-300 dark:bg-slate-600" : f.contribution > 0 ? "bg-emerald-500" : "bg-red-500";
                return (
                  <div key={f.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-v2-muted">
                        {label} ({f.weight.toFixed(0)}%)
                      </span>
                      <span className={`font-mono font-medium ${changeColorClass(f.contribution)}`}>
                        {f.contribution !== null ? `${f.contribution > 0 ? "+" : ""}${f.contribution}` : "N/A"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/analysis" className="inline-block mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              {t.seeAll} &rarr;
            </Link>
          </Card>
        </div>
      </div>

      {/* Row 4: Upcoming Events | Related Markets */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card title={t.upcoming} padded={false}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-v2-muted p-5">{t.noUpcoming}</p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                {upcoming.map((e, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-5 py-3 border-b border-v2-border last:border-b-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-v2-muted">
                        {e.currency}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-v2-foreground">{e.eventName}</p>
                        <p className="text-xs text-v2-muted">{formatEventDate(e.eventDate, locale)}</p>
                        {(e.forecastValue !== null || e.previousValue !== null) && (
                          <p className="text-xs text-v2-muted font-mono mt-0.5">
                            {t.forecastLabel} {e.forecastValue ?? "--"} &middot; {t.previousLabel} {e.previousValue ?? "--"}
                          </p>
                        )}
                      </div>
                    </div>
                    <BadgeChip label={e.impact} tone={impactTone(e.impact)} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={t.relatedMarkets}>
            <div>
              {relatedMarkets.map((item) => (
                <WatchlistRow key={item.label} item={item} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
            <span>&#9888;</span> {t.caution}
          </p>
          <ul className="space-y-1 mt-2">
            {alerts.map((a, i) => (
              <li key={i} className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">{a.label}:</span> {a.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
