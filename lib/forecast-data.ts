import "server-only";

// Bump when the forecast rule itself changes -- independent of
// MODEL_VERSION (lib/dashboard-data.ts), which versions the score
// model that feeds this rule as an input. Bumped to 1.0.1 on
// 2026-09-20 when REFERENCE_DAILY_RANGE_PCT was recalibrated below --
// this resets Track Record's DAILY sample count to zero for the new
// version, deliberately: mixing pre/post-recalibration predicted
// values (and their range checks) under one accuracy number would be
// incoherent, not just imprecise.
export const FORECAST_VERSION = "1.0.1";

export const HORIZON_HOURS = 24;

// Originally guessed from just 7 calendar days of AUD/THB history
// (2026-09-11..17, ~0.30% average daily range) when this rule was
// first written. Recalibrated 2026-09-20 against the actual 927-day
// RBA backtest (see backtest_daily_rates): mean absolute daily move is
// 0.394%, median 0.301%. Still used only as a move-size *scale* for an
// otherwise unfit linear map from Core FX Score to a predicted move --
// this fixes the scale to something real, it does not establish that
// Core FX Score actually predicts direction or magnitude. That
// requires enough forecast_outcomes history to test score-vs-actual-move
// correlation directly, which doesn't exist yet (~70 hourly score
// snapshots as of 2026-09-20, covering 3 days).
export const REFERENCE_DAILY_RANGE_PCT = 0.39;

export type ForecastDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export type Forecast = {
  predictedDirection: ForecastDirection;
  predictedMovePct: number;
  predictedRangeLowPct: number;
  predictedRangeHighPct: number;
  methodology: string;
};

// Reuses the exact Core FX Score bias thresholds already in
// lib/dashboard-data.ts (coreBias) rather than inventing new ones.
function directionFromScore(coreFxScore: number): ForecastDirection {
  if (coreFxScore >= 15) return "BULLISH";
  if (coreFxScore <= -15) return "BEARISH";
  return "NEUTRAL";
}

// UNCALIBRATED linear placeholder: predicted move scales with score
// magnitude out of the reference daily range. A score of +/-100 maps
// to the full reference range; 0 maps to no expected move. The range
// band is a fixed +/- REFERENCE_DAILY_RANGE_PCT around the point
// estimate, not a statistically derived confidence interval.
export function buildForecast(coreFxScore: number, referenceRate: number | null): Forecast {
  const predictedMovePct =
    Number(((coreFxScore / 100) * REFERENCE_DAILY_RANGE_PCT).toFixed(4));

  return {
    predictedDirection: directionFromScore(coreFxScore),
    predictedMovePct,
    predictedRangeLowPct: Number((predictedMovePct - REFERENCE_DAILY_RANGE_PCT).toFixed(4)),
    predictedRangeHighPct: Number((predictedMovePct + REFERENCE_DAILY_RANGE_PCT).toFixed(4)),
    methodology:
      `UNCALIBRATED linear formula: predictedMovePct = (coreFxScore/100) * ${REFERENCE_DAILY_RANGE_PCT}% ` +
      `(move-size scale calibrated against the 927-day RBA backtest's mean absolute daily move, 0.394% -- ` +
      `see backtest_daily_rates). Direction uses the existing Core FX Score bias thresholds (>=15 BULLISH, ` +
      `<=-15 BEARISH). The scale is real; whether Core FX Score itself predicts direction or magnitude is ` +
      `not yet tested -- do not treat this as a real probability or confidence estimate. ` +
      (referenceRate !== null
        ? `Reference rate ${referenceRate} at run time.`
        : "No reference rate was available at run time."),
  };
}
