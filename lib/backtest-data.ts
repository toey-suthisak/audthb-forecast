import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Workflow J: a genuine historical backtest, separate from the live
// Track Record (Evaluation). Track Record grades the live Core FX Score
// against real outcomes as they resolve, so it only ever has a few
// weeks of history. This page instead replays two simple, honestly
// labeled daily strategies against 900+ days of AUD/THB closes -- it
// does NOT replay the live model, because the live model's heaviest
// factor (Price/Momentum) is built from 1H/4H intraday change, and no
// free historical source gives us that; only a daily fixing.
//
// Data: RBA's own published F11.1 daily exchange rate series (free
// CSV download, not an API call -- see AUDTHB-project-status.md and
// supabase/migrations/20260920_create_backtest_daily_rates.sql). RBA
// publishes AUD/THB directly, calculated the same way every day, so
// this is a clean, authoritative daily series with no key or quota.
//
// Same statistical framework as lib/evaluation-data.ts, so the numbers
// mean the same thing in both places: a move under NEUTRAL_BAND_PCT is
// "no real move," baseline is "always predict no move," and MAE is
// average absolute error against the actual move.
export const NEUTRAL_BAND_PCT = 0.02;
const MOMENTUM_WINDOW_DAYS = 5;

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

type DailyRate = {
  rate_date: string;
  aud_thb: number;
};

export type BacktestStrategyResult = {
  name: string;
  description: string;
  directionalAccuracy: number;
  mae: number;
  beatsBaselineDirectionally: boolean;
  beatsBaselineOnMae: boolean;
};

export type BacktestSummary = {
  sampleSize: number;
  dataFrom: string;
  dataTo: string;
  dataSource: string;
  baseline: {
    directionalAccuracy: number;
    mae: number;
  };
  strategies: BacktestStrategyResult[];
  error: string | null;
};

function direction(movePct: number): Direction {
  if (movePct > NEUTRAL_BAND_PCT) return "BULLISH";
  if (movePct < -NEUTRAL_BAND_PCT) return "BEARISH";
  return "NEUTRAL";
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function getBacktestSummary(): Promise<BacktestSummary> {
  const { data, error } = await supabaseAdmin
    .from("backtest_daily_rates")
    .select("rate_date, aud_thb")
    .order("rate_date", { ascending: true });

  const empty: BacktestSummary = {
    sampleSize: 0,
    dataFrom: "",
    dataTo: "",
    dataSource: "RBA F11.1 (Reserve Bank of Australia, daily)",
    baseline: { directionalAccuracy: 0, mae: 0 },
    strategies: [],
    error: null,
  };

  if (error) {
    return { ...empty, error: `Backtest query failed: ${error.message}` };
  }

  const rows = (data ?? []) as DailyRate[];

  if (rows.length < MOMENTUM_WINDOW_DAYS + 2) {
    return { ...empty, error: "Not enough historical rows loaded yet." };
  }

  const rates = rows.map((r) => Number(r.aud_thb));

  const actualMoves: number[] = [];
  const momentumMoves: number[] = [];

  for (let i = MOMENTUM_WINDOW_DAYS; i < rates.length - 1; i++) {
    const today = rates[i];
    const tomorrow = rates[i + 1];
    const past = rates[i - MOMENTUM_WINDOW_DAYS];

    actualMoves.push(((tomorrow - today) / today) * 100);
    momentumMoves.push(((today - past) / past) * 100);
  }

  const actualDirections = actualMoves.map(direction);

  const baselineCorrect = actualMoves.map((m) => (Math.abs(m) <= NEUTRAL_BAND_PCT ? 1 : 0));
  const baselineAbsErrors = actualMoves.map((m) => Math.abs(m));
  const baselineDirectionalAccuracy = average(baselineCorrect);
  const baselineMae = average(baselineAbsErrors);

  // Strategy A: bet the trailing move continues.
  const momentumDirections = momentumMoves.map(direction);
  const momentumCorrect = momentumDirections.map((d, i) => (d === actualDirections[i] ? 1 : 0));
  const momentumAbsErrors = momentumMoves.map((predicted, i) => Math.abs(predicted - actualMoves[i]));
  const momentumAccuracy = average(momentumCorrect);
  const momentumMae = average(momentumAbsErrors);

  // Strategy B: bet the trailing move reverts.
  const reversionDirections = momentumMoves.map((m) => direction(-m));
  const reversionCorrect = reversionDirections.map((d, i) => (d === actualDirections[i] ? 1 : 0));
  const reversionPredictedMoves = momentumMoves.map((m) => -m);
  const reversionAbsErrors = reversionPredictedMoves.map((predicted, i) => Math.abs(predicted - actualMoves[i]));
  const reversionAccuracy = average(reversionCorrect);
  const reversionMae = average(reversionAbsErrors);

  return {
    sampleSize: actualMoves.length,
    dataFrom: rows[0].rate_date,
    dataTo: rows[rows.length - 1].rate_date,
    dataSource: "RBA F11.1 (Reserve Bank of Australia, daily)",
    baseline: {
      directionalAccuracy: baselineDirectionalAccuracy,
      mae: baselineMae,
    },
    strategies: [
      {
        name: `${MOMENTUM_WINDOW_DAYS}-Day Momentum`,
        description: `Predicts tomorrow continues the same direction as the trailing ${MOMENTUM_WINDOW_DAYS} trading days.`,
        directionalAccuracy: momentumAccuracy,
        mae: momentumMae,
        beatsBaselineDirectionally: momentumAccuracy > baselineDirectionalAccuracy,
        beatsBaselineOnMae: momentumMae < baselineMae,
      },
      {
        name: `${MOMENTUM_WINDOW_DAYS}-Day Mean Reversion`,
        description: `Predicts tomorrow reverses the trailing ${MOMENTUM_WINDOW_DAYS} trading days' direction.`,
        directionalAccuracy: reversionAccuracy,
        mae: reversionMae,
        beatsBaselineDirectionally: reversionAccuracy > baselineDirectionalAccuracy,
        beatsBaselineOnMae: reversionMae < baselineMae,
      },
    ],
    error: null,
  };
}
