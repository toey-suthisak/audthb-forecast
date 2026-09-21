import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Analysis tab's Correlation view: real Pearson correlation between
// AUD/THB's daily % change and each other real driver's daily % change,
// both built from get_daily_price_bars (same server-side daily
// aggregation Technical Outlook/Watchlist already use -- see
// supabase/migrations/20260921_daily_price_bars_function.sql). Gated on
// a minimum sample size the same way Evaluation gates Track Record --
// this project's price history only goes back to 2026-09-11, so today
// this correctly reports "not enough data yet" rather than a
// correlation computed on too few points to mean anything.

export type CorrelationRow = {
  symbol: string;
  label: string;
  correlation: number | null;
  sampleSize: number;
};

const MIN_SAMPLES = 15;

async function dailyPctChanges(symbol: string, days = 90): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { data } = await supabaseAdmin.rpc("get_daily_price_bars", {
    p_symbol: symbol,
    p_since: since.toISOString(),
  });
  const bars = ((data ?? []) as { bar_date: string; close: number | string }[]).map((r) => ({
    date: r.bar_date,
    close: Number(r.close),
  }));

  const changes = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    if (prev === 0) continue;
    changes.set(bars[i].date, ((bars[i].close - prev) / prev) * 100);
  }
  return changes;
}

function pearson(a: number[], b: number[]): number | null {
  if (a.length < 2 || a.length !== b.length) return null;
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

const DRIVERS: { symbol: string; label: string }[] = [
  { symbol: "AUD/USD", label: "AUD/USD" },
  { symbol: "USD/THB", label: "USD/THB" },
  { symbol: "USD/CNH", label: "USD/CNH" },
  { symbol: "USD/SGD", label: "USD/SGD" },
  { symbol: "GBP/USD", label: "GBP/USD" },
  { symbol: "VIXY", label: "VIXY (Risk)" },
];

export async function getCorrelations(): Promise<{ rows: CorrelationRow[]; minSamples: number }> {
  const audThbChanges = await dailyPctChanges("AUD/THB");

  const rows = await Promise.all(
    DRIVERS.map(async ({ symbol, label }) => {
      const driverChanges = await dailyPctChanges(symbol);
      const sharedDates = [...audThbChanges.keys()].filter((d) => driverChanges.has(d));

      if (sharedDates.length < MIN_SAMPLES) {
        return { symbol, label, correlation: null, sampleSize: sharedDates.length };
      }

      const a = sharedDates.map((d) => audThbChanges.get(d) as number);
      const b = sharedDates.map((d) => driverChanges.get(d) as number);

      return { symbol, label, correlation: pearson(a, b), sampleSize: sharedDates.length };
    }),
  );

  return { rows, minSamples: MIN_SAMPLES };
}
