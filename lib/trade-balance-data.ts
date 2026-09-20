import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import { quarterToDate, getGrowthFreshness } from "@/lib/growth-data";

// Trade Balance (Current Account Balance, IMF Balance of Payments) --
// monitor only, same precedent as Gold in lib/commodity-data.ts: track
// and display it, but don't feed it into the Core FX Score until there's
// been time to judge whether it actually adds signal. Australia and
// Thailand only (per request) -- AUD is a classic commodity-export
// currency and THB leans heavily on tourism/goods exports, so a
// current-account swing is at least plausibly informative for both.
//
// Tested against this project's own historical data (2026-09-18, see
// AUDTHB-historical-analysis-2026-09.md "round four"): Thailand's CAB change
// doesn't correlate with AUD/THB (r=-0.05, unstable sign across the
// sample). Australia's is borderline (r=-0.17, stable direction) but the
// sign runs opposite the naive "better current account -> stronger
// currency" intuition, and the period where it's strongest (2019-2021)
// coincides with the iron ore price surge already captured by the
// Commodity factor -- plausibly the same signal counted twice, not an
// independent one. Staying monitor-only rather than acting on a
// borderline, possibly-confounded correlation.

export const TRADE_BALANCE_METRIC_CODE = "BOP_CAB_USD";

const COUNTRIES = ["AUS", "THA"];

type CsvRow = Record<string, string>;

// IMF BOP dataflow (IMF.STA:BOP(21.0.0)) CSV columns -- distinct from
// the QNEA (GDP) columns in growth-data.ts's parser, so this needs its
// own header check rather than reusing parseGrowthCsv.
export function parseTradeBalanceCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      record.push(field.trim()); field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field.trim()); field = "";
      if (record.some(Boolean)) records.push(record);
      record = [];
    } else field += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  const headers = records.shift() ?? [];
  for (const key of ["COUNTRY", "BOP_ACCOUNTING_ENTRY", "INDICATOR", "UNIT", "FREQUENCY", "TIME_PERIOD", "OBS_VALUE"]) {
    if (!headers.includes(key)) throw new Error(`Missing IMF BOP column: ${key}`);
  }
  return records.map((values) => {
    if (values.length !== headers.length) throw new Error("Invalid CSV column count");
    return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  });
}

export type TradeBalanceObservation = { country: string; period: string; value: number };

export function tradeBalanceObservations(rows: CsvRow[]): TradeBalanceObservation[] {
  const unique = new Map<string, TradeBalanceObservation>();
  for (const row of rows) {
    if (!COUNTRIES.includes(row.COUNTRY)) continue;
    if (row.BOP_ACCOUNTING_ENTRY !== "NETCD_T" || row.INDICATOR !== "CAB" ||
        row.UNIT !== "USD" || row.FREQUENCY !== "Q") continue;
    if (!/^\d{4}-Q[1-4]$/.test(row.TIME_PERIOD)) continue;
    const value = row.OBS_VALUE.trim() === "" ? NaN : Number(row.OBS_VALUE);
    if (!Number.isFinite(value)) continue;
    const item = { country: row.COUNTRY, period: row.TIME_PERIOD, value };
    unique.set(`${item.country}:${item.period}`, item);
  }
  return [...unique.values()];
}

type DbTradeBalanceRow = { country: string; reference_period: string; value: number | string };

const DB_COUNTRY_TO_IMF: Record<string, string> = { AU: "AUS", TH: "THA" };
const IMF_TO_LABEL: Record<string, string> = { AUS: "Australia", THA: "Thailand" };

function dateToQuarter(referencePeriod: string): string | null {
  const match = referencePeriod.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return null;
  const quarter = Math.floor((Number(match[2]) - 1) / 3) + 1;
  return `${match[1]}-Q${quarter}`;
}

export type TradeBalanceCountry = {
  country: string;
  label: string;
  latestPeriod: string | null;
  valueUsdBillions: number | null;
  freshness: ReturnType<typeof getGrowthFreshness>;
};

export async function getTradeBalanceData(): Promise<{
  status: "MONITOR_ONLY" | "UNAVAILABLE";
  countries: { australia: TradeBalanceCountry; thailand: TradeBalanceCountry };
  checkedAt: string;
  methodology: string;
  error: string | null;
}> {
  const checkedAt = new Date().toISOString();
  const methodology =
    "Current Account Balance (IMF Balance of Payments, BPM6, USD). Monitor only -- not yet part of the " +
    "Core FX Score. Quarterly data typically lags 1-2 quarters behind the calendar.";

  const buildCountry = (code: "AU" | "TH", observations: TradeBalanceObservation[]): TradeBalanceCountry => {
    const imfCode = DB_COUNTRY_TO_IMF[code];
    const series = observations
      .filter((o) => o.country === imfCode)
      .sort((a, b) => a.period.localeCompare(b.period));
    const latest = series.at(-1) ?? null;

    return {
      country: code,
      label: IMF_TO_LABEL[imfCode],
      latestPeriod: latest?.period ?? null,
      valueUsdBillions: latest ? Math.round((latest.value / 1_000_000_000) * 100) / 100 : null,
      freshness: getGrowthFreshness(latest?.period ?? null),
    };
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("trade_balance_observations")
      .select("country,reference_period,value")
      .eq("metric_code", TRADE_BALANCE_METRIC_CODE)
      .in("country", ["AU", "TH"])
      .order("reference_period", { ascending: false })
      .limit(20);

    if (error) throw new Error(`Trade balance DB error: ${error.message}`);

    const rows = (data ?? []) as DbTradeBalanceRow[];
    const observations: TradeBalanceObservation[] = [];
    for (const row of rows) {
      const country = DB_COUNTRY_TO_IMF[row.country];
      const period = dateToQuarter(row.reference_period);
      const value = Number(row.value);
      if (!country || !period || !Number.isFinite(value)) continue;
      observations.push({ country, period, value });
    }

    return {
      status: observations.length > 0 ? "MONITOR_ONLY" : "UNAVAILABLE",
      countries: {
        australia: buildCountry("AU", observations),
        thailand: buildCountry("TH", observations),
      },
      checkedAt,
      methodology,
      error: null,
    };
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      countries: {
        australia: buildCountry("AU", []),
        thailand: buildCountry("TH", []),
      },
      checkedAt,
      methodology,
      error: error instanceof Error ? error.message : "Trade balance fetch failed",
    };
  }
}
