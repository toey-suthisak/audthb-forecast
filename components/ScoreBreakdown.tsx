import type {
  DashboardData,
  YieldConfidence,
} from "@/lib/dashboard-data";
import { getMacroCompositeData } from "@/lib/macro-composite-data";
import { getTradeBalanceData } from "@/lib/trade-balance-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import InfoTip from "@/components/InfoTip";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import { tLabel, freshnessLabel, type Locale } from "@/lib/i18n";

// Every one of these returns null (never a "--" string) on a missing
// value, so every call site renders through <Figure>, which is what
// actually draws the greyed em dash -- keeping that one rule true
// everywhere a number could be absent, not just the headline figures.
function formatScore(score: number | null) {
  if (score === null) return null;
  return `${score > 0 ? "+" : ""}${score}`;
}

function formatChange(change: number | null) {
  if (change === null) return null;
  return `${change >= 0 ? "+" : ""}${change.toFixed(3)}%`;
}

function formatBps(value: number | null) {
  if (value === null) return null;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} bps`;
}

function formatPct(value: number | null, decimals = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

function formatUsd(value: number | null, decimals = 2) {
  if (value === null) return null;
  return `$${value.toFixed(decimals)}`;
}

function scoreTextColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score > 0) return "text-emerald-700 dark:text-emerald-400";
  if (score < 0) return "text-red-700 dark:text-red-400";
  return "text-stone-600 dark:text-stone-300";
}

// Every factor/sub-factor score in this card goes through this one plain
// numeral, right-aligned like an almanac's own ruled columns -- a missing
// score prints as a greyed em dash rather than a blank "--".
function SegmentScore({ score }: { score: number | null }) {
  return <Figure value={score !== null ? String(score) : null} className={`text-base font-semibold ${scoreTextColor(score)}`} />;
}

function confidenceTone(confidence: YieldConfidence | "HIGH" | "MEDIUM" | "LOW" | "MISSING"): BadgeTone {
  switch (confidence) {
    case "HIGH":
      return "emerald";
    case "MEDIUM":
    case "LOW":
      return "amber";
    case "STALE":
    case "MISSING":
      return "red";
  }
}

function freshnessTone(status: string): BadgeTone {
  if (status === "FRESH") return "emerald";
  if (status === "DELAYED") return "amber";
  if (status === "MARKET_CLOSED") return "slate";
  return "red";
}

const COUNTRY_LABEL_EN: Record<string, string> = {
  AU: "Australia",
  US: "United States",
  TH: "Thailand",
  AUS: "Australia",
  USA: "United States",
  THA: "Thailand",
};

const COUNTRY_LABEL_TH: Record<string, string> = {
  AU: "ออสเตรเลีย",
  US: "สหรัฐอเมริกา",
  TH: "ไทย",
  AUS: "ออสเตรเลีย",
  USA: "สหรัฐอเมริกา",
  THA: "ไทย",
};

const STR = {
  en: {
    tapFactor: "Tap a factor to see how it's calculated.",
    coreFxScoreTooltip:
      "One score combining 7 market and economic signals: -100 (bearish AUD) to +100 (bullish AUD). Not a price prediction.",
    priceMomentum: { name: "Price / Momentum", tooltip: "Shows what the market is doing right now, before slower news or data can catch up.", weight: "FX Weight: 35%" },
    crossCurrency: { name: "Cross Currency", tooltip: "Double-checks the price a second way, so one glitchy data feed can't fool the model.", weight: "FX Weight: 20%" },
    relativeMarket: { name: "Relative Market", tooltip: "Money flows and regional risk appetite can move AUD/THB even when nothing changes locally.", weight: (w: string) => `Weight: ${w}/15` },
    commodity: { name: "Commodity", tooltip: "Iron ore and oil prices move AUD/THB on their own, separate from currency markets.", weight: (w: string) => `Weight: ${w}/8` },
    meanReversion: { name: "Mean Reversion", tooltip: "A price that moved too far too fast today tends to snap back a little.", weight: "FX Weight: 5%" },
    macro: { name: "Macro / Policy", tooltip: "Rates, inflation, jobs and growth set the bigger trend under the day's price swings.", weight: (w: string) => `Weight: ${w}/10` },
    risk: { name: "Risk / VIXY", tooltip: "AUD is a 'risk' currency -- investors sell it for safety when markets get volatile.", weight: (w: string) => `Weight: ${w}/7` },

    priceScoreLine: (h1: string | null, raw1: string | null, h4: string | null, raw4: string | null) => (
      <>
        1H Score: <Figure value={h1} /> (raw <Figure value={raw1} />) | 4H Score: <Figure value={h4} /> (raw <Figure value={raw4} />)
      </>
    ),
    priceNote: "Momentum blends the 1H and 4H AUD/THB direct-rate change into a single score, then carries 35% of the Core FX Score -- the single heaviest factor.",
    crossChangeLine: "1H Cross Change:",
    crossRateLine: (cross: string | null, direct: string | null) => (
      <>
        Cross rate: <Figure value={cross} /> (AUD/USD × USD/THB) vs direct <Figure value={direct} />
      </>
    ),
    crossExcluded: (status: string) => `Cross excluded: ${status}`,
    crossNote: "Cross-checks the direct AUD/THB feed against AUD/USD × USD/THB computed independently -- a healthy cross agreeing with the direct move adds confidence to the same direction.",
    relativeCoverage: (cov: string) => `Coverage: ${cov}/100 (internal split: Yield 26% / CNH 15% / SGD 59%)`,
    yieldLabel: "AU-US 2Y Yield",
    yieldSnapshot: (au: string, auDate: string, us: string, usDate: string) => `AU 2Y: ${au}% (${auDate}) | US 2Y: ${us}% (${usDate})`,
    spread: "Spread:",
    weekChange: "1W Change:",
    relativeWeight: (v: string) => `Relative Weight: ${v}/26`,
    confidence: "Confidence:",
    oldestData: "Oldest data:",
    dateGap: "Date gap:",
    days: "days",
    relativeWeightSimple: (pct: number) => `Relative Weight: ${pct}%`,
    relativeNote: "USD/CNH and USD/SGD proxy broader Asian-FX risk appetite -- a rising dollar against them tends to pressure AUD/THB the same direction.",
    commodityCoverage: (cov: string) => `Coverage: ${cov}/100 (internal split: Brent 55% / Iron Ore 45% -- Gold excluded, monitor only)`,
    ironOre: "Iron Ore",
    price: "Price:",
    change24H: "24H Change:",
    weightOf: (v: string, of: number) => `Weight: ${v}/${of}`,
    ironOreNote: "Australia's largest export -- higher iron ore prices historically support AUD.",
    brentLive: "Brent Live",
    change1H: "1H Change:",
    weight5555: "Weight: 55/55",
    gold: "Gold",
    weight020: "Weight: 0/20",
    goldNote: "Tracked for a future safe-haven signal but not yet scored -- needs more history before it's trusted in the composite.",
    rangePosition: "Range Position:",
    todaysRange: "Today's range:",
    meanReversionNote: "0% = sitting at today's low, 100% = at today's high. A low range position scores bullish (room to revert up); a high one scores bearish.",
    macroCoverage: (cov: string) => `Coverage: ${cov}/100 (Policy 4 / Inflation 3 / Labour 2 / Growth 1)`,
    macroUnavailable: "Macro unavailable — excluded from FX Score",
    policy: "Policy",
    ratesLine: (rba: string | null, fed: string | null, bot: string | null) => (
      <>
        RBA <Figure value={rba} /> | Fed <Figure value={fed} /> | BOT <Figure value={bot} />
      </>
    ),
    rbaFedLine: (change: string | null, score: string | null, change2: string | null, score2: string | null) => (
      <>
        RBA-Fed 90D: <Figure value={change} /> (score <Figure value={score} />) | Fed-BOT 90D: <Figure value={change2} /> (score <Figure value={score2} />)
      </>
    ),
    inflation: "Inflation",
    coverage: (cov: string) => `Coverage: ${cov}/100`,
    compositeVsTarget: (composite: string | null, target: string) => (
      <>
        composite <Figure value={composite} /> vs {target}% target
      </>
    ),
    pressure: (pressure: string | null) => (
      <>
        {" "}
        (pressure <Figure value={pressure} />)
      </>
    ),
    labour: "Labour",
    growth: "Growth (GDP)",
    qoqGdp: "QoQ GDP",
    unavailable: (reason: string) => `unavailable (${reason})`,
    tradeBalance: "Trade Balance (Current Account)",
    macroNote: "Growth uses experimental GDP-only scoring, not yet backtested. Trade Balance is tracked but not yet scored. Each Macro sub-component fails independently -- one missing input excludes only that piece, not the whole Macro score.",
    session: "Session:",
    open: "OPEN",
    closed: "CLOSED",
    age: "Age:",
    marketClosedExcluded: "Market closed — excluded from current FX Score",
    riskNote: "VIXY (volatility ETF) is scored inversely: rising volatility usually means risk-off flows out of AUD, so a VIXY spike pushes this score bearish.",
  },
  th: {
    tapFactor: "แตะที่ปัจจัยเพื่อดูวิธีคำนวณ",
    coreFxScoreTooltip:
      "คะแนนเดียวที่รวม 7 สัญญาณตลาดและเศรษฐกิจ: -100 (ขาลง AUD) ถึง +100 (ขาขึ้น AUD) ไม่ใช่การพยากรณ์ราคา",
    priceMomentum: { name: "ราคา / โมเมนตัม", tooltip: "แสดงสิ่งที่ตลาดกำลังทำอยู่ตอนนี้ ก่อนที่ข่าวหรือข้อมูลอื่นที่ช้ากว่าจะตามทัน", weight: "น้ำหนัก FX: 35%" },
    crossCurrency: { name: "Cross Currency", tooltip: "ตรวจสอบราคาซ้ำอีกทาง เพื่อไม่ให้ฟีดข้อมูลที่ผิดพลาดหลอกโมเดลได้", weight: "น้ำหนัก FX: 20%" },
    relativeMarket: { name: "Relative Market", tooltip: "กระแสเงินทุนและความเสี่ยงในภูมิภาคสามารถขยับ AUD/THB ได้แม้ไม่มีอะไรเปลี่ยนในประเทศ", weight: (w: string) => `น้ำหนัก: ${w}/15` },
    commodity: { name: "สินค้าโภคภัณฑ์", tooltip: "ราคาแร่เหล็กและน้ำมันขยับ AUD/THB ได้เอง แยกจากตลาดค่าเงิน", weight: (w: string) => `น้ำหนัก: ${w}/8` },
    meanReversion: { name: "Mean Reversion", tooltip: "ราคาที่วิ่งไปไกลเกินไปในวันนั้นมักจะดีดกลับมาบ้าง", weight: "น้ำหนัก FX: 5%" },
    macro: { name: "Macro / นโยบาย", tooltip: "ดอกเบี้ย เงินเฟ้อ การจ้างงาน และการเติบโตทางเศรษฐกิจ กำหนดแนวโน้มใหญ่ใต้ความผันผวนรายวัน", weight: (w: string) => `น้ำหนัก: ${w}/10` },
    risk: { name: "ความเสี่ยง / VIXY", tooltip: "AUD เป็น 'risk currency' -- นักลงทุนขายเพื่อความปลอดภัยเมื่อตลาดผันผวน", weight: (w: string) => `น้ำหนัก: ${w}/7` },

    priceScoreLine: (h1: string | null, raw1: string | null, h4: string | null, raw4: string | null) => (
      <>
        คะแนน 1H: <Figure value={h1} /> (ดิบ <Figure value={raw1} />) | คะแนน 4H: <Figure value={h4} /> (ดิบ <Figure value={raw4} />)
      </>
    ),
    priceNote: "Momentum รวมการเปลี่ยนแปลงราคา AUD/THB โดยตรงของ 1H และ 4H เป็นคะแนนเดียว แล้วคิดเป็น 35% ของ Core FX Score -- ปัจจัยที่หนักที่สุด",
    crossChangeLine: "การเปลี่ยนแปลง Cross 1H:",
    crossRateLine: (cross: string | null, direct: string | null) => (
      <>
        อัตรา Cross: <Figure value={cross} /> (AUD/USD × USD/THB) เทียบกับราคาตรง <Figure value={direct} />
      </>
    ),
    crossExcluded: (status: string) => `ตัด Cross ออก: ${status}`,
    crossNote: "ตรวจสอบฟีด AUD/THB โดยตรงกับ AUD/USD × USD/THB ที่คำนวณแยกต่างหาก -- ถ้า cross สอดคล้องกับทิศทางที่ราคาตรงเคลื่อนไหว จะเพิ่มความมั่นใจในทิศทางนั้น",
    relativeCoverage: (cov: string) => `ความครบถ้วน: ${cov}/100 (แบ่งภายใน: Yield 26% / CNH 15% / SGD 59%)`,
    yieldLabel: "ผลตอบแทนพันธบัตร AU-US 2 ปี",
    yieldSnapshot: (au: string, auDate: string, us: string, usDate: string) => `AU 2 ปี: ${au}% (${auDate}) | US 2 ปี: ${us}% (${usDate})`,
    spread: "ส่วนต่าง:",
    weekChange: "เปลี่ยนแปลง 1 สัปดาห์:",
    relativeWeight: (v: string) => `น้ำหนักสัมพัทธ์: ${v}/26`,
    confidence: "ความมั่นใจ:",
    oldestData: "ข้อมูลเก่าสุด:",
    dateGap: "ช่องว่างวันที่:",
    days: "วัน",
    relativeWeightSimple: (pct: number) => `น้ำหนักสัมพัทธ์: ${pct}%`,
    relativeNote: "USD/CNH และ USD/SGD เป็นตัวแทนความเสี่ยงในตลาดเอเชียโดยรวม -- ดอลลาร์ที่แข็งค่าขึ้นเทียบกับสองสกุลนี้มักกดดัน AUD/THB ไปทิศทางเดียวกัน",
    commodityCoverage: (cov: string) => `ความครบถ้วน: ${cov}/100 (แบ่งภายใน: Brent 55% / แร่เหล็ก 45% -- ทองคำไม่รวม ติดตามเท่านั้น)`,
    ironOre: "แร่เหล็ก",
    price: "ราคา:",
    change24H: "เปลี่ยนแปลง 24 ชม.:",
    weightOf: (v: string, of: number) => `น้ำหนัก: ${v}/${of}`,
    ironOreNote: "สินค้าส่งออกอันดับหนึ่งของออสเตรเลีย -- ราคาแร่เหล็กที่สูงขึ้นมักสนับสนุน AUD ในอดีต",
    brentLive: "น้ำมันเบรนท์ (เรียลไทม์)",
    change1H: "เปลี่ยนแปลง 1 ชม.:",
    weight5555: "น้ำหนัก: 55/55",
    gold: "ทองคำ",
    weight020: "น้ำหนัก: 0/20",
    goldNote: "ติดตามไว้สำหรับสัญญาณ safe-haven ในอนาคต แต่ยังไม่ถูกนำไปคิดคะแนน -- ต้องมีข้อมูลย้อนหลังมากกว่านี้ก่อนจะเชื่อถือได้ในโมเดลรวม",
    rangePosition: "ตำแหน่งในช่วงราคา:",
    todaysRange: "ช่วงราคาวันนี้:",
    meanReversionNote: "0% = อยู่ที่จุดต่ำสุดวันนี้, 100% = อยู่ที่จุดสูงสุดวันนี้ ตำแหน่งต่ำให้คะแนนเป็นขาขึ้น (มีที่ให้ดีดกลับขึ้น) ตำแหน่งสูงให้คะแนนเป็นขาลง",
    macroCoverage: (cov: string) => `ความครบถ้วน: ${cov}/100 (นโยบาย 4 / เงินเฟ้อ 3 / แรงงาน 2 / การเติบโต 1)`,
    macroUnavailable: "ไม่มีข้อมูล Macro — ถูกตัดออกจาก FX Score",
    policy: "นโยบาย",
    ratesLine: (rba: string | null, fed: string | null, bot: string | null) => (
      <>
        RBA <Figure value={rba} /> | Fed <Figure value={fed} /> | BOT <Figure value={bot} />
      </>
    ),
    rbaFedLine: (change: string | null, score: string | null, change2: string | null, score2: string | null) => (
      <>
        RBA-Fed 90 วัน: <Figure value={change} /> (คะแนน <Figure value={score} />) | Fed-BOT 90 วัน: <Figure value={change2} /> (คะแนน <Figure value={score2} />)
      </>
    ),
    inflation: "เงินเฟ้อ",
    coverage: (cov: string) => `ความครบถ้วน: ${cov}/100`,
    compositeVsTarget: (composite: string | null, target: string) => (
      <>
        รวม <Figure value={composite} /> เทียบเป้าหมาย {target}%
      </>
    ),
    pressure: (pressure: string | null) => (
      <>
        {" "}
        (แรงกดดัน <Figure value={pressure} />)
      </>
    ),
    labour: "แรงงาน",
    growth: "การเติบโต (GDP)",
    qoqGdp: "GDP รายไตรมาส",
    unavailable: (reason: string) => `ไม่มีข้อมูล (${reason})`,
    tradeBalance: "ดุลการค้า (บัญชีเดินสะพัด)",
    macroNote: "Growth ใช้การให้คะแนนจาก GDP อย่างเดียวแบบทดลอง ยังไม่ผ่านการ backtest ดุลการค้าถูกติดตามแต่ยังไม่ถูกนำไปคิดคะแนน แต่ละองค์ประกอบย่อยของ Macro ล้มเหลวแยกจากกัน -- ข้อมูลที่ขาดหายจะตัดออกเฉพาะส่วนนั้น ไม่กระทบ Macro Score ทั้งหมด",
    session: "ช่วงตลาด:",
    open: "เปิด",
    closed: "ปิด",
    age: "อายุข้อมูล:",
    marketClosedExcluded: "ตลาดปิด — ถูกตัดออกจาก FX Score ปัจจุบัน",
    riskNote: "VIXY (ETF ความผันผวน) ให้คะแนนแบบผกผัน: ความผันผวนที่สูงขึ้นมักหมายถึงเงินไหลออกจาก AUD เพื่อความปลอดภัย ดังนั้น VIXY ที่พุ่งขึ้นจะกดคะแนนนี้ไปทางขาลง",
  },
} as const;

// Each factor collapses behind <details>/<summary> -- no JS needed, and
// it turns what used to be one long always-open list (a real problem on
// mobile) into a scannable set of rows you open one at a time.
function Factor({
  name,
  tooltip,
  score,
  weightLabel,
  defaultOpen = false,
  children,
}: {
  name: string;
  tooltip?: string;
  score: number | null;
  weightLabel: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group border-b border-stone-200 dark:border-stone-800 last:border-b-0"
      open={defaultOpen}
    >
      <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer list-none marker:content-none">
        <div className="flex items-center gap-3 min-w-0">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 shrink-0 text-stone-600 dark:text-stone-400 transition-transform group-open:rotate-90"
          >
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <span className="font-semibold truncate">{name}</span>
          {tooltip && <InfoTip text={tooltip} />}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-stone-600 hidden sm:inline">{weightLabel}</span>
          <SegmentScore score={score} />
        </div>
      </summary>

      <div className="pb-4 pl-7 space-y-4">{children}</div>
    </details>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-stone-600 italic">{children}</p>;
}

export default async function ScoreBreakdown({
  data,
  locale,
}: {
  data: DashboardData;
  locale: Locale;
}) {
  const macro = await getMacroCompositeData();
  const tradeBalance = await getTradeBalanceData();
  const t = STR[locale];
  const COUNTRY_LABEL = locale === "th" ? COUNTRY_LABEL_TH : COUNTRY_LABEL_EN;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex items-center">
          <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
          <p className="text-xs text-stone-600 dark:text-stone-400">{t.tapFactor}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-stone-600 dark:text-stone-400 uppercase tracking-wide inline-flex items-center">
            Core FX Score
            <InfoTip text={t.coreFxScoreTooltip} />
          </p>
          <Figure
            value={data.coreFxScore !== null ? String(data.coreFxScore) : null}
            className={`text-2xl font-semibold ${scoreTextColor(data.coreFxScore)}`}
          />
          <p className="text-xs text-stone-600 dark:text-stone-400">{tLabel(data.coreBias, locale)}</p>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t border-stone-200 dark:border-stone-800">
        {/* PRICE */}
        <Factor
          name={t.priceMomentum.name}
          tooltip={t.priceMomentum.tooltip}
          score={data.priceMomentumScore}
          weightLabel={t.priceMomentum.weight}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.priceScoreLine(formatScore(data.priceScore1H), formatChange(data.change1H), formatScore(data.priceScore4H), formatChange(data.change4H))}
          </p>
          <Note>{t.priceNote}</Note>
        </Factor>

        {/* CROSS */}
        <Factor
          name={t.crossCurrency.name}
          tooltip={t.crossCurrency.tooltip}
          score={data.crossCurrencyScore}
          weightLabel={t.crossCurrency.weight}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.crossChangeLine} <Figure value={formatChange(data.crossCurrencyChange1H)} />
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.crossRateLine(
              data.crossRate !== null ? data.crossRate.toFixed(4) : null,
              data.directRate !== null ? data.directRate.toFixed(4) : null,
            )}
          </p>

          {data.crossStatus !== "GOOD" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{t.crossExcluded(tLabel(data.crossStatus, locale))}</p>
          )}

          <Note>{t.crossNote}</Note>
        </Factor>

        {/* RELATIVE MARKET */}
        <Factor
          name={t.relativeMarket.name}
          tooltip={t.relativeMarket.tooltip}
          score={data.relativeMarketScore}
          weightLabel={t.relativeMarket.weight(data.relativeMarketEffectiveWeight.toFixed(1))}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.relativeCoverage(data.relativeMarketCoverage.toFixed(1))}</p>

          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.yieldLabel}</p>
              <SegmentScore score={data.yieldScore} />
            </div>
            {data.latestYieldSnapshot && (
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {t.yieldSnapshot(
                  Number(data.latestYieldSnapshot.au_2y).toFixed(3),
                  data.latestYieldSnapshot.au_reference_date,
                  Number(data.latestYieldSnapshot.us_2y).toFixed(3),
                  data.latestYieldSnapshot.us_reference_date,
                )}
              </p>
            )}
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.spread} <Figure value={data.yieldSpread !== null ? `${data.yieldSpread > 0 ? "+" : ""}${data.yieldSpread.toFixed(3)}%` : null} />
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.weekChange} <Figure value={formatBps(data.yieldSpreadChange1WBps)} />
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.relativeWeight(data.yieldEffectiveWeight.toFixed(1))}</p>
            <StatusBadge label={`${t.confidence} ${tLabel(data.yieldConfidence, locale)}`} tone={confidenceTone(data.yieldConfidence)} />
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.oldestData} <Figure value={data.yieldDataAgeDays !== null ? `${data.yieldDataAgeDays} ${t.days}` : null} /> | {t.dateGap}{" "}
              <Figure value={data.yieldDataGapDays !== null ? `${data.yieldDataGapDays} ${t.days}` : null} />
            </p>
          </div>

          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">USD/CNH</p>
              <SegmentScore score={data.usdCnhScore} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              1H: <Figure value={formatChange(data.usdCnhChange1H)} /> | {t.relativeWeightSimple(15)}
            </p>
          </div>

          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">USD/SGD</p>
              <SegmentScore score={data.usdSgdScore} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              1H: <Figure value={formatChange(data.usdSgdChange1H)} /> | {t.relativeWeightSimple(59)}
            </p>
          </div>

          <Note>{t.relativeNote}</Note>
        </Factor>

        {/* COMMODITY */}
        <Factor
          name={t.commodity.name}
          tooltip={t.commodity.tooltip}
          score={data.commodityScore}
          weightLabel={t.commodity.weight(data.commodityEffectiveFxWeight.toFixed(1))}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.commodityCoverage(data.commodityCoverage.toFixed(1))}</p>

          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.ironOre}</p>
              <SegmentScore score={data.ironOreScore} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.price} <Figure value={formatUsd(data.ironOrePrice)} />
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.change24H} <Figure value={formatChange(data.ironOreChange24H)} /> | {t.weightOf(data.ironOreEffectiveWeight.toFixed(1), 45)}
            </p>
            <StatusBadge label={freshnessLabel(data.ironOreFreshness, locale)} tone={freshnessTone(data.ironOreFreshness)} />
            <Note>{t.ironOreNote}</Note>
          </div>

          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.brentLive}</p>
              <SegmentScore score={data.brentLiveScore} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.price} <Figure value={formatUsd(data.brentLivePrice)} />
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.change1H} <Figure value={formatChange(data.brentLiveChange1H)} /> | {t.weight5555}
            </p>
            <StatusBadge label={freshnessLabel(data.brentLiveFreshness, locale)} tone={freshnessTone(data.brentLiveFreshness)} />
          </div>

          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <p className="text-sm">{t.gold}</p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.price} <Figure value={formatUsd(data.goldPrice)} />
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.change1H} <Figure value={formatChange(data.goldChange1H)} /> | {t.weight020}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge label={freshnessLabel(data.goldFreshness, locale)} tone={freshnessTone(data.goldFreshness)} />
              <StatusBadge label={tLabel("Monitor Only", locale)} tone="amber" />
            </div>
            <Note>{t.goldNote}</Note>
          </div>
        </Factor>

        {/* MEAN REVERSION */}
        <Factor
          name={t.meanReversion.name}
          tooltip={t.meanReversion.tooltip}
          score={data.meanReversionScore}
          weightLabel={t.meanReversion.weight}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.rangePosition} <Figure value={data.rangePosition !== null ? `${data.rangePosition.toFixed(1)}%` : null} />
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.todaysRange}{" "}
            <Figure
              value={
                data.intradayLow !== null && data.intradayHigh !== null
                  ? `${data.intradayLow.toFixed(4)} - ${data.intradayHigh.toFixed(4)}`
                  : null
              }
            />
          </p>
          <Note>{t.meanReversionNote}</Note>
        </Factor>

        {/* MACRO */}
        <Factor
          name={t.macro.name}
          tooltip={t.macro.tooltip}
          score={data.macroScore}
          weightLabel={t.macro.weight(data.macroEffectiveFxWeight.toFixed(1))}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.macroCoverage(data.macroCoverage.toFixed(1))}</p>

          {data.macroScore === null && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{t.macroUnavailable}</p>
          )}

          {/* POLICY */}
          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.policy}</p>
              <SegmentScore score={macro.policy.score} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.ratesLine(
                macro.policy.rates.rba !== null ? `${macro.policy.rates.rba.toFixed(2)}%` : null,
                macro.policy.rates.fed !== null ? `${macro.policy.rates.fed.toFixed(2)}%` : null,
                macro.policy.rates.bot !== null ? `${macro.policy.rates.bot.toFixed(2)}%` : null,
              )}
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {t.rbaFedLine(
                formatBps(macro.policy.rbaFed.change90DBps),
                formatScore(macro.policy.rbaFed.score),
                formatBps(macro.policy.fedBot.change90DBps),
                formatScore(macro.policy.fedBot.score),
              )}
            </p>
          </div>

          {/* INFLATION */}
          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.inflation}</p>
              <SegmentScore score={macro.inflation.score} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.coverage(macro.inflation.coverage.toFixed(1))}</p>
            {(["australia", "unitedStates", "thailand"] as const).map((key) => {
              const country = macro.inflation.countries[key];
              return (
                <p key={key} className="text-xs text-stone-600 dark:text-stone-400">
                  {COUNTRY_LABEL[country.country] ?? country.country}:{" "}
                  {t.compositeVsTarget(formatPct(country.compositeInflation), country.targetMidpoint.toFixed(1))}
                  {country.policyPressure !== null ? t.pressure(formatPct(country.policyPressure)) : null}
                </p>
              );
            })}
          </div>

          {/* LABOUR */}
          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.labour}</p>
              <SegmentScore score={macro.labour.score} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.coverage(macro.labour.coverage.toFixed(1))}</p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge label={`AU: ${tLabel(macro.labour.countries.australia.confidence, locale)}`} tone={confidenceTone(macro.labour.countries.australia.confidence)} />
              <StatusBadge label={`US: ${tLabel(macro.labour.countries.unitedStates.confidence, locale)}`} tone={confidenceTone(macro.labour.countries.unitedStates.confidence)} />
              <StatusBadge label={`TH: ${tLabel(macro.labour.countries.thailand.confidence, locale)}`} tone={confidenceTone(macro.labour.countries.thailand.confidence)} />
            </div>
          </div>

          {/* GROWTH */}
          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t.growth}</p>
              <SegmentScore score={macro.growth.score} />
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.coverage(macro.growth.coverage.toFixed(1))}</p>
            {(["australia", "unitedStates", "thailand"] as const).map((key) => {
              const country = macro.growth.countries[key];
              return (
                <p key={key} className="text-xs text-stone-600 dark:text-stone-400">
                  {COUNTRY_LABEL[country.country] ?? country.country}: {t.qoqGdp}{" "}
                  {country.qoqPercent !== null ? <Figure value={formatPct(country.qoqPercent)} /> : t.unavailable(country.reason ?? "")}
                </p>
              );
            })}
            <StatusBadge label={tLabel("Experimental", locale)} tone="amber" />
          </div>

          {/* TRADE BALANCE -- monitor only, not part of the score yet */}
          <div className="pl-3 border-l border-stone-300 dark:border-stone-700 space-y-1.5">
            <p className="text-sm">{t.tradeBalance}</p>
            {(["australia", "thailand"] as const).map((key) => {
              const country = tradeBalance.countries[key];
              const label = locale === "th" ? (key === "australia" ? "ออสเตรเลีย" : "ไทย") : country.label;
              return (
                <p key={key} className="text-xs text-stone-600 dark:text-stone-400">
                  {label}: <Figure value={country.valueUsdBillions !== null ? `$${country.valueUsdBillions.toFixed(2)}B` : null} />
                  {country.latestPeriod ? ` (${country.latestPeriod})` : ""}
                </p>
              );
            })}
            <StatusBadge label={tLabel("Monitor Only", locale)} tone="amber" />
          </div>

          <Note>{t.macroNote}</Note>
        </Factor>

        {/* RISK */}
        <Factor
          name={t.risk.name}
          tooltip={t.risk.tooltip}
          score={data.riskScore}
          weightLabel={t.risk.weight(data.riskEffectiveWeight.toFixed(1))}
        >
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.price} <Figure value={formatUsd(data.riskPrice)} />
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.change1H} <Figure value={formatChange(data.riskChange1H)} />
          </p>

          <StatusBadge label={freshnessLabel(data.riskFreshness, locale)} tone={freshnessTone(data.riskFreshness)} />

          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.session} {data.riskSessionOpen ? t.open : t.closed} | {t.age}{" "}
            <Figure value={data.riskAgeMinutes !== null ? `${data.riskAgeMinutes.toFixed(1)} min` : null} />
          </p>

          {data.riskFreshness === "MARKET_CLOSED" && (
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.marketClosedExcluded}</p>
          )}

          <Note>{t.riskNote}</Note>
        </Factor>
      </div>
    </div>
  );
}
