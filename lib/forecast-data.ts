import "server-only";

// Bump when the forecast rule itself changes -- independent of
// MODEL_VERSION (lib/dashboard-data.ts), which versions the score
// model that feeds this rule as an input. Bumped to 1.0.1 on
// 2026-09-20 when REFERENCE_DAILY_RANGE_PCT was recalibrated below --
// this resets Track Record's DAILY sample count to zero for the new
// version, deliberately: mixing pre/post-recalibration predicted
// values (and their range checks) under one accuracy number would be
// incoherent, not just imprecise. NOT bumped again when 1H/4H were
// added the same day -- DAILY's formula and output are unchanged, and
// 1H/4H are new horizons with no prior samples to protect.
export const FORECAST_VERSION = "1.0.1";

export type ForecastHorizon = "1H" | "4H" | "DAILY";

export const FORECAST_HORIZONS: ForecastHorizon[] = ["1H", "4H", "DAILY"];

type HorizonConfig = {
  hours: number;
  // Mean absolute move for this horizon, used purely as a move-size
  // *scale* for the linear score-to-move map below -- not a
  // statistically fitted prediction, and not a claim that Core FX
  // Score predicts direction or magnitude at that horizon.
  //
  // DAILY: calibrated 2026-09-20 against the 927-day RBA backtest
  // (mean absolute daily move 0.394%, see backtest_daily_rates).
  // 1H / 4H: this project has no free historical intraday source, so
  // these are calibrated against this project's own live AUD/THB
  // Direct feed instead (market_prices, 2026-09-11..20, ~9 days at
  // 10-min resolution: mean |1H move| 0.042%, mean |4H move| 0.071%).
  // Much thinner evidence than DAILY's 927 days -- revisit once more
  // history accumulates.
  referenceRangePct: number;
};

export const HORIZON_CONFIG: Record<ForecastHorizon, HorizonConfig> = {
  "1H": { hours: 1, referenceRangePct: 0.04 },
  "4H": { hours: 4, referenceRangePct: 0.07 },
  DAILY: { hours: 24, referenceRangePct: 0.39 },
};

export type ForecastDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export type Forecast = {
  horizon: ForecastHorizon;
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
// magnitude out of the horizon's reference range. A score of +/-100
// maps to the full reference range; 0 maps to no expected move. The
// range band is a fixed +/- referenceRangePct around the point
// estimate, not a statistically derived confidence interval. Same
// rule shape for every horizon -- only the reference range differs.
export function buildForecast(
  horizon: ForecastHorizon,
  coreFxScore: number,
  referenceRate: number | null,
): Forecast {
  const { referenceRangePct } = HORIZON_CONFIG[horizon];

  const predictedMovePct =
    Number(((coreFxScore / 100) * referenceRangePct).toFixed(4));

  return {
    horizon,
    predictedDirection: directionFromScore(coreFxScore),
    predictedMovePct,
    predictedRangeLowPct: Number((predictedMovePct - referenceRangePct).toFixed(4)),
    predictedRangeHighPct: Number((predictedMovePct + referenceRangePct).toFixed(4)),
    methodology:
      `UNCALIBRATED linear formula (${horizon}): predictedMovePct = (coreFxScore/100) * ${referenceRangePct}% ` +
      `(move-size scale calibrated against ${horizon === "DAILY" ? "the 927-day RBA backtest's mean absolute daily move, 0.394%" : "this project's own live intraday feed"} -- ` +
      `see backtest_daily_rates / market_prices). Direction uses the existing Core FX Score bias thresholds (>=15 BULLISH, ` +
      `<=-15 BEARISH). The scale is real; whether Core FX Score itself predicts direction or magnitude at this horizon is ` +
      `not yet tested -- do not treat this as a real probability or confidence estimate. ` +
      (referenceRate !== null
        ? `Reference rate ${referenceRate} at run time.`
        : "No reference rate was available at run time."),
  };
}
