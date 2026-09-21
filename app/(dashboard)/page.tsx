import Link from "next/link";
import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import RangeChart from "@/components/v2/RangeChart";
import WatchlistRow from "@/components/v2/WatchlistRow";
import InfoTooltip from "@/components/v2/InfoTooltip";
import CautionToast from "@/components/v2/CautionToast";
import ScoreGauge from "@/components/v2/ScoreGauge";
import {
  IconExchange,
  IconGauge,
  IconCompass,
  IconCandles,
  IconLayers,
  IconPulse,
  IconTarget,
  IconBars,
  IconCalendar,
  IconGlobe,
} from "@/components/v2/Icon";
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

const ICON_CLASS = "h-3.5 w-3.5";

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
    upcoming: "Today's Events",
    noUpcoming: "No MEDIUM/HIGH-impact AUD/USD/THB events scheduled today.",
    forecastLabel: "Forecast",
    previousLabel: "Previous",
    relatedMarkets: "Related Markets",
    caution: "Caution",
    tip: {
      rate: "The latest real AUD/THB rate from TwelveData, plus today's intraday high/low and % change vs. the last completed day's close.",
      fxScore: "This app's own composite score (-100..+100) blending 7 weighted real signals (price momentum, cross-currency, relative market, commodity, mean reversion, macro/policy, risk) into one number.",
      outlookToday: "A plain-language read of the Core FX Score's current bias, plus the real pivot levels (R1/S1) that would need to break for that bias to strengthen.",
      priceTechnical: "Daily-bar price history for AUD/THB with classic pivot support/resistance levels computed from the last completed day.",
      technicalLevels: "Classic floor-trader pivot points (Pivot, R1-R2, S1-S2) computed from the most recently completed day's high/low/close.",
      technicalSignals: "Simple moving averages and RSI computed from this app's own real daily price history -- periods shrink automatically while less history exists.",
      forecast: "This app's own rule-based price forecast per horizon (still UNCALIBRATED), shown with its real directional-accuracy track record vs. a naive baseline.",
      scoreBreakdown: "How each of the 7 weighted factors contributed to the Core FX Score above -- contributions sum to the total score exactly.",
      upcoming: "MEDIUM/HIGH-impact AUD/USD/THB economic events scheduled for today, with their forecast and previous values.",
      relatedMarkets: "Real prices and % change for the pairs, commodities and yields this app's Core FX Score is built from.",
    },
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
    upcoming: "ข่าว / เหตุการณ์วันนี้",
    noUpcoming: "วันนี้ไม่มีข่าวผลกระทบปานกลาง/สูงของ AUD/USD/THB",
    forecastLabel: "คาดการณ์",
    previousLabel: "ครั้งก่อน",
    relatedMarkets: "ภาพรวมตลาดที่เกี่ยวข้อง",
    caution: "ข้อควรระวัง",
    tip: {
      rate: "ราคา AUD/THB ล่าสุดจริงจาก TwelveData พร้อมสูงสุด-ต่ำสุดวันนี้ และ % เปลี่ยนแปลงเทียบราคาปิดวันก่อนหน้าที่สมบูรณ์แล้ว",
      fxScore: "คะแนนรวมของระบบนี้เอง (-100..+100) ผสม 7 ปัจจัยถ่วงน้ำหนักจริง (ราคา/โมเมนตัม, ค่าเงินคู่อื่น, ตลาดเปรียบเทียบ, สินค้าโภคภัณฑ์, การย้อนกลับค่าเฉลี่ย, มหภาค/นโยบาย, ความเสี่ยง) เป็นตัวเลขเดียว",
      outlookToday: "สรุปทิศทางปัจจุบันของ Core FX Score เป็นภาษาง่าย ๆ พร้อมระดับ pivot จริง (R1/S1) ที่ต้องทะลุเพื่อให้ทิศทางนั้นชัดเจนขึ้น",
      priceTechnical: "ราคา AUD/THB รายวันจริง พร้อมแนวรับ-แนวต้าน (pivot) แบบคลาสสิกที่คำนวณจากวันล่าสุดที่ข้อมูลสมบูรณ์แล้ว",
      technicalLevels: "จุด pivot แบบคลาสสิก (Pivot, R1-R2, S1-S2) คำนวณจากราคาสูงสุด/ต่ำสุด/ปิดของวันล่าสุดที่สมบูรณ์แล้ว",
      technicalSignals: "เส้นค่าเฉลี่ยเคลื่อนที่และ RSI คำนวณจากข้อมูลราคารายวันจริงของระบบนี้ -- ช่วงเวลาจะปรับลดอัตโนมัติขณะที่ข้อมูลย้อนหลังยังมีไม่มาก",
      forecast: "คาดการณ์ราคาตามกฎของระบบนี้เอง (ยัง UNCALIBRATED) แสดงพร้อมสถิติความแม่นยำทิศทางจริงเทียบกับ baseline",
      scoreBreakdown: "แต่ละ 7 ปัจจัยถ่วงน้ำหนักส่งผลต่อ Core FX Score ด้านบนอย่างไร -- ผลรวมของ contribution เท่ากับคะแนนรวมพอดี",
      upcoming: "ข่าวเศรษฐกิจผลกระทบปานกลาง/สูงของ AUD/USD/THB ที่มีกำหนดวันนี้ พร้อมค่าคาดการณ์และค่าครั้งก่อน",
      relatedMarkets: "ราคาจริงและ % เปลี่ยนแปลงของคู่เงิน สินค้าโภคภัณฑ์ และผลตอบแทนพันธบัตรที่ Core FX Score ของระบบนี้ใช้คำนวณ",
    },
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

function directionBarClass(direction: string): string {
  const tone = biasTone(direction);
  if (tone === "emerald") return "bg-emerald-500";
  if (tone === "red") return "bg-red-500";
  return "bg-slate-300 dark:bg-slate-600";
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

function scoreColorClass(score: number | null): string {
  if (score === null) return "text-v2-foreground";
  if (score >= 15) return "text-emerald-600 dark:text-emerald-400";
  if (score <= -15) return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

function formatEventDate(isoDate: string, locale: "en" | "th"): string {
  return new Date(isoDate).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Small tinted stat tile -- shared visual shape for the 3/4-across
// mini-stats under the AUD/THB and Price & Technical cards, instead of
// bare label/value text columns.
function StatTile({ label, value, valueClass = "text-v2-foreground" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg bg-v2-bg/70 dark:bg-slate-800/40 px-3 py-2.5">
      <p className="text-[11px] text-v2-muted">{label}</p>
      <p className={`font-mono text-sm font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
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

  // Today (Bangkok) only, per the user's request -- same bangkokDateKey
  // convention already used in lib/watchlist-data.ts for bucketing by
  // real calendar day, not a new date convention.
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayKey = `${bangkokNow.getUTCFullYear()}-${String(bangkokNow.getUTCMonth() + 1).padStart(2, "0")}-${String(bangkokNow.getUTCDate()).padStart(2, "0")}`;
  const upcoming = consensus.events
    .filter((e) => e.actualValue === null && e.eventDate === todayKey)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

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

  const { factors } = computeContributions(rawFactorsFromDashboard(data));

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
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute inset-x-0 -top-6 -z-10 flex justify-center overflow-hidden">
        <div className="h-64 w-[36rem] rounded-full bg-blue-400/10 dark:bg-blue-500/10 blur-3xl" />
      </div>

      <CautionToast alerts={alerts} locale={locale} />

      {/* Row 1: AUD/THB | FX Score | Today's Outlook */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card
          icon={<IconExchange className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.rate}
              <InfoTooltip text={t.tip.rate} />
            </span>
          }
          action={<BadgeChip label={t.live} tone="emerald" dot />}
        >
          {t.ratePair && <p className="text-[11px] text-v2-muted">{t.ratePair}</p>}
          <p className="font-mono mt-1.5 text-4xl font-bold tracking-tight text-v2-foreground">
            {data.latestPrice ? Number(data.latestPrice.rate).toFixed(4) : "--"}
          </p>
          {data.change1H !== null && data.latestPrice && (
            <p className={`text-sm mt-1 font-medium ${changeColorClass(data.change1H)}`}>
              {data.change1H >= 0 ? "+" : ""}
              {((data.change1H * Number(data.latestPrice.rate)) / 100).toFixed(4)} ({data.change1H >= 0 ? "+" : ""}
              {data.change1H.toFixed(2)}%, 1H)
            </p>
          )}
          {updatedTime && <p className="text-[11px] text-v2-muted mt-1">{t.updated(updatedTime)}</p>}

          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatTile label={t.high} value={data.intradayHigh?.toFixed(4) ?? "--"} />
            <StatTile label={t.low} value={data.intradayLow?.toFixed(4) ?? "--"} />
            <StatTile
              label={t.today}
              value={dailyChangePct !== null ? `${dailyChangePct >= 0 ? "+" : ""}${dailyChangePct.toFixed(2)}%` : "--"}
              valueClass={changeColorClass(dailyChangePct)}
            />
          </div>
        </Card>

        <Card
          icon={<IconGauge className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.fxScore}
              <InfoTooltip text={t.tip.fxScore} />
            </span>
          }
        >
          <div className="flex flex-col items-center">
            <ScoreGauge value={data.coreFxScore} size={200} />
            <p className={`font-mono -mt-1 text-4xl font-bold ${scoreColorClass(data.coreFxScore)}`}>
              {data.coreFxScore !== null ? `${data.coreFxScore > 0 ? "+" : ""}${data.coreFxScore}` : "--"}
            </p>
            <p className="text-sm text-v2-muted">{tLabel(data.coreBias, locale)}</p>
            <div className="flex items-center justify-between w-full max-w-[200px] text-[11px] text-v2-muted mt-2">
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

        <Card
          icon={<IconCompass className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.outlookToday}
              <InfoTooltip text={t.tip.outlookToday} />
            </span>
          }
        >
          <p className={`text-2xl font-bold ${biasTextClass(technicalOutlook.actionBias.direction)}`}>
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
      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          icon={<IconCandles className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.priceTechnical}
              <InfoTooltip text={t.tip.priceTechnical} />
            </span>
          }
        >
          <RangeChart
            series={rangeSeries}
            locale={locale}
            pivots={technicalOutlook.pivots}
            currentRate={technicalOutlook.currentRate}
          />
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-v2-border">
            <StatTile label={t.change1H} value={data.change1H !== null ? `${data.change1H >= 0 ? "+" : ""}${data.change1H.toFixed(2)}%` : "--"} valueClass={changeColorClass(data.change1H)} />
            <StatTile label={t.change4H} value={data.change4H !== null ? `${data.change4H >= 0 ? "+" : ""}${data.change4H.toFixed(2)}%` : "--"} valueClass={changeColorClass(data.change4H)} />
            <StatTile
              label={t.swingRange(technicalOutlook.swingLookbackDays)}
              value={
                technicalOutlook.swingLow !== null && technicalOutlook.swingHigh !== null
                  ? `${technicalOutlook.swingLow.toFixed(4)}-${technicalOutlook.swingHigh.toFixed(4)}`
                  : "--"
              }
            />
            <StatTile
              label={t.todayRange}
              value={
                data.intradayLow !== null && data.intradayHigh !== null
                  ? `${data.intradayLow.toFixed(4)}-${data.intradayHigh.toFixed(4)}`
                  : "--"
              }
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card
            icon={<IconLayers className={ICON_CLASS} />}
            title={
              <span className="flex items-center gap-1.5">
                {t.technicalLevels}
                <InfoTooltip text={t.tip.technicalLevels} />
              </span>
            }
          >
            {technicalOutlook.pivots ? (
              <div className="space-y-1.5">
                {[
                  { label: "R2", value: technicalOutlook.pivots.r2, cls: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
                  { label: "R1", value: technicalOutlook.pivots.r1, cls: "text-red-600 dark:text-red-400", bar: "bg-red-400" },
                  { label: "Pivot", value: technicalOutlook.pivots.pivot, cls: "text-v2-foreground", bar: "bg-slate-400 dark:bg-slate-500" },
                  { label: "S1", value: technicalOutlook.pivots.s1, cls: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-400" },
                  { label: "S2", value: technicalOutlook.pivots.s2, cls: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-v2-bg/70 dark:hover:bg-slate-800/40">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.bar}`} />
                    <span className="text-sm text-v2-muted flex-1">{row.label}</span>
                    <span className={`font-mono text-sm font-semibold ${row.cls}`}>{row.value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-v2-muted">{technicalOutlook.disclaimer}</p>
            )}
          </Card>

          <Card
            icon={<IconPulse className={ICON_CLASS} />}
            title={
              <span className="flex items-center gap-1.5">
                {t.technicalSignals}
                <InfoTooltip text={t.tip.technicalSignals} />
              </span>
            }
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-v2-bg/70 dark:hover:bg-slate-800/40">
                <span className="text-sm text-v2-muted">
                  {technicalOutlook.smaShortPeriod !== null ? `SMA(${technicalOutlook.smaShortPeriod})` : "SMA"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-v2-foreground">{technicalOutlook.smaShortValue?.toFixed(4) ?? "--"}</span>
                  <TrendArrow trend={smaTrend} />
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-v2-bg/70 dark:hover:bg-slate-800/40">
                <span className="text-sm text-v2-muted">
                  {technicalOutlook.rsiPeriod !== null ? `RSI(${technicalOutlook.rsiPeriod})` : "RSI"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-v2-foreground">{technicalOutlook.rsiValue?.toFixed(1) ?? "--"}</span>
                  <TrendArrow trend={rsiTrend} />
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-v2-bg/70 dark:hover:bg-slate-800/40">
                <span className="text-sm text-v2-muted">{t.trendShort}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm text-v2-foreground">
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
                <div className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-v2-bg/70 dark:hover:bg-slate-800/40">
                  <span className="text-sm text-v2-muted">
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
      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          icon={<IconTarget className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.forecast}
              <InfoTooltip text={t.tip.forecast} />
            </span>
          }
        >
          <div className="grid sm:grid-cols-3 gap-4">
            {technicalOutlook.forecasts.map((f) => (
              <div key={f.horizon} className="relative overflow-hidden rounded-xl border border-v2-border pt-5 p-4">
                <span className={`absolute inset-x-0 top-0 h-1 ${directionBarClass(f.direction)}`} />
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

        <Card
          icon={<IconBars className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.scoreBreakdown}
              <InfoTooltip text={t.tip.scoreBreakdown} />
            </span>
          }
        >
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
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={`h-2 rounded-full ${barColor} transition-[width] duration-500`} style={{ width: `${widthPct}%` }} />
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

      {/* Row 4: Today's Events | Related Markets */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          icon={<IconCalendar className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.upcoming}
              <InfoTooltip text={t.tip.upcoming} />
            </span>
          }
          padded={false}
        >
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <IconCalendar className="h-6 w-6 text-v2-muted" />
              <p className="text-sm text-v2-muted max-w-xs">{t.noUpcoming}</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {upcoming.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-5 py-3 border-b border-v2-border last:border-b-0 hover:bg-v2-bg/60 dark:hover:bg-slate-800/30">
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

        <Card
          icon={<IconGlobe className={ICON_CLASS} />}
          title={
            <span className="flex items-center gap-1.5">
              {t.relatedMarkets}
              <InfoTooltip text={t.tip.relatedMarkets} />
            </span>
          }
        >
          <div>
            {relatedMarkets.map((item) => (
              <WatchlistRow key={item.label} item={item} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
