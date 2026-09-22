import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Locale } from "@/lib/i18n";

// =========================================================
// Real 3/6-month AUD/THB technicals (RSI(14)+MA50/MA200, MACD).
//
// The live TwelveData feed (market_prices) only has ~11 real days of
// AUD/THB history (ingestion started 2026-09-11) -- nowhere near
// enough for a 200-day moving average or a 6-month MACD. Rather than
// fabricate months of price history, this reuses backtest_daily_rates
// -- the same real, already-vetted RBA F11.1 official daily AUD/THB
// series the Performance tab's Backtest already replays strategies
// against (2023-01-03 onward, ~930+ real rows, topped up daily by
// app/api/backtest-update). It's a different real source than the
// live intraday feed (a daily official fixing, not tick data), so
// this module's numbers are labeled with that source explicitly and
// never blended with the live-feed-based Technical Levels/short SMA(5)
// /RSI(9) computed elsewhere in lib/technical-outlook-data.ts.
//
// Indicators are computed over the FULL real history first (so
// MA200/EMA26 have genuine lookback), then sliced down to the
// requested display window -- never the other way around, which would
// silently produce nulls for a window that's actually long enough.
// =========================================================

const STR = {
  en: {
    source: "RBA F11.1 (Reserve Bank of Australia, daily)",
    notEnoughData: "Not enough real RBA F11.1 history loaded yet.",
  },
  th: {
    source: "RBA F11.1 (ธนาคารกลางออสเตรเลีย, รายวัน)",
    notEnoughData: "ข้อมูล RBA F11.1 ย้อนหลังยังไม่พอ",
  },
} as const;

const RSI_PERIOD = 14;
const SMA_SHORT_PERIOD = 50;
const SMA_LONG_PERIOD = 200;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;

const PRICE_STUDY_MONTHS = 3;
const MACD_STUDY_MONTHS = 6;

export type PriceStudyPoint = {
  date: string;
  close: number;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
};

export type MacdStudyPoint = {
  date: string;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

export type LongTermTechnicals = {
  available: boolean;
  source: string;
  dataAsOfDate: string | null;
  currentPrice: number | null;
  currentSma50: number | null;
  currentSma200: number | null;
  currentRsi14: number | null;
  maBias: "GOLDEN" | "DEATH" | "NEUTRAL";
  priceStudy: PriceStudyPoint[];
  currentMacd: number | null;
  currentSignal: number | null;
  currentHistogram: number | null;
  macdBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  macdStudy: MacdStudyPoint[];
  error: string | null;
};

function round(v: number, decimals = 4): number {
  return Number(v.toFixed(decimals));
}

function rollingSma(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i + 1 < period) return null;
    let sum = 0;
    for (let j = i + 1 - period; j <= i; j++) sum += closes[j];
    return sum / period;
  });
}

// Same simple-average method as lib/technical-outlook-data.ts's
// relativeStrengthIndex -- one RSI formula used consistently across
// the whole app, just computed as a rolling series here instead of a
// single latest value.
function rollingRsi(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period) return null;
    let gains = 0;
    let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff;
      else losses += -diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  });
}

// Standard EMA, seeded with a plain SMA of the first `period` values
// (the common convention) -- operates on a plain, gap-free number[].
function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      let sum = 0;
      for (let j = i + 1 - period; j <= i; j++) sum += values[j];
      prev = sum / period;
    } else {
      const k = 2 / (period + 1);
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

function computeMacd(closes: number[]) {
  const emaFast = ema(closes, MACD_FAST);
  const emaSlow = ema(closes, MACD_SLOW);
  const macdFull: (number | null)[] = closes.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null,
  );

  const validStart = macdFull.findIndex((v) => v !== null);
  const signalFull: (number | null)[] = new Array(closes.length).fill(null);
  if (validStart !== -1) {
    const validMacd = macdFull.slice(validStart).map((v) => v as number);
    const signalValid = ema(validMacd, MACD_SIGNAL);
    for (let i = 0; i < signalValid.length; i++) signalFull[validStart + i] = signalValid[i];
  }

  const histogramFull: (number | null)[] = macdFull.map((v, i) =>
    v !== null && signalFull[i] !== null ? v - (signalFull[i] as number) : null,
  );

  return { macd: macdFull, signal: signalFull, histogram: histogramFull };
}

function monthsAgo(fromDate: Date, months: number): Date {
  const d = new Date(fromDate);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export async function getLongTermTechnicals(locale: Locale = "th"): Promise<LongTermTechnicals> {
  const t = STR[locale];

  const empty: LongTermTechnicals = {
    available: false,
    source: t.source,
    dataAsOfDate: null,
    currentPrice: null,
    currentSma50: null,
    currentSma200: null,
    currentRsi14: null,
    maBias: "NEUTRAL",
    priceStudy: [],
    currentMacd: null,
    currentSignal: null,
    currentHistogram: null,
    macdBias: "NEUTRAL",
    macdStudy: [],
    error: null,
  };

  const { data, error } = await supabaseAdmin
    .from("backtest_daily_rates")
    .select("rate_date, aud_thb")
    .order("rate_date", { ascending: true });

  if (error) return { ...empty, error: `long-term technicals DB error: ${error.message}` };

  const rows = (data ?? []) as { rate_date: string; aud_thb: number | string }[];
  if (rows.length < RSI_PERIOD + 2) return { ...empty, error: t.notEnoughData };

  const dates = rows.map((r) => r.rate_date);
  const closes = rows.map((r) => Number(r.aud_thb));

  const sma50Series = rollingSma(closes, SMA_SHORT_PERIOD);
  const sma200Series = rollingSma(closes, SMA_LONG_PERIOD);
  const rsiSeries = rollingRsi(closes, RSI_PERIOD);
  const { macd, signal, histogram } = computeMacd(closes);

  const latestIdx = closes.length - 1;
  const dataAsOfDate = dates[latestIdx];
  const currentPrice = closes[latestIdx];
  const currentSma50 = sma50Series[latestIdx];
  const currentSma200 = sma200Series[latestIdx];
  const currentRsi14 = rsiSeries[latestIdx] !== null ? round(rsiSeries[latestIdx] as number, 1) : null;

  let maBias: LongTermTechnicals["maBias"] = "NEUTRAL";
  if (currentSma50 !== null && currentSma200 !== null) {
    maBias = currentSma50 >= currentSma200 ? "GOLDEN" : "DEATH";
  }

  const currentMacd = macd[latestIdx] !== null ? round(macd[latestIdx] as number, 4) : null;
  const currentSignal = signal[latestIdx] !== null ? round(signal[latestIdx] as number, 4) : null;
  const currentHistogram = histogram[latestIdx] !== null ? round(histogram[latestIdx] as number, 4) : null;

  let macdBias: LongTermTechnicals["macdBias"] = "NEUTRAL";
  if (currentHistogram !== null) {
    macdBias = currentHistogram > 0 ? "BULLISH" : currentHistogram < 0 ? "BEARISH" : "NEUTRAL";
  }

  const latestDate = new Date(dataAsOfDate);
  const priceStudyStart = monthsAgo(latestDate, PRICE_STUDY_MONTHS).toISOString().slice(0, 10);
  const macdStudyStart = monthsAgo(latestDate, MACD_STUDY_MONTHS).toISOString().slice(0, 10);

  const priceStudy: PriceStudyPoint[] = [];
  const macdStudy: MacdStudyPoint[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (dates[i] >= priceStudyStart) {
      priceStudy.push({
        date: dates[i],
        close: round(closes[i]),
        sma50: sma50Series[i] !== null ? round(sma50Series[i] as number) : null,
        rsi14: rsiSeries[i] !== null ? round(rsiSeries[i] as number, 1) : null,
        sma200: sma200Series[i] !== null ? round(sma200Series[i] as number) : null,
      });
    }
    if (dates[i] >= macdStudyStart) {
      macdStudy.push({
        date: dates[i],
        macd: macd[i] !== null ? round(macd[i] as number, 4) : null,
        signal: signal[i] !== null ? round(signal[i] as number, 4) : null,
        histogram: histogram[i] !== null ? round(histogram[i] as number, 4) : null,
      });
    }
  }

  return {
    available: true,
    source: t.source,
    dataAsOfDate,
    currentPrice: round(currentPrice),
    currentSma50: currentSma50 !== null ? round(currentSma50) : null,
    currentSma200: currentSma200 !== null ? round(currentSma200) : null,
    currentRsi14,
    maBias,
    priceStudy,
    currentMacd,
    currentSignal,
    currentHistogram,
    macdBias,
    macdStudy,
    error: null,
  };
}
