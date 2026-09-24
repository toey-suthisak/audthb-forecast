"use client";

import { useState } from "react";
import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import InfoTooltip from "@/components/v2/InfoTooltip";
import RangeChart from "@/components/v2/RangeChart";
import PriceMaRsiChart from "@/components/v2/PriceMaRsiChart";
import MacdChart from "@/components/v2/MacdChart";
import type { ChipTone } from "@/components/v2/BadgeChip";
import type { TechnicalOutlook } from "@/lib/technical-outlook-data";
import type { ScoreExplained } from "@/lib/score-explained-data";
import type { CorrelationRow } from "@/lib/correlation-data";
import type { LongTermTechnicals } from "@/lib/long-term-technicals-data";
import type { FactorKey } from "@/lib/score-factors";
import type { Locale } from "@/lib/i18n";

const FACTOR_LABELS: Record<FactorKey, { en: string; th: string }> = {
  priceMomentum: { en: "Price / Momentum", th: "ราคา / โมเมนตัม" },
  crossCurrency: { en: "Cross Currency", th: "Cross Currency" },
  relativeMarket: { en: "Relative Market", th: "Relative Market" },
  commodity: { en: "Commodity", th: "สินค้าโภคภัณฑ์" },
  meanReversion: { en: "Mean Reversion", th: "Mean Reversion" },
  macro: { en: "Macro / Policy", th: "Macro / นโยบาย" },
  risk: { en: "Risk / VIXY", th: "ความเสี่ยง / VIXY" },
};

const SUB_TABS = ["price", "drivers", "correlation"] as const;
type SubTab = (typeof SUB_TABS)[number];

const STR = {
  en: {
    price: "Price & Chart",
    drivers: "Drivers",
    technical: "Technical Levels & Signals",
    correlation: "Correlation",
    dominantFactor: "What's driving today",
    mixed: "No single factor clearly dominates -- spread across several.",
    shareOfScore: (pct: number) => `${pct.toFixed(0)}% of today's weighted score`,
    whatChanged: "Why is it moving? (what changed vs. ~24h ago)",
    notEnoughAttribution: "Not enough history under the current model version to compare yet.",
    pivotBasis: (date: string) => `Based on ${date}'s close`,
    swingRange: (days: number) => `${days}-day range`,
    trend: "Trend (SMA)",
    momentum: "Momentum (RSI)",
    signalsLabel: "Signals",
    corrNote: "Pearson correlation of daily % change vs. AUD/THB's own daily % change, over whatever real overlapping history exists.",
    notEnoughCorr: (min: number) => `Needs ${min}+ overlapping days of real history`,
    strong: "Strong",
    moderate: "Moderate",
    weak: "Weak",
    priceMaRsiTitle: "RSI(14) & MA50/MA200 -- 3 months",
    macdTitle: "MACD -- 6 months",
    asOf: (date: string, source: string) => `Real daily data as of ${date}, from ${source} -- a different source than the live intraday feed above.`,
    rsiNow: (v: number) => `RSI(14) is currently ${v.toFixed(1)}`,
    rsiOverboughtNote: " (overbought territory).",
    rsiOversoldNote: " (oversold territory).",
    rsiNeutralNote: " (no extreme in either direction).",
    maGolden: (s: number, l: number) => `MA50 (${s.toFixed(4)}) is above MA200 (${l.toFixed(4)}) -- a "Golden Cross," a long-term bullish signal.`,
    maDeath: (s: number, l: number) => `MA50 (${s.toFixed(4)}) is below MA200 (${l.toFixed(4)}) -- a "Death Cross," a long-term bearish signal.`,
    macdBullish: (macd: number, sig: number, hist: number) =>
      `MACD signal is currently POSITIVE (bullish) -- the MACD line (${macd.toFixed(4)}) is above the Signal line (${sig.toFixed(4)}), histogram +${hist.toFixed(4)}.`,
    macdBearish: (macd: number, sig: number, hist: number) =>
      `MACD signal is currently NEGATIVE (bearish) -- the MACD line (${macd.toFixed(4)}) is below the Signal line (${sig.toFixed(4)}), histogram ${hist.toFixed(4)}.`,
    macdNotEnough: "Not enough real RBA F11.1 history yet to compute MACD.",
    tip: {
      priceChart:
        "AUD/THB daily closing prices with pivot support/resistance levels overlaid, built from this app's own real stored price history. It matters because it shows at a glance where the current rate sits relative to its recent range and the nearest support/resistance. Classic pivots were chosen over a proprietary or ML-based indicator because the formula is fully transparent -- anyone can recompute it by hand from a single day's high/low/close.",
      technicalLevels:
        "Classic floor-trader pivot points: Pivot = (High+Low+Close)/3 of the most recently completed day, then R1/R2/R3 and S1/S2/S3 fan out from it with fixed multiples. Traders use these as reference levels where price is more likely to pause or reverse. Chosen over a proprietary or ML-based level because it's simple, deterministic, and has been used by real floor traders for decades -- nothing here is fitted or fabricated.",
      technicalSignals:
        "Simple Moving Average and RSI computed from this app's own real daily price history -- both periods shrink automatically while less than a full window of history exists yet, so the numbers are always real, never padded. SMA shows short-term trend direction; RSI (0-100) shows momentum, with >70 read as overbought and <30 as oversold. Chosen because they're the two most widely taught technical indicators, simple enough to sanity-check by hand.",
      priceMaRsiTitle:
        "RSI(14), MA50 and MA200 computed over the real RBA F11.1 daily AUD/THB series (2023 onward) -- a longer, independent real source than the live intraday feed used above. MA50/MA200 crossing is the classic 'Golden Cross' / 'Death Cross' long-term trend signal. This source was chosen because RBA's official daily reference rate is the only real series with enough history (900+ days) to compute a meaningful 50/200-day average.",
      macdTitle:
        "MACD = 12-day EMA minus 26-day EMA of the RBA daily series; the Signal line is a 9-day EMA of MACD itself. MACD above Signal (positive histogram) reads bullish, below reads bearish. Chosen because it's one of the most standard trend-momentum indicators, combining both in one number, and is fully reproducible from the same real daily closes used elsewhere on this page.",
      dominantFactor:
        "The FX Score is a weighted sum of 7 real signals; this shows which one currently contributes the largest share, and each factor's raw point contribution to today's total. Contributions are computed the exact same way the total score itself is built, so they always sum to it -- there's no separate 'explanation model' that could disagree with the real score.",
      whatChanged:
        "A rule-based, factor-by-factor comparison of the current FX Score snapshot against the snapshot from roughly 24 hours ago -- it states in plain language which real inputs moved and by how much, never a generated guess. Chosen over a free-text AI summary so every sentence here traces back to an actual stored number you could re-query yourself.",
      correlation:
        "Real Pearson correlation between AUD/THB's own daily % change and each other real market's daily % change, computed from this app's stored daily price bars (not the model's own factor weights). It matters because it's an independent, data-driven check of which markets actually move together with AUD/THB in practice -- separate from what the FX Score assumes. Requires 15+ real overlapping trading days per pair before showing a number, so it never reports a correlation computed on too few points to mean anything.",
    },
    factorTip: {
      priceMomentum:
        "35% weight -- the largest factor. 1H/4H momentum from this project's own live AUD/THB feed. Weighted highest because it's the most direct, real-time signal of AUD/THB's own movement.",
      crossCurrency:
        "20% weight. AUD/USD x USD/THB (matched-time), a cross-check against the Direct feed above -- if the two diverge, that gap is itself informative.",
      relativeMarket:
        "15% weight. AU-US 2Y yield spread, USD/CNH and USD/SGD -- proxies for regional risk appetite and rate differentials that tend to move AUD.",
      commodity:
        "8% weight. Iron Ore and Brent -- Australia's terms-of-trade link, since AUD often tracks commodity export prices.",
      meanReversion:
        "5% weight. Today's range position -- a price that has moved far within the day tends to snap back a little, a well-documented short-term statistical tendency.",
      macro:
        "10% weight. RBA/Fed policy, inflation, labour and growth releases -- the macro backdrop that eventually dominates over short-term technical noise.",
      risk:
        "7% weight. VIXY (volatility) -- AUD is a 'risk currency', typically sold for safety when markets get volatile.",
    },
  },
  th: {
    price: "ราคา & กราฟ",
    drivers: "ปัจจัยขับเคลื่อน",
    technical: "แนวรับ-แนวต้าน & สัญญาณเทคนิค",
    correlation: "ความสัมพันธ์",
    dominantFactor: "อะไรขับเคลื่อนคะแนนวันนี้",
    mixed: "ไม่มีปัจจัยใดปัจจัยหนึ่งเด่นชัด -- กระจายอยู่หลายปัจจัย",
    shareOfScore: (pct: number) => `${pct.toFixed(0)}% ของน้ำหนักคะแนนวันนี้`,
    whatChanged: "ทำไมราคาถึงเคลื่อนไหว (อะไรเปลี่ยนไปจากเมื่อ ~24 ชม. ก่อน)",
    notEnoughAttribution: "โมเดลเวอร์ชันปัจจุบันยังมีประวัติไม่พอที่จะเปรียบเทียบ",
    pivotBasis: (date: string) => `คำนวณจากราคาปิดวันที่ ${date}`,
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    trend: "แนวโน้ม (SMA)",
    momentum: "Momentum (RSI)",
    signalsLabel: "สัญญาณ",
    corrNote: "ค่าสหสัมพันธ์ Pearson ของ % การเปลี่ยนแปลงรายวัน เทียบกับ % การเปลี่ยนแปลงรายวันของ AUD/THB เอง จากข้อมูลจริงที่ซ้อนทับกันเท่าที่มี",
    notEnoughCorr: (min: number) => `ต้องมีข้อมูลจริงซ้อนทับกันอย่างน้อย ${min} วัน`,
    strong: "แรง",
    moderate: "ปานกลาง",
    weak: "อ่อน",
    priceMaRsiTitle: "RSI(14) และ MA50/MA200 -- ย้อนหลัง 3 เดือน",
    macdTitle: "MACD -- ย้อนหลัง 6 เดือน",
    asOf: (date: string, source: string) => `ข้อมูลรายวันจริง ณ วันที่ ${date} จาก ${source} -- คนละแหล่งกับฟีดเรียลไทม์ด้านบน`,
    rsiNow: (v: number) => `RSI(14) ตอนนี้อยู่ที่ ${v.toFixed(1)}`,
    rsiOverboughtNote: " (โซน overbought)",
    rsiOversoldNote: " (โซน oversold)",
    rsiNeutralNote: " (ยังไม่สุดโต่งไปทางใด)",
    maGolden: (s: number, l: number) => `MA50 (${s.toFixed(4)}) อยู่เหนือ MA200 (${l.toFixed(4)}) -- เรียกว่า "Golden Cross" สัญญาณขาขึ้นระยะยาว`,
    maDeath: (s: number, l: number) => `MA50 (${s.toFixed(4)}) อยู่ใต้ MA200 (${l.toFixed(4)}) -- เรียกว่า "Death Cross" สัญญาณขาลงระยะยาว`,
    macdBullish: (macd: number, sig: number, hist: number) =>
      `สัญญาณ MACD ตอนนี้เป็นบวก (Bullish) -- เส้น MACD (${macd.toFixed(4)}) อยู่เหนือเส้น Signal (${sig.toFixed(4)}), Histogram +${hist.toFixed(4)}`,
    macdBearish: (macd: number, sig: number, hist: number) =>
      `สัญญาณ MACD ตอนนี้เป็นลบ (Bearish) -- เส้น MACD (${macd.toFixed(4)}) อยู่ใต้เส้น Signal (${sig.toFixed(4)}), Histogram ${hist.toFixed(4)}`,
    macdNotEnough: "ข้อมูล RBA F11.1 ย้อนหลังยังไม่พอสำหรับคำนวณ MACD",
    tip: {
      priceChart:
        "กราฟราคาปิดรายวันของ AUD/THB พร้อมเส้นแนวรับ-แนวต้าน (pivot) ซ้อนทับ คำนวณจากข้อมูลราคาจริงที่แอปเก็บเอง มีประโยชน์เพราะเห็นได้ทันทีว่าราคาปัจจุบันอยู่ตรงไหนเทียบกับกรอบราคาล่าสุดและแนวรับ-แนวต้านที่ใกล้ที่สุด เลือกใช้ pivot แบบคลาสสิกแทนอินดิเคเตอร์เฉพาะทางหรือ ML เพราะสูตรโปร่งใส ใครก็คำนวณเองได้จากราคาสูงสุด-ต่ำสุด-ปิดของวันเดียว",
      technicalLevels:
        "Pivot Point แบบคลาสสิกที่นักเทรดใช้กัน: Pivot = (สูงสุด+ต่ำสุด+ปิด)/3 ของวันล่าสุดที่ปิดสมบูรณ์ แล้วคำนวณ R1/R2/R3 และ S1/S2/S3 ด้วยสูตรคูณคงที่จากจุดนั้น นักเทรดใช้ระดับเหล่านี้เป็นจุดอ้างอิงที่ราคามักจะชะลอหรือกลับตัว เลือกใช้สูตรนี้แทนโมเดล ML หรือสูตรเฉพาะทาง เพราะเรียบง่าย กำหนดผลลัพธ์ได้แน่นอน และนักเทรดพื้นจริงใช้กันมาหลายสิบปี ไม่มีการ fit หรือปั้นตัวเลข",
      technicalSignals:
        "Simple Moving Average และ RSI คำนวณจากข้อมูลราคารายวันจริงของแอปเอง โดยช่วงเวลาจะลดลงอัตโนมัติหากข้อมูลย้อนหลังยังไม่ครบ ตัวเลขจึงเป็นของจริงเสมอ ไม่มีการเติมข้อมูลปลอม SMA บอกทิศทางแนวโน้มระยะสั้น ส่วน RSI (0-100) บอกโมเมนตัม ถ้า >70 ถือว่า overbought และ <30 ถือว่า oversold เลือกใช้สองตัวนี้เพราะเป็นอินดิเคเตอร์พื้นฐานที่รู้จักกันมากที่สุด คำนวณตรวจสอบเองได้ง่าย",
      priceMaRsiTitle:
        "RSI(14), MA50 และ MA200 คำนวณจากอนุกรมราคาปิดรายวันจริงของ RBA F11.1 (ตั้งแต่ปี 2023) ซึ่งเป็นแหล่งข้อมูลจริงที่ยาวกว่าและเป็นอิสระจากฟีดเรียลไทม์ด้านบน การตัดกันของ MA50/MA200 คือสัญญาณ 'Golden Cross' / 'Death Cross' แบบคลาสสิกสำหรับแนวโน้มระยะยาว เลือกใช้แหล่งนี้เพราะอัตราอ้างอิงรายวันของ RBA เป็นแหล่งข้อมูลจริงแหล่งเดียวที่มีประวัติยาวพอ (900+ วัน) จะคำนวณค่าเฉลี่ย 50/200 วันได้อย่างมีความหมาย",
      macdTitle:
        "MACD = EMA 12 วัน ลบ EMA 26 วัน ของอนุกรมราคารายวัน RBA ส่วนเส้น Signal คือ EMA 9 วันของ MACD เอง ถ้า MACD อยู่เหนือ Signal (histogram เป็นบวก) อ่านว่าเป็นขาขึ้น ถ้าอยู่ใต้อ่านว่าเป็นขาลง เลือกใช้เพราะเป็นอินดิเคเตอร์แนวโน้ม-โมเมนตัมมาตรฐานที่สุดตัวหนึ่ง รวมทั้งสองอย่างไว้ในตัวเลขเดียว และคำนวณย้อนกลับได้จากราคาปิดรายวันจริงชุดเดียวกับที่ใช้ในหน้านี้",
      dominantFactor:
        "FX Score คือผลรวมถ่วงน้ำหนักของสัญญาณจริง 7 ตัว ส่วนนี้แสดงว่าปัจจัยไหนมีสัดส่วนมากที่สุดตอนนี้ พร้อมคะแนนที่แต่ละปัจจัยส่งผลต่อคะแนนรวมวันนี้ คำนวณด้วยวิธีเดียวกับที่ใช้สร้างคะแนนรวมจริง ผลรวมของแต่ละปัจจัยจึงเท่ากับคะแนนรวมเป๊ะ ไม่มี 'โมเดลอธิบาย' แยกต่างหากที่อาจขัดแย้งกับคะแนนจริง",
      whatChanged:
        "การเปรียบเทียบ FX Score ปัจจุบันกับสแนปช็อตเมื่อประมาณ 24 ชั่วโมงก่อน แบบทีละปัจจัยด้วยกฎตายตัว บอกเป็นภาษาที่อ่านง่ายว่าอินพุตจริงตัวไหนขยับไปเท่าไหร่ ไม่ใช่การเดาจาก AI สร้างข้อความ เลือกใช้วิธีนี้แทนสรุปแบบข้อความอิสระ เพื่อให้ทุกประโยคที่เห็นสืบย้อนกลับไปหาตัวเลขจริงที่เก็บไว้ในฐานข้อมูลได้",
      correlation:
        "ค่าสหสัมพันธ์ Pearson จริงระหว่าง % การเปลี่ยนแปลงรายวันของ AUD/THB เอง กับ % การเปลี่ยนแปลงรายวันของตลาดจริงอื่นๆ คำนวณจากแท่งราคารายวันที่แอปเก็บไว้เอง (ไม่ใช่น้ำหนักปัจจัยของโมเดล) มีประโยชน์เพราะเป็นการตรวจสอบอิสระจากข้อมูลจริงว่าตลาดไหนเคลื่อนไหวไปพร้อมกับ AUD/THB จริงๆ แยกต่างหากจากสมมติฐานของ FX Score ต้องมีข้อมูลจริงซ้อนทับกันอย่างน้อย 15 วันทำการต่อคู่ก่อนถึงจะแสดงตัวเลข เพื่อไม่ให้รายงานค่าสหสัมพันธ์ที่คำนวณจากข้อมูลน้อยเกินไปจนไม่มีความหมาย",
    },
    factorTip: {
      priceMomentum:
        "น้ำหนัก 35% -- ปัจจัยที่หนักที่สุด โมเมนตัม 1H/4H จากฟีด AUD/THB จริงของระบบนี้ ให้น้ำหนักสูงสุดเพราะเป็นสัญญาณตรงและเรียลไทม์ที่สุดของการเคลื่อนไหว AUD/THB เอง",
      crossCurrency:
        "น้ำหนัก 20% -- AUD/USD x USD/THB (จับคู่เวลา) ใช้ตรวจสอบไขว้กับฟีด Direct ด้านบน ถ้าสองค่านี้ต่างกันมาก ส่วนต่างนั้นก็เป็นข้อมูลที่มีนัยสำคัญเช่นกัน",
      relativeMarket:
        "น้ำหนัก 15% -- ส่วนต่างผลตอบแทนพันธบัตร AU-US 2 ปี, USD/CNH และ USD/SGD เป็นตัวแทนความเสี่ยงในภูมิภาคและส่วนต่างอัตราดอกเบี้ยที่มักขับเคลื่อน AUD",
      commodity:
        "น้ำหนัก 8% -- แร่เหล็กและเบรนท์ ความเชื่อมโยงเชิง terms-of-trade ของออสเตรเลีย เพราะ AUD มักเคลื่อนไหวตามราคาสินค้าโภคภัณฑ์ส่งออก",
      meanReversion:
        "น้ำหนัก 5% -- ตำแหน่งราคาในกรอบวันนี้ ราคาที่วิ่งไกลในวันมักดีดกลับมาบ้าง เป็นแนวโน้มทางสถิติระยะสั้นที่มีการศึกษาไว้ชัดเจน",
      macro:
        "น้ำหนัก 10% -- นโยบาย RBA/Fed, เงินเฟ้อ, การจ้างงาน และการเติบโต ปัจจัยมหภาคที่ในที่สุดจะครอบงำสัญญาณทางเทคนิคระยะสั้น",
      risk:
        "น้ำหนัก 7% -- VIXY (ความผันผวน) AUD เป็น 'risk currency' มักถูกขายเพื่อความปลอดภัยเมื่อตลาดผันผวน",
    },
  },
} as const;

function corrTone(value: number | null): ChipTone {
  if (value === null) return "slate";
  const abs = Math.abs(value);
  if (abs >= 0.6) return value > 0 ? "emerald" : "red";
  if (abs >= 0.3) return "amber";
  return "slate";
}

function corrStrength(value: number, t: (typeof STR)[Locale]): string {
  const abs = Math.abs(value);
  if (abs >= 0.6) return t.strong;
  if (abs >= 0.3) return t.moderate;
  return t.weak;
}

export default function AnalysisTabs({
  locale,
  technicalOutlook,
  scoreExplained,
  correlations,
  longTermTechnicals,
}: {
  locale: Locale;
  technicalOutlook: TechnicalOutlook;
  scoreExplained: ScoreExplained;
  correlations: { rows: CorrelationRow[]; minSamples: number };
  longTermTechnicals: LongTermTechnicals;
}) {
  const t = STR[locale];
  const [tab, setTab] = useState<SubTab>("price");

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-v2-border mb-5">
        {SUB_TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-v2-muted hover:text-v2-foreground"
            }`}
          >
            {t[key]}
          </button>
        ))}
      </div>

      {tab === "price" && (
        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-1.5">
                {t.price}
                <InfoTooltip text={t.tip.priceChart} />
              </span>
            }
          >
            {technicalOutlook.priceSeries.length > 0 ? (
              <RangeChart
                series={technicalOutlook.priceSeries.map((p) => ({ date: p.date, close: p.close }))}
                locale={locale}
                pivots={technicalOutlook.pivots}
                currentRate={technicalOutlook.currentRate}
                swingLow={technicalOutlook.swingLow}
                swingHigh={technicalOutlook.swingHigh}
                swingDays={technicalOutlook.swingLookbackDays}
              />
            ) : (
              <p className="text-sm text-v2-muted">{technicalOutlook.error}</p>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-1.5">
                {t.technical}
                <InfoTooltip text={t.tip.technicalLevels} />
              </span>
            }
          >
            {technicalOutlook.pivots ? (
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2 text-sm">
                  {[
                    { label: "R3", value: technicalOutlook.pivots.r3 },
                    { label: "R2", value: technicalOutlook.pivots.r2 },
                    { label: "R1", value: technicalOutlook.pivots.r1 },
                    { label: "Pivot", value: technicalOutlook.pivots.pivot },
                    { label: "S1", value: technicalOutlook.pivots.s1 },
                    { label: "S2", value: technicalOutlook.pivots.s2 },
                    { label: "S3", value: technicalOutlook.pivots.s3 },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-v2-muted">{row.label}</span>
                      <span className="font-mono text-v2-foreground">{row.value.toFixed(4)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-v2-muted pt-2">{t.pivotBasis(technicalOutlook.pivots.basedOnDate)}</p>
                  {technicalOutlook.swingHigh !== null && technicalOutlook.swingLow !== null && (
                    <p className="text-xs text-v2-muted">
                      {t.swingRange(technicalOutlook.swingLookbackDays)}: {technicalOutlook.swingLow.toFixed(4)} - {technicalOutlook.swingHigh.toFixed(4)}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-v2-muted">
                    {t.signalsLabel}
                    <InfoTooltip text={t.tip.technicalSignals} />
                  </div>
                  {technicalOutlook.smaShortValue !== null && (
                    <div>
                      <p className="text-xs text-v2-muted">{t.trend} ({technicalOutlook.smaShortPeriod})</p>
                      <p className="font-mono text-lg text-v2-foreground">{technicalOutlook.smaShortValue.toFixed(4)}</p>
                    </div>
                  )}
                  {technicalOutlook.rsiValue !== null && (
                    <div>
                      <p className="text-xs text-v2-muted">{t.momentum} ({technicalOutlook.rsiPeriod})</p>
                      <p className="font-mono text-lg text-v2-foreground">{technicalOutlook.rsiValue.toFixed(1)}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-v2-muted">{technicalOutlook.error}</p>
            )}
          </Card>

          {longTermTechnicals.available && (
            <Card
              title={
                <span className="flex items-center gap-1.5">
                  {t.priceMaRsiTitle}
                  <InfoTooltip text={t.tip.priceMaRsiTitle} />
                </span>
              }
            >
              <PriceMaRsiChart points={longTermTechnicals.priceStudy} locale={locale} />
              <div className="mt-2 space-y-1 text-xs text-v2-muted leading-relaxed">
                {longTermTechnicals.currentRsi14 !== null && (
                  <p>
                    {t.rsiNow(longTermTechnicals.currentRsi14)}
                    {longTermTechnicals.currentRsi14 >= 70
                      ? t.rsiOverboughtNote
                      : longTermTechnicals.currentRsi14 <= 30
                        ? t.rsiOversoldNote
                        : t.rsiNeutralNote}
                  </p>
                )}
                {longTermTechnicals.currentSma50 !== null && longTermTechnicals.currentSma200 !== null && (
                  <p>
                    {longTermTechnicals.maBias === "GOLDEN"
                      ? t.maGolden(longTermTechnicals.currentSma50, longTermTechnicals.currentSma200)
                      : t.maDeath(longTermTechnicals.currentSma50, longTermTechnicals.currentSma200)}
                  </p>
                )}
                {longTermTechnicals.dataAsOfDate && <p>{t.asOf(longTermTechnicals.dataAsOfDate, longTermTechnicals.source)}</p>}
              </div>
            </Card>
          )}

          {longTermTechnicals.available && (
            <Card
              title={
                <span className="flex items-center gap-1.5">
                  {t.macdTitle}
                  <InfoTooltip text={t.tip.macdTitle} />
                </span>
              }
            >
              {longTermTechnicals.macdStudy.length >= 2 &&
              longTermTechnicals.currentMacd !== null &&
              longTermTechnicals.currentSignal !== null &&
              longTermTechnicals.currentHistogram !== null ? (
                <>
                  <MacdChart points={longTermTechnicals.macdStudy} locale={locale} />
                  <p
                    className={`mt-2 text-xs leading-relaxed font-medium ${
                      longTermTechnicals.macdBias === "BULLISH"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : longTermTechnicals.macdBias === "BEARISH"
                          ? "text-red-600 dark:text-red-400"
                          : "text-v2-muted"
                    }`}
                  >
                    {longTermTechnicals.macdBias === "BULLISH"
                      ? t.macdBullish(longTermTechnicals.currentMacd, longTermTechnicals.currentSignal, longTermTechnicals.currentHistogram)
                      : t.macdBearish(longTermTechnicals.currentMacd, longTermTechnicals.currentSignal, longTermTechnicals.currentHistogram)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-v2-muted">{t.macdNotEnough}</p>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "drivers" && (
        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-1.5">
                {t.dominantFactor}
                <InfoTooltip text={t.tip.dominantFactor} />
              </span>
            }
          >
            {scoreExplained.regime && scoreExplained.regime.key !== "MIXED" && scoreExplained.regime.dominantSharePct !== null ? (
              <div>
                <p className="text-xl font-semibold text-v2-foreground">{FACTOR_LABELS[scoreExplained.regime.key][locale]}</p>
                <p className="text-sm text-v2-muted mt-1">{t.shareOfScore(scoreExplained.regime.dominantSharePct)}</p>
              </div>
            ) : (
              <p className="text-sm text-v2-muted">{t.mixed}</p>
            )}

            <div className="mt-5 space-y-2">
              {scoreExplained.attribution.factors.map((f) => (
                <div key={f.key} className="flex items-center justify-between text-sm">
                  <span className="text-v2-muted flex items-center gap-1.5">
                    {FACTOR_LABELS[f.key][locale]}
                    <InfoTooltip text={t.factorTip[f.key]} />
                  </span>
                  <span className="font-mono text-v2-foreground">
                    {f.currentContribution !== null ? f.currentContribution.toFixed(1) : "--"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-1.5">
                {t.whatChanged}
                <InfoTooltip text={t.tip.whatChanged} />
              </span>
            }
          >
            {!scoreExplained.attribution.available ? (
              <p className="text-sm text-v2-muted">{t.notEnoughAttribution}</p>
            ) : (
              <ul className="space-y-2 mb-5">
                {technicalOutlook.narrative.map((line, i) => (
                  <li key={i} className="text-sm text-v2-muted leading-relaxed list-disc list-inside">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "correlation" && (
        <Card
          title={
            <span className="flex items-center gap-1.5">
              {t.correlation}
              <InfoTooltip text={t.tip.correlation} />
            </span>
          }
        >
          <p className="text-xs text-v2-muted mb-4">{t.corrNote}</p>
          <div className="space-y-2">
            {correlations.rows.map((row) => (
              <div key={row.symbol} className="flex items-center justify-between text-sm">
                <span className="text-v2-muted">{row.label}</span>
                {row.correlation !== null ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-v2-foreground">{row.correlation.toFixed(2)}</span>
                    <BadgeChip label={corrStrength(row.correlation, t)} tone={corrTone(row.correlation)} />
                  </span>
                ) : (
                  <BadgeChip label={t.notEnoughCorr(correlations.minSamples)} tone="slate" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
