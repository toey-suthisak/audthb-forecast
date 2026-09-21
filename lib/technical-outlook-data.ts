import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Locale } from "@/lib/i18n";
import type { DashboardData } from "@/lib/dashboard-data";

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

export type TechnicalOutlook = {
  available: boolean;
  disclaimer: string;
  pivots: PivotLevels | null;
  swingHigh: number | null;
  swingLow: number | null;
  swingLookbackDays: number;
  narrative: string[];
  actionBias: {
    direction: "POSTFUND" | "PREFUND" | "NEUTRAL";
    label: string;
    note: string;
  };
  error: string | null;
};

type PriceRow = { rate: number | string; market_timestamp: string };
type DailyBar = { date: string; open: number; high: number; low: number; close: number };

function bangkokDateKey(isoTimestamp: string): string {
  const bangkokOffset = 7 * 60 * 60 * 1000;
  const bangkokTime = new Date(new Date(isoTimestamp).getTime() + bangkokOffset);
  return `${bangkokTime.getUTCFullYear()}-${String(bangkokTime.getUTCMonth() + 1).padStart(2, "0")}-${String(bangkokTime.getUTCDate()).padStart(2, "0")}`;
}

function buildDailyBars(rows: PriceRow[]): DailyBar[] {
  const byDay = new Map<string, PriceRow[]>();
  for (const row of rows) {
    const key = bangkokDateKey(row.market_timestamp);
    const list = byDay.get(key) ?? [];
    list.push(row);
    byDay.set(key, list);
  }

  const bars: DailyBar[] = [];
  for (const [date, dayRows] of byDay) {
    const sorted = [...dayRows].sort(
      (a, b) => new Date(a.market_timestamp).getTime() - new Date(b.market_timestamp).getTime(),
    );
    const rates = sorted.map((r) => Number(r.rate));
    bars.push({
      date,
      open: rates[0],
      close: rates[rates.length - 1],
      high: Math.max(...rates),
      low: Math.min(...rates),
    });
  }

  return bars.sort((a, b) => a.date.localeCompare(b.date));
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

// Supabase/PostgREST caps a query at 1000 rows regardless of .limit(),
// and AUD/THB runs ~140 rows/day -- 7 days safely fits under that cap
// with room as volume grows; a longer nominal lookback would just get
// silently truncated again (see the fetch below).
const SWING_LOOKBACK_DAYS = 7;

export async function getTechnicalOutlook(
  locale: Locale,
  dashboard: DashboardData,
): Promise<TechnicalOutlook> {
  const t = STR[locale];

  const empty = (error: string | null): TechnicalOutlook => ({
    available: false,
    disclaimer: t.disclaimer,
    pivots: null,
    swingHigh: null,
    swingLow: null,
    swingLookbackDays: SWING_LOOKBACK_DAYS,
    narrative: [],
    actionBias: { direction: "NEUTRAL", label: t.neutralAction, note: t.actionNote(t.neutralAction) },
    error,
  });

  const lookbackStart = new Date(Date.now() - (SWING_LOOKBACK_DAYS + 3) * 24 * 60 * 60 * 1000);

  // Ordered descending with an explicit limit, not ascending with the
  // implicit default -- Supabase/PostgREST caps unlimited queries at
  // 1000 rows, and AUD/THB alone runs ~140/day, so an ascending fetch
  // silently truncated before reaching today's rows (found live: the
  // pivot was computing off day-3-ago data with no error surfaced).
  const { data, error } = await supabaseAdmin
    .from("market_prices")
    .select("rate, market_timestamp")
    .eq("symbol", "AUD/THB")
    .gte("market_timestamp", lookbackStart.toISOString())
    .order("market_timestamp", { ascending: false })
    .limit(3000);

  if (error) return empty(`Technical outlook DB error: ${error.message}`);

  const bars = buildDailyBars((data ?? []) as PriceRow[]);
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

  return {
    available: true,
    disclaimer: t.disclaimer,
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
    narrative,
    actionBias: { direction, label, note: t.actionNote(label) },
    error: null,
  };
}
