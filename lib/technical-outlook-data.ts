import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Locale } from "@/lib/i18n";
import type { DashboardData } from "@/lib/dashboard-data";
import { getEconomicConsensus, type ConsensusEvent } from "@/lib/economic-consensus-data";

// =========================================================
// SEPARATE FROM CORE FX SCORE / FORECAST ON PURPOSE.
//
// Everything here is either (a) a real, well-defined technical
// formula computed from this project's own actual price history
// (market_prices), or (b) a narrative sentence that only restates a
// number the Core FX Score breakdown already computed elsewhere on
// this page -- never a fabricated news headline, analyst quote, or
// external citation. No live news source is wired into this app at
// runtime; if one ever is, it belongs in News Sentiment
// (lib/news-sentiment-data.ts), not invented here.
//
// The Action Bias below is explicitly informational, matching this
// project's existing "descriptive not prescriptive" stance for
// ActionSummary (workflow H) -- it reuses the same Core FX Score bias
// thresholds already used everywhere else in the app, not a new
// judgment call.
// =========================================================

const STR = {
  en: {
    disclaimer:
      "Technical levels are computed from this project's own AUD/THB price history. The narrative restates the Core FX Score breakdown shown elsewhere on this page in prose -- it is not sourced from live news, and is not financial advice.",
    notEnoughData: "Not enough price history yet to compute technical levels.",
    pivot: "Pivot",
    resistance: (n: number) => `R${n}`,
    support: (n: number) => `S${n}`,
    swingHigh: (days: number) => `${days}-day high`,
    swingLow: (days: number) => `${days}-day low`,
    aboveR1: (r1: number, r2: number) =>
      `Price is trading above ${STR_EN_PIVOT_R1_LABEL} (${r1.toFixed(4)}). Holding above it keeps the next resistance at R2 (${r2.toFixed(4)}) in view.`,
    belowS1: (s1: number, s2: number) =>
      `Price is trading below the pivot's first support (${s1.toFixed(4)}). Losing that level opens the way toward S2 (${s2.toFixed(4)}).`,
    betweenS1R1: (s1: number, r1: number) =>
      `Price is sitting inside the pivot's normal range (${s1.toFixed(4)} - ${r1.toFixed(4)}) -- no breakout either way yet.`,
    macroSupportive: "Macro/Policy is currently supportive of AUD",
    macroDrag: "Macro/Policy is currently a drag on AUD",
    macroNeutral: "Macro/Policy is roughly neutral today",
    relativeSupportive: "Relative Market (yield spread, CNH, SGD) favors AUD",
    relativeDrag: "Relative Market conditions favor USD/regional peers over AUD",
    relativeNeutral: "Relative Market signals are mixed today",
    commoditySupportive: "commodity prices (Iron Ore/Brent) are lending AUD some support",
    commodityDrag: "commodity prices (Iron Ore/Brent) are working against AUD",
    commodityNeutral: "commodity prices are roughly flat today",
    riskOn: "risk appetite (VIXY) is calm, which typically helps a risk currency like AUD",
    riskOff: "risk appetite (VIXY) is jumpy, which typically pressures a risk currency like AUD",
    riskUnavailable: "risk/VIXY data isn't available right now",
    overview: (score: number, bias: string) =>
      `Core FX Score reads ${score > 0 ? "+" : ""}${score} (${bias}) right now.`,
    postfund: "Postfund lean",
    prefund: "Prefund lean",
    neutralAction: "No clear lean",
    actionNote: (label: string) =>
      `${label} -- informational only, derived directly from the Core FX Score's own bias thresholds. Not investment advice, and the underlying forecast is still UNCALIBRATED.`,
    currentPrice: "Current price",
    upcomingEvent: (event: string, currency: string, forecast: string, previous: string) =>
      `Upcoming: ${currency} ${event} -- forecast ${forecast}, previous ${previous}`,
    upcomingEventNoPrevious: (event: string, currency: string, forecast: string) =>
      `Upcoming: ${currency} ${event} -- forecast ${forecast}`,
    leanBullish: "(leans bullish for the currency)",
    leanBearish: "(leans bearish for the currency)",
    smaLabel: (n: number) => `SMA(${n})`,
    rsiLabel: (n: number) => `RSI(${n})`,
    trendAboveSma: (n: number, value: number) =>
      `Price is trading above its ${n}-day average (${value.toFixed(4)}) -- short-term trend is up.`,
    trendBelowSma: (n: number, value: number) =>
      `Price is trading below its ${n}-day average (${value.toFixed(4)}) -- short-term trend is down.`,
    trendCrossUp: (short: number, long: number) =>
      `The ${short}-day average is above the ${long}-day average -- short-term trend is stronger than the longer one.`,
    trendCrossDown: (short: number, long: number) =>
      `The ${short}-day average is below the ${long}-day average -- short-term trend is weaker than the longer one.`,
    rsiOverbought: (n: number, value: number) =>
      `${n}-day RSI is ${value.toFixed(0)} (overbought territory) -- the recent move has been unusually one-sided.`,
    rsiOversold: (n: number, value: number) =>
      `${n}-day RSI is ${value.toFixed(0)} (oversold territory) -- the recent move has been unusually one-sided.`,
    rsiNeutral: (n: number, value: number) => `${n}-day RSI is ${value.toFixed(0)} -- no extreme in either direction.`,
    limitedHistory: (days: number) =>
      `Trend/momentum readings above are based on only ${days} day(s) of price history so far -- they'll sharpen as more real data accumulates.`,
  },
  th: {
    disclaimer:
      "แนวรับ-แนวต้านคำนวณจากราคา AUD/THB จริงของระบบนี้ ส่วนคำบรรยายเป็นการเรียบเรียงจากคะแนนราย factor ที่มีอยู่แล้วในหน้านี้เป็นประโยค -- ไม่ได้มาจากข่าวสด และไม่ใช่คำแนะนำการลงทุน",
    notEnoughData: "ข้อมูลราคาย้อนหลังยังไม่พอสำหรับคำนวณแนวรับ-แนวต้าน",
    pivot: "จุดหมุน (Pivot)",
    resistance: (n: number) => `แนวต้าน ${n}`,
    support: (n: number) => `แนวรับ ${n}`,
    swingHigh: (days: number) => `จุดสูงสุดรอบ ${days} วัน`,
    swingLow: (days: number) => `จุดต่ำสุดรอบ ${days} วัน`,
    aboveR1: (r1: number, r2: number) =>
      `ราคาปัจจุบันอยู่เหนือแนวต้านแรก (${r1.toFixed(4)}) ถ้ายืนเหนือระดับนี้ได้ เป้าถัดไปคือแนวต้าน 2 ที่ ${r2.toFixed(4)}`,
    belowS1: (s1: number, s2: number) =>
      `ราคาปัจจุบันอยู่ใต้แนวรับแรก (${s1.toFixed(4)}) ถ้าหลุดระดับนี้ เป้าถัดไปคือแนวรับ 2 ที่ ${s2.toFixed(4)}`,
    betweenS1R1: (s1: number, r1: number) =>
      `ราคาปัจจุบันยังอยู่ในกรอบปกติของ Pivot (${s1.toFixed(4)} - ${r1.toFixed(4)}) ยังไม่ทะลุไปทางใดทางหนึ่ง`,
    macroSupportive: "ปัจจัย Macro/นโยบาย วันนี้ยังหนุน AUD",
    macroDrag: "ปัจจัย Macro/นโยบาย วันนี้เป็นแรงกดดัน AUD",
    macroNeutral: "ปัจจัย Macro/นโยบาย วันนี้ค่อนข้างเป็นกลาง",
    relativeSupportive: "Relative Market (yield spread, CNH, SGD) เอื้อต่อ AUD",
    relativeDrag: "Relative Market วันนี้เอื้อฝั่ง USD/ค่าเงินภูมิภาคมากกว่า AUD",
    relativeNeutral: "สัญญาณ Relative Market วันนี้ผสมกัน",
    commoditySupportive: "ราคาสินค้าโภคภัณฑ์ (แร่เหล็ก/เบรนท์) ช่วยหนุน AUD อยู่บ้าง",
    commodityDrag: "ราคาสินค้าโภคภัณฑ์ (แร่เหล็ก/เบรนท์) เป็นแรงกดดัน AUD",
    commodityNeutral: "ราคาสินค้าโภคภัณฑ์วันนี้ค่อนข้างนิ่ง",
    riskOn: "บรรยากาศความเสี่ยง (VIXY) นิ่ง ซึ่งปกติเป็นผลดีกับ AUD ในฐานะ risk currency",
    riskOff: "บรรยากาศความเสี่ยง (VIXY) ผันผวน ซึ่งปกติกดดัน AUD ในฐานะ risk currency",
    riskUnavailable: "ไม่มีข้อมูลความเสี่ยง/VIXY ในตอนนี้",
    overview: (score: number, bias: string) =>
      `ตอนนี้ Core FX Score อยู่ที่ ${score > 0 ? "+" : ""}${score} (${bias})`,
    postfund: "เอนไปทาง Postfund",
    prefund: "เอนไปทาง Prefund",
    neutralAction: "ยังไม่มีทิศทางชัดเจน",
    actionNote: (label: string) =>
      `${label} -- เป็นข้อมูลประกอบการตัดสินใจเท่านั้น มาจาก threshold คะแนน Core FX Score ตัวเดียวกับที่ใช้ทั้งหน้านี้ ไม่ใช่คำแนะนำการลงทุน และ forecast ที่อ้างอิงยังเป็น UNCALIBRATED อยู่`,
    currentPrice: "ราคาปัจจุบัน",
    upcomingEvent: (event: string, currency: string, forecast: string, previous: string) =>
      `ข่าวที่จะประกาศเร็วๆ นี้: ${currency} ${event} -- คาดการณ์ ${forecast} จากเดิม ${previous}`,
    upcomingEventNoPrevious: (event: string, currency: string, forecast: string) =>
      `ข่าวที่จะประกาศเร็วๆ นี้: ${currency} ${event} -- คาดการณ์ ${forecast}`,
    leanBullish: "(เอนบวกต่อค่าเงินนั้น)",
    leanBearish: "(เอนลบต่อค่าเงินนั้น)",
    smaLabel: (n: number) => `เส้นค่าเฉลี่ย ${n} วัน`,
    rsiLabel: (n: number) => `RSI ${n} วัน`,
    trendAboveSma: (n: number, value: number) =>
      `ราคาอยู่เหนือเส้นค่าเฉลี่ย ${n} วัน (${value.toFixed(4)}) -- แนวโน้มระยะสั้นเป็นขาขึ้น`,
    trendBelowSma: (n: number, value: number) =>
      `ราคาอยู่ใต้เส้นค่าเฉลี่ย ${n} วัน (${value.toFixed(4)}) -- แนวโน้มระยะสั้นเป็นขาลง`,
    trendCrossUp: (short: number, long: number) =>
      `เส้นค่าเฉลี่ย ${short} วัน อยู่เหนือเส้นค่าเฉลี่ย ${long} วัน -- แนวโน้มระยะสั้นแข็งแรงกว่าระยะยาว`,
    trendCrossDown: (short: number, long: number) =>
      `เส้นค่าเฉลี่ย ${short} วัน อยู่ใต้เส้นค่าเฉลี่ย ${long} วัน -- แนวโน้มระยะสั้นอ่อนกว่าระยะยาว`,
    rsiOverbought: (n: number, value: number) =>
      `RSI ${n} วัน อยู่ที่ ${value.toFixed(0)} (โซน overbought) -- การเคลื่อนไหวล่าสุดเอนไปทางเดียวค่อนข้างมาก`,
    rsiOversold: (n: number, value: number) =>
      `RSI ${n} วัน อยู่ที่ ${value.toFixed(0)} (โซน oversold) -- การเคลื่อนไหวล่าสุดเอนไปทางเดียวค่อนข้างมาก`,
    rsiNeutral: (n: number, value: number) => `RSI ${n} วัน อยู่ที่ ${value.toFixed(0)} -- ยังไม่สุดโต่งไปทางใด`,
    limitedHistory: (days: number) =>
      `ค่าแนวโน้ม/momentum ด้านบนคำนวณจากข้อมูลราคาจริงเพียง ${days} วันเท่านั้นในตอนนี้ -- ความแม่นยำจะดีขึ้นเมื่อมีข้อมูลสะสมมากขึ้น`,
  },
} as const;

const STR_EN_PIVOT_R1_LABEL = "the pivot's first resistance";

export type PivotLevels = {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  basedOnDate: string;
};

export type PricePoint = { date: string; close: number; smaShort: number | null };

export type TechnicalOutlook = {
  available: boolean;
  disclaimer: string;
  currentRate: number | null;
  pivots: PivotLevels | null;
  swingHigh: number | null;
  swingLow: number | null;
  swingLookbackDays: number;
  priceSeries: PricePoint[];
  smaShortPeriod: number | null;
  smaShortValue: number | null;
  smaLongPeriod: number | null;
  smaLongValue: number | null;
  rsiPeriod: number | null;
  rsiValue: number | null;
  narrative: string[];
  actionBias: {
    direction: "POSTFUND" | "PREFUND" | "NEUTRAL";
    label: string;
    note: string;
  };
  error: string | null;
};

type DailyBarRow = { bar_date: string; open: number | string; high: number | string; low: number | string; close: number | string };
type DailyBar = { date: string; open: number; high: number; low: number; close: number };

function normalizeBars(rows: DailyBarRow[]): DailyBar[] {
  return rows
    .map((row) => ({
      date: row.bar_date,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Real classic periods (5/20/14) capped to however many completed days of
// real price history actually exist -- this project only started
// collecting AUD/THB on 2026-09-11, so early on these compute over
// fewer real days rather than either faking padding or refusing to show
// anything. The label always states the real period used, and once
// enough history accumulates these naturally become true SMA(20)/RSI(14).
const MAX_SMA_SHORT_PERIOD = 5;
const MAX_SMA_LONG_PERIOD = 20;
const MAX_RSI_PERIOD = 14;
const MIN_BARS_FOR_TREND = 3;

function simpleMovingAverage(bars: DailyBar[], period: number): number {
  const slice = bars.slice(-period);
  return slice.reduce((sum, b) => sum + b.close, 0) / slice.length;
}

function rollingSma(bars: DailyBar[], period: number): (number | null)[] {
  return bars.map((_, i) => {
    if (i + 1 < period) return null;
    return simpleMovingAverage(bars.slice(0, i + 1), period);
  });
}

function relativeStrengthIndex(bars: DailyBar[], period: number): number {
  const closes = bars.slice(-(period + 1)).map((b) => b.close);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += -diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function classicPivots(bar: DailyBar): PivotLevels {
  const pivot = (bar.high + bar.low + bar.close) / 3;
  const range = bar.high - bar.low;
  return {
    pivot,
    r1: 2 * pivot - bar.low,
    r2: pivot + range,
    r3: bar.high + 2 * (pivot - bar.low),
    s1: 2 * pivot - bar.high,
    s2: pivot - range,
    s3: bar.low - 2 * (bar.high - pivot),
    basedOnDate: bar.date,
  };
}

function round(value: number, decimals = 4): number {
  return Number(value.toFixed(decimals));
}

function formatUpcomingEvent(event: ConsensusEvent, t: (typeof STR)[Locale]): string {
  const base = event.previousValue
    ? t.upcomingEvent(event.eventName, event.currency, event.forecastValue ?? "-", event.previousValue)
    : t.upcomingEventNoPrevious(event.eventName, event.currency, event.forecastValue ?? "-");

  if (event.lean === "BULLISH") return `${base} ${t.leanBullish}`;
  if (event.lean === "BEARISH") return `${base} ${t.leanBearish}`;
  return base;
}

const SWING_LOOKBACK_DAYS = 7;

// How far back to ask the DB for -- real history only goes back to
// 2026-09-11 (when AUD/THB ingestion started), so this is a ceiling, not
// a promise; get_daily_price_bars just returns however many real days
// actually exist within it, aggregated server-side (see the migration),
// which is what lets this safely ask for much more than the old
// 1000-raw-row cap ever allowed.
const MAX_LOOKBACK_DAYS = 60;

export async function getTechnicalOutlook(
  locale: Locale,
  dashboard: DashboardData,
): Promise<TechnicalOutlook> {
  const t = STR[locale];

  const empty = (error: string | null): TechnicalOutlook => ({
    available: false,
    disclaimer: t.disclaimer,
    currentRate: null,
    pivots: null,
    swingHigh: null,
    swingLow: null,
    swingLookbackDays: SWING_LOOKBACK_DAYS,
    priceSeries: [],
    smaShortPeriod: null,
    smaShortValue: null,
    smaLongPeriod: null,
    smaLongValue: null,
    rsiPeriod: null,
    rsiValue: null,
    narrative: [],
    actionBias: { direction: "NEUTRAL", label: t.neutralAction, note: t.actionNote(t.neutralAction) },
    error,
  });

  const lookbackStart = new Date(Date.now() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Aggregated server-side (one row per real calendar day) -- see
  // supabase/migrations/20260921_daily_price_bars_function.sql. Replaces
  // the old raw-tick fetch, which silently truncated at Supabase's
  // 1000-row cap (AUD/THB runs ~140 ticks/day) before it ever reached
  // more than ~7 days back.
  const { data, error } = await supabaseAdmin.rpc("get_daily_price_bars", {
    p_symbol: "AUD/THB",
    p_since: lookbackStart.toISOString(),
  });

  if (error) return empty(`Technical outlook DB error: ${error.message}`);

  const bars = normalizeBars((data ?? []) as DailyBarRow[]);
  if (bars.length < 2) return empty(t.notEnoughData);

  // Pivots use the most recently *completed* day -- drop today's bar
  // (still filling in) if more than one bar exists.
  const completedBars = bars.length > 1 ? bars.slice(0, -1) : bars;
  const pivotBar = completedBars[completedBars.length - 1];
  const pivots = classicPivots(pivotBar);

  const swingBars = completedBars.slice(-SWING_LOOKBACK_DAYS);
  const swingHigh = Math.max(...swingBars.map((b) => b.high));
  const swingLow = Math.min(...swingBars.map((b) => b.low));

  const currentRate =
    dashboard.directRate ?? (dashboard.latestPrice ? Number(dashboard.latestPrice.rate) : null);

  // Real classic periods capped to however many completed real days
  // exist -- see the comment on MAX_SMA_SHORT_PERIOD etc. above.
  const smaShortPeriod = Math.min(MAX_SMA_SHORT_PERIOD, completedBars.length);
  const smaLongPeriod = Math.min(MAX_SMA_LONG_PERIOD, completedBars.length);
  const hasTrend = completedBars.length >= MIN_BARS_FOR_TREND;

  const smaShortValue = hasTrend ? round(simpleMovingAverage(completedBars, smaShortPeriod)) : null;
  const smaLongValue =
    hasTrend && smaLongPeriod > smaShortPeriod ? round(simpleMovingAverage(completedBars, smaLongPeriod)) : null;

  const rsiPeriod = Math.min(MAX_RSI_PERIOD, completedBars.length - 1);
  const rsiValue = rsiPeriod >= 2 ? round(relativeStrengthIndex(completedBars, rsiPeriod), 1) : null;

  const narrative: string[] = [];
  if (dashboard.coreFxScore !== null) {
    narrative.push(t.overview(dashboard.coreFxScore, dashboard.coreBias));
  }

  if (dashboard.macroScore !== null) {
    narrative.push(dashboard.macroScore > 5 ? t.macroSupportive : dashboard.macroScore < -5 ? t.macroDrag : t.macroNeutral);
  }
  if (dashboard.relativeMarketScore !== null) {
    narrative.push(
      dashboard.relativeMarketScore > 10 ? t.relativeSupportive : dashboard.relativeMarketScore < -10 ? t.relativeDrag : t.relativeNeutral,
    );
  }
  if (dashboard.commodityScore !== null) {
    narrative.push(
      dashboard.commodityScore > 5 ? t.commoditySupportive : dashboard.commodityScore < -5 ? t.commodityDrag : t.commodityNeutral,
    );
  }
  if (dashboard.riskScore !== null) {
    narrative.push(dashboard.riskScore > 0 ? t.riskOn : dashboard.riskScore < 0 ? t.riskOff : t.riskUnavailable);
  } else {
    narrative.push(t.riskUnavailable);
  }

  if (currentRate !== null) {
    if (currentRate > pivots.r1) narrative.push(t.aboveR1(pivots.r1, pivots.r2));
    else if (currentRate < pivots.s1) narrative.push(t.belowS1(pivots.s1, pivots.s2));
    else narrative.push(t.betweenS1R1(pivots.s1, pivots.r1));
  }

  // Trend (SMA) and momentum (RSI), both computed from this project's own
  // real daily bars above -- periods shrink automatically when less than
  // the classic 5/20/14 days of real history exist yet (see the comment
  // on MAX_SMA_SHORT_PERIOD).
  if (smaShortValue !== null && currentRate !== null) {
    narrative.push(
      currentRate >= smaShortValue
        ? t.trendAboveSma(smaShortPeriod, smaShortValue)
        : t.trendBelowSma(smaShortPeriod, smaShortValue),
    );
  }
  if (smaShortValue !== null && smaLongValue !== null) {
    narrative.push(
      smaShortValue >= smaLongValue
        ? t.trendCrossUp(smaShortPeriod, smaLongPeriod)
        : t.trendCrossDown(smaShortPeriod, smaLongPeriod),
    );
  }
  if (rsiValue !== null) {
    narrative.push(
      rsiValue >= 70
        ? t.rsiOverbought(rsiPeriod, rsiValue)
        : rsiValue <= 30
          ? t.rsiOversold(rsiPeriod, rsiValue)
          : t.rsiNeutral(rsiPeriod, rsiValue),
    );
  }
  if (hasTrend && completedBars.length < MAX_SMA_LONG_PERIOD) {
    narrative.push(t.limitedHistory(completedBars.length));
  }

  // Real forecast/previous values, not invented ones -- economic_consensus
  // is the same ForexFactory-sourced table Market Consensus already
  // displays (lib/economic-consensus-data.ts), so nothing here is new
  // data, just reused in this panel's narrative too. Only events with an
  // actual forecast (skips speeches/holidays) and no actual value yet
  // (already-released numbers belong in the past, not an "upcoming" line).
  const consensus = await getEconomicConsensus();
  const upcoming = consensus.events
    .filter((e) => e.impact === "HIGH" && e.forecastValue !== null && e.actualValue === null)
    .slice(0, 2);

  for (const event of upcoming) {
    narrative.push(formatUpcomingEvent(event, t));
  }

  // Same bias thresholds as coreBias elsewhere in this app (>=15 / <=-15),
  // not a new judgment call -- see lib/dashboard-data.ts.
  let direction: TechnicalOutlook["actionBias"]["direction"] = "NEUTRAL";
  let label: string = t.neutralAction;
  if (dashboard.coreFxScore !== null) {
    if (dashboard.coreFxScore >= 15) {
      direction = "POSTFUND";
      label = t.postfund;
    } else if (dashboard.coreFxScore <= -15) {
      direction = "PREFUND";
      label = t.prefund;
    }
  }

  // Daily closes for the chart, including today's still-filling-in bar
  // so the line reaches the current price -- same bars already computed
  // above for the pivot/swing math, not a second query. The rolling SMA
  // is computed over the same real bars (not padded), so it only starts
  // drawing once enough trailing history exists for that point in time.
  const rollingSmaShort = rollingSma(bars, smaShortPeriod);
  const priceSeries: PricePoint[] = bars.map((bar, i) => ({
    date: bar.date,
    close: round(bar.close),
    smaShort: rollingSmaShort[i] !== null ? round(rollingSmaShort[i] as number) : null,
  }));

  return {
    available: true,
    disclaimer: t.disclaimer,
    currentRate: currentRate !== null ? round(currentRate) : null,
    pivots: {
      pivot: round(pivots.pivot),
      r1: round(pivots.r1),
      r2: round(pivots.r2),
      r3: round(pivots.r3),
      s1: round(pivots.s1),
      s2: round(pivots.s2),
      s3: round(pivots.s3),
      basedOnDate: pivots.basedOnDate,
    },
    swingHigh: round(swingHigh),
    swingLow: round(swingLow),
    swingLookbackDays: SWING_LOOKBACK_DAYS,
    priceSeries,
    smaShortPeriod: hasTrend ? smaShortPeriod : null,
    smaShortValue,
    smaLongPeriod: smaLongValue !== null ? smaLongPeriod : null,
    smaLongValue,
    rsiPeriod: rsiValue !== null ? rsiPeriod : null,
    rsiValue,
    narrative,
    actionBias: { direction, label, note: t.actionNote(label) },
    error: null,
  };
}
