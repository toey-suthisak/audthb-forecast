import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { DashboardData, MarketRow } from "@/lib/dashboard-data";
import type { Locale } from "@/lib/i18n";

// =========================================================
// The v2 Data tab's "Data & Source Monitor" table + Data Health donut +
// Data Alerts + Source Status -- all derived from freshness/coverage
// fields DashboardData already computes (no new scoring logic), plus
// one small supplementary query for GBP/USD (tracked in market_prices
// since 2026-09-21 but not yet part of DashboardData/Core FX Score).
// =========================================================

export type DataRow = {
  key: string;
  label: string;
  value: string | null;
  updatedAt: string | null;
  source: string;
  status: string; // FRESH | DELAYED | STALE | MARKET_CLOSED | MISSING
};

export type SourceStatus = {
  name: string;
  operational: boolean;
};

export type DataHealth = {
  rows: DataRow[];
  coveragePct: number;
  alerts: string[];
  sources: SourceStatus[];
};

const STR = {
  en: {
    direct: "AUD/THB (Direct)",
    cross: "AUD/THB (Cross)",
    audUsd: "AUD/USD",
    usdThb: "USD/THB",
    usdCnh: "USD/CNH",
    usdSgd: "USD/SGD",
    gbpUsd: "GBP/USD",
    auYield: "AU 2Y Yield",
    usYield: "US 2Y Yield",
    ironOre: "Iron Ore",
    brent: "Brent (Live)",
    gold: "Gold",
    vixy: "Risk (VIXY)",
    macro: "Macro (AUD)",
    twelveData: "Twelve Data",
    dbnomics: "DBnomics",
    oilPriceApi: "OilPriceAPI",
    goldApi: "Gold-API",
    various: "Various (RBA/BOT/Fed/IMF)",
    alertMissing: (name: string) => `${name} data is not available right now.`,
    alertStale: (name: string) => `${name} data is stale.`,
    alertGoldNotScored: "Gold is tracked but not yet included in Core FX Score.",
    alertMacroDelayed: (pct: string) => `Macro coverage is only ${pct}/100 -- some series may be delayed.`,
  },
  th: {
    direct: "AUD/THB (Direct)",
    cross: "AUD/THB (Cross)",
    audUsd: "AUD/USD",
    usdThb: "USD/THB",
    usdCnh: "USD/CNH",
    usdSgd: "USD/SGD",
    gbpUsd: "GBP/USD",
    auYield: "ผลตอบแทนพันธบัตร AU 2 ปี",
    usYield: "ผลตอบแทนพันธบัตร US 2 ปี",
    ironOre: "แร่เหล็ก",
    brent: "เบรนท์ (เรียลไทม์)",
    gold: "ทองคำ",
    vixy: "ความเสี่ยง (VIXY)",
    macro: "Macro (AUD)",
    twelveData: "Twelve Data",
    dbnomics: "DBnomics",
    oilPriceApi: "OilPriceAPI",
    goldApi: "Gold-API",
    various: "หลายแหล่ง (RBA/BOT/Fed/IMF)",
    alertMissing: (name: string) => `ไม่มีข้อมูล ${name} ในตอนนี้`,
    alertStale: (name: string) => `ข้อมูล ${name} เก่าเกินไปแล้ว`,
    alertGoldNotScored: "ทองคำถูกเก็บข้อมูลไว้แล้ว แต่ยังไม่ถูกนำไปคิดคะแนน Core FX Score",
    alertMacroDelayed: (pct: string) => `ความครบถ้วนของ Macro มีแค่ ${pct}/100 -- บางชุดข้อมูลอาจมาช้า`,
  },
} as const;

function fmtRate(row: MarketRow | null, decimals = 4): string | null {
  if (!row) return null;
  return Number(row.rate).toFixed(decimals);
}

export async function getDataHealth(dashboard: DashboardData, locale: Locale): Promise<DataHealth> {
  const t = STR[locale];

  const { data: gbpRow } = await supabaseAdmin
    .from("market_prices")
    .select("rate, market_timestamp, source")
    .eq("symbol", "GBP/USD")
    .order("market_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows: DataRow[] = [
    {
      key: "direct",
      label: t.direct,
      value: fmtRate(dashboard.latestDirect),
      updatedAt: dashboard.latestDirect?.market_timestamp ?? null,
      source: t.twelveData,
      status: dashboard.directFreshness.status,
    },
    {
      key: "cross",
      label: t.cross,
      value: dashboard.crossRate !== null ? dashboard.crossRate.toFixed(4) : null,
      updatedAt: dashboard.crossTimestamp,
      source: t.twelveData,
      status: dashboard.crossStatus === "GOOD" ? "FRESH" : dashboard.crossStatus,
    },
    {
      key: "audUsd",
      label: t.audUsd,
      value: fmtRate(dashboard.latestAudUsd, 5),
      updatedAt: dashboard.latestAudUsd?.market_timestamp ?? null,
      source: t.twelveData,
      status: dashboard.audUsdFreshness.status,
    },
    {
      key: "usdThb",
      label: t.usdThb,
      value: fmtRate(dashboard.latestUsdThb),
      updatedAt: dashboard.latestUsdThb?.market_timestamp ?? null,
      source: t.twelveData,
      status: dashboard.usdThbFreshness.status,
    },
    {
      key: "usdCnh",
      label: t.usdCnh,
      value: fmtRate(dashboard.latestUsdCnh),
      updatedAt: dashboard.latestUsdCnh?.market_timestamp ?? null,
      source: t.twelveData,
      status: dashboard.usdCnhFreshness.status,
    },
    {
      key: "usdSgd",
      label: t.usdSgd,
      value: fmtRate(dashboard.latestUsdSgd),
      updatedAt: dashboard.latestUsdSgd?.market_timestamp ?? null,
      source: t.twelveData,
      status: dashboard.usdSgdFreshness.status,
    },
    {
      key: "gbpUsd",
      label: t.gbpUsd,
      value: gbpRow ? Number(gbpRow.rate).toFixed(5) : null,
      updatedAt: gbpRow?.market_timestamp ?? null,
      source: t.twelveData,
      status: gbpRow ? "FRESH" : "MISSING",
    },
    {
      key: "auYield",
      label: t.auYield,
      value: dashboard.latestYieldSnapshot ? `${Number(dashboard.latestYieldSnapshot.au_2y).toFixed(3)}%` : null,
      updatedAt: dashboard.latestYieldSnapshot?.au_reference_date ?? null,
      source: t.dbnomics,
      status: dashboard.yieldConfidence,
    },
    {
      key: "usYield",
      label: t.usYield,
      value: dashboard.latestYieldSnapshot ? `${Number(dashboard.latestYieldSnapshot.us_2y).toFixed(3)}%` : null,
      updatedAt: dashboard.latestYieldSnapshot?.us_reference_date ?? null,
      source: t.dbnomics,
      status: dashboard.yieldConfidence,
    },
    {
      key: "ironOre",
      label: t.ironOre,
      value: dashboard.ironOrePrice !== null ? dashboard.ironOrePrice.toFixed(2) : null,
      updatedAt: null,
      source: t.oilPriceApi,
      status: dashboard.ironOreFreshness,
    },
    {
      key: "brent",
      label: t.brent,
      value: dashboard.brentLivePrice !== null ? dashboard.brentLivePrice.toFixed(2) : null,
      updatedAt: null,
      source: t.oilPriceApi,
      status: dashboard.brentLiveFreshness,
    },
    {
      key: "gold",
      label: t.gold,
      value: dashboard.goldPrice !== null ? dashboard.goldPrice.toFixed(2) : null,
      updatedAt: null,
      source: t.goldApi,
      status: dashboard.goldFreshness,
    },
    {
      key: "vixy",
      label: t.vixy,
      value: dashboard.riskPrice !== null ? dashboard.riskPrice.toFixed(2) : null,
      updatedAt: null,
      source: t.twelveData,
      status: dashboard.riskFreshness,
    },
    {
      key: "macro",
      label: t.macro,
      value: dashboard.macroScore !== null ? String(dashboard.macroScore) : null,
      updatedAt: null,
      source: t.various,
      status: dashboard.macroCoverage >= 100 ? "FRESH" : dashboard.macroCoverage > 0 ? "DELAYED" : "MISSING",
    },
  ];

  const alerts: string[] = [];
  if (dashboard.riskFreshness === "MISSING") alerts.push(t.alertMissing(t.vixy));
  if (dashboard.goldFreshness === "MISSING") alerts.push(t.alertMissing(t.gold));
  alerts.push(t.alertGoldNotScored);
  if (dashboard.macroCoverage < 100) alerts.push(t.alertMacroDelayed(dashboard.macroCoverage.toFixed(1)));

  const bySource = new Map<string, DataRow[]>();
  for (const row of rows) {
    bySource.set(row.source, [...(bySource.get(row.source) ?? []), row]);
  }

  const sources: SourceStatus[] = Array.from(bySource.entries()).map(([name, sourceRows]) => ({
    name,
    operational: sourceRows.some((r) => r.status === "FRESH" || r.status === "DELAYED" || r.status === "HIGH" || r.status === "MEDIUM"),
  }));

  return {
    rows,
    coveragePct: dashboard.availableCoreWeight,
    alerts,
    sources,
  };
}
