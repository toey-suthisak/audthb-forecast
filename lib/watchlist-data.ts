import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { DashboardData } from "@/lib/dashboard-data";
import type { WatchlistItem } from "@/components/v2/WatchlistRow";

// Dashboard tab's "Related Markets" list. FX pairs get a real sparkline
// from get_daily_price_bars (same server-side daily aggregation
// Technical Outlook uses, see supabase/migrations/20260921_daily_price_
// bars_function.sql) -- one function call per symbol; other sources
// (commodities, risk, yields) reuse the 1H/24H change DashboardData
// already computes, with no sparkline series available for those yet.

async function dailyCloses(symbol: string, days = 14): Promise<number[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { data } = await supabaseAdmin.rpc("get_daily_price_bars", {
    p_symbol: symbol,
    p_since: since.toISOString(),
  });
  return ((data ?? []) as { close: number | string }[]).map((r) => Number(r.close));
}

function pctChange(series: number[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

export async function getRelatedMarkets(dashboard: DashboardData): Promise<WatchlistItem[]> {
  const [audUsdSeries, usdThbSeries, gbpUsdSeries] = await Promise.all([
    dailyCloses("AUD/USD"),
    dailyCloses("USD/THB"),
    dailyCloses("GBP/USD"),
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
      changePct: dashboard.ironOreChange24H,
      series: [],
    },
    {
      label: "Brent",
      value: dashboard.brentLivePrice !== null ? dashboard.brentLivePrice.toFixed(2) : null,
      changePct: dashboard.brentLiveChange1H,
      series: [],
    },
    {
      label: "Gold",
      value: dashboard.goldPrice !== null ? dashboard.goldPrice.toFixed(2) : null,
      changePct: dashboard.goldChange1H,
      series: [],
    },
    {
      label: "VIXY",
      value: dashboard.riskPrice !== null ? dashboard.riskPrice.toFixed(2) : null,
      changePct: dashboard.riskChange1H,
      series: [],
    },
    {
      label: "AU 2Y Yield",
      value: dashboard.latestYieldSnapshot ? `${Number(dashboard.latestYieldSnapshot.au_2y).toFixed(2)}%` : null,
      changePct: null,
      series: [],
    },
    {
      label: "US 2Y Yield",
      value: dashboard.latestYieldSnapshot ? `${Number(dashboard.latestYieldSnapshot.us_2y).toFixed(2)}%` : null,
      changePct: null,
      series: [],
    },
  ];

  return items;
}
