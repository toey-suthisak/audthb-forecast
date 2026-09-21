import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { DashboardData } from "@/lib/dashboard-data";
import type { WatchlistItem } from "@/components/v2/WatchlistRow";

// Dashboard tab's "Related Markets" list. FX pairs and VIXY get a real
// sparkline from get_daily_price_bars (same server-side daily
// aggregation Technical Outlook uses, see supabase/migrations/
// 20260921_daily_price_bars_function.sql -- VIXY is stored in
// market_prices too, see lib/risk-data.ts). Commodities live in a
// separate commodity_prices table (lib/commodity-data.ts) with no
// equivalent SQL aggregation function, so bucketed here in JS instead --
// row counts are small (under 200 total per symbol currently), well
// under any row-cap concern. Yields come from yield_snapshots, already
// close to one row per real day.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bangkokDateKey(isoTimestamp: string): string {
  const bkk = new Date(new Date(isoTimestamp).getTime() + BANGKOK_OFFSET_MS);
  return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
}

async function dailyCloses(symbol: string, days = 30): Promise<number[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { data } = await supabaseAdmin.rpc("get_daily_price_bars", {
    p_symbol: symbol,
    p_since: since.toISOString(),
  });
  return ((data ?? []) as { close: number | string }[]).map((r) => Number(r.close));
}

async function dailyClosesFromCommodityPrices(symbol: string, days = 30): Promise<number[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { data } = await supabaseAdmin
    .from("commodity_prices")
    .select("price, market_timestamp")
    .eq("symbol", symbol)
    .gte("market_timestamp", since.toISOString())
    .order("market_timestamp", { ascending: true });

  const rows = (data ?? []) as { price: number | string; market_timestamp: string }[];
  const byDay = new Map<string, number>();
  for (const row of rows) {
    byDay.set(bangkokDateKey(row.market_timestamp), Number(row.price));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, price]) => price);
}

async function yieldSeries(field: "au_2y" | "us_2y", days = 30): Promise<number[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { data } = await supabaseAdmin
    .from("yield_snapshots")
    .select(`${field}, last_checked_at`)
    .gte("last_checked_at", since.toISOString())
    .order("last_checked_at", { ascending: true });

  const rows = (data ?? []) as unknown as Record<string, number | string>[];
  return rows.map((r) => Number(r[field]));
}

function pctChange(series: number[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

export async function getRelatedMarkets(dashboard: DashboardData): Promise<WatchlistItem[]> {
  const [audUsdSeries, usdThbSeries, gbpUsdSeries, vixySeries, ironOreSeries, brentSeries, goldSeries, auYieldSeries, usYieldSeries] =
    await Promise.all([
      dailyCloses("AUD/USD"),
      dailyCloses("USD/THB"),
      dailyCloses("GBP/USD"),
      dailyCloses("VIXY"),
      dailyClosesFromCommodityPrices("IRON_ORE_USD"),
      dailyClosesFromCommodityPrices("BRENT_LIVE_USD"),
      dailyClosesFromCommodityPrices("GOLD_XAUUSD"),
      yieldSeries("au_2y"),
      yieldSeries("us_2y"),
    ]);

  const items: WatchlistItem[] = [
    {
      label: "AUD/USD",
      value: dashboard.latestAudUsd ? Number(dashboard.latestAudUsd.rate).toFixed(5) : null,
      changePct: pctChange(audUsdSeries),
      series: audUsdSeries,
    },
    {
      label: "USD/THB",
      value: dashboard.latestUsdThb ? Number(dashboard.latestUsdThb.rate).toFixed(4) : null,
      changePct: pctChange(usdThbSeries),
      series: usdThbSeries,
    },
    {
      label: "GBP/USD",
      value: gbpUsdSeries.length > 0 ? gbpUsdSeries[gbpUsdSeries.length - 1].toFixed(5) : null,
      changePct: pctChange(gbpUsdSeries),
      series: gbpUsdSeries,
    },
    {
      label: "Iron Ore",
      value: dashboard.ironOrePrice !== null ? dashboard.ironOrePrice.toFixed(2) : null,
      changePct: pctChange(ironOreSeries),
      series: ironOreSeries,
    },
    {
      label: "Brent",
      value: dashboard.brentLivePrice !== null ? dashboard.brentLivePrice.toFixed(2) : null,
      changePct: pctChange(brentSeries),
      series: brentSeries,
    },
    {
      label: "Gold",
      value: dashboard.goldPrice !== null ? dashboard.goldPrice.toFixed(2) : null,
      changePct: pctChange(goldSeries),
      series: goldSeries,
    },
    {
      label: "VIXY",
      value: dashboard.riskPrice !== null ? dashboard.riskPrice.toFixed(2) : null,
      changePct: pctChange(vixySeries),
      series: vixySeries,
    },
    {
      label: "AU 2Y Yield",
      value: dashboard.latestYieldSnapshot ? `${Number(dashboard.latestYieldSnapshot.au_2y).toFixed(2)}%` : null,
      changePct: pctChange(auYieldSeries),
      series: auYieldSeries,
    },
    {
      label: "US 2Y Yield",
      value: dashboard.latestYieldSnapshot ? `${Number(dashboard.latestYieldSnapshot.us_2y).toFixed(2)}%` : null,
      changePct: pctChange(usYieldSeries),
      series: usYieldSeries,
    },
  ];

  return items;
}
