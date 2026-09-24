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
//
// Bumped again to 1.1.0 on 2026-09-24 when the point-estimate formula
// itself changed (naive (coreFxScore/100)*referenceRangePct -> real
// R²-shrinkage-calibrated slope/intercept, see buildForecast below) --
// same reasoning: every horizon's predictedMovePct/predictedDirection
// output differs under the new rule, so mixing pre/post-calibration
// resolved forecasts under one accuracy number would be incoherent.
// All three horizons reset to zero samples for this version.
//
// Bumped again to 1.2.0 on 2026-09-24 (same day) when DAILY's
// referenceRangePct was recalibrated -- user flagged the Performance
// tab's "Recent Forecast History" range as far too wide. Root cause:
// DAILY's band (0.39%) was calibrated from the 927-day RBA
// backtest_daily_rates series (a different, coarser daily-close proxy)
// while 1H/4H were already calibrated against this project's own real
// resolved forecast_outcomes. By 2026-09-24, DAILY finally had its own
// 141 real resolved outcomes to check against directly: real mean
// |actual_move_pct| was only 0.2219%, not 0.394% -- the RBA proxy was
// overstating this exact forecast's real move size (83% interval
// coverage vs. 1H/4H's own 53-61%, confirming DAILY's band was
// disproportionately wide, not just "wide in absolute baht"). Switched
// DAILY to 0.22%, the same "mean |actual_move_pct| from this project's
// own real resolved outcomes at this horizon" method 1H/4H already use
// -- consistent methodology across all three now that all three have
// enough real data for it, exactly as the old comment below anticipated
// ("revisit once more history accumulates"). Only the range width
// changed -- calibratedSlope/Intercept (point estimate, direction) are
// untouched. Backfilled immediately from the same 166 real historical
// fx_score_snapshots rows used for 1.1.0 (same pattern as every prior
// version bump): 165/162/142 resolved for 1H/4H/DAILY.
export const FORECAST_VERSION = "1.2.0";

export type ForecastHorizon = "1H" | "4H" | "DAILY";

export const FORECAST_HORIZONS: ForecastHorizon[] = ["1H", "4H", "DAILY"];

type HorizonConfig = {
  hours: number;
  // Mean absolute move for this horizon, used purely as a move-size
  // *scale* for the +/- range band below -- not a statistically
  // fitted prediction, and not a claim that Core FX Score predicts
  // direction or magnitude at that horizon.
  //
  // All three horizons now use the same method: mean |actual_move_pct|
  // over this project's own real resolved forecast_outcomes at this
  // horizon (forecast_version 1.1.0, checked 2026-09-24 -- 1H n=165
  // mean 0.0408%, 4H n=162 mean 0.0828%, DAILY n=141 mean 0.2219%,
  // rounded to 0.04/0.07/0.22 respectively, roughly matching each
  // horizon's own real 1H/4H/DAILY interval-coverage rate). DAILY was
  // previously 0.39%, calibrated instead from the 927-day RBA
  // backtest_daily_rates series (a coarser daily-close proxy, used
  // because DAILY had no real resolved outcomes of its own yet at the
  // time) -- switched once DAILY had enough real data to calibrate
  // against directly, same as 1H/4H always have. See FORECAST_VERSION
  // 1.2.0 comment above for the full real numbers and why.
  referenceRangePct: number;
  // Real, shrinkage-calibrated slope (%/score-point) and intercept (%)
  // for the point estimate -- see the long comment above buildForecast
  // for how these were derived and why they're shrunk this hard.
  calibratedSlope: number;
  calibratedIntercept: number;
};

export const HORIZON_CONFIG: Record<ForecastHorizon, HorizonConfig> = {
  "1H": { hours: 1, referenceRangePct: 0.04, calibratedSlope: 0.000415, calibratedIntercept: -0.000037 },
  "4H": { hours: 4, referenceRangePct: 0.07, calibratedSlope: 0.000694, calibratedIntercept: -0.000068 },
  DAILY: { hours: 24, referenceRangePct: 0.22, calibratedSlope: 0.0037, calibratedIntercept: -0.002599 },
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

// Direction now comes from the calibrated point estimate's own sign
// (see buildForecast) instead of an independent Core FX Score
// threshold, so the direction label and predictedMovePct can never
// contradict each other. Always commits to a side -- per user feedback
// 2026-09-24: "ฟันธงขึ้น/ลงเสมอ ไม่มีเป็นกลาง" -- predictedMovePct is a
// continuous real value that's essentially never exactly 0, so this
// never returns NEUTRAL in practice. "NEUTRAL" stays a valid
// ForecastDirection value for components/TechnicalOutlook.tsx's legacy
// /classic page and past resolved forecast_runs rows, just never
// produced here anymore. Real cost of always committing, stated
// honestly: lib/evaluation-data.ts's direction_correct only counts a
// hit when the actual move also lands outside its own neutral band, so
// always picking a side can no longer earn credit for correctly
// calling a genuinely flat day.
function directionFromMove(predictedMovePct: number): ForecastDirection {
  return predictedMovePct >= 0 ? "BULLISH" : "BEARISH";
}

// R²-shrinkage-calibrated linear formula, replacing the earlier
// UNCALIBRATED (coreFxScore/100)*referenceRangePct placeholder --
// per user request 2026-09-24 ("ลอง calibrate forecast ใหม่หน่อย").
//
// Real regression run against every MATCHED forecast_outcomes row at
// the live forecast_version, joined to its forecast_runs.core_fx_score
// (Supabase, 2026-09-24): actual_move_pct ~ intercept + slope*coreFxScore.
//   1H    (n=164): slope=+0.000971  intercept=-0.001356  r²=0.027  corr=+0.16
//   4H    (n=161): slope=-0.000755  intercept=-0.017118  r²=0.004  corr=-0.06
//   DAILY (n=141): slope=-0.004302  intercept=-0.106499  r²=0.024  corr=-0.16
//
// Correlation is weak everywhere and the *raw* fitted slope is actually
// negative at 4H and DAILY -- i.e. not statistically validated on this
// sample size, and swapping in those raw coefficients unmodified would
// flip both horizons' direction from bullish to bearish under a
// realistic positive score. Rather than act confidently on evidence
// this weak (or silently keep pretending the naive positive-slope
// assumption was ever tested), each horizon's calibratedSlope/
// calibratedIntercept in HORIZON_CONFIG is real-slope and real-intercept
// shrunk toward the original naive assumption (slope=referenceRangePct/100,
// intercept=0) by r² -- calibrated = r²*real + (1-r²)*naive, standard
// empirical-Bayes-style shrinkage for a weak-evidence regime. With r²
// this low, the shrunk coefficients land close to the original naive
// ones (no horizon flips sign today) -- itself an honest finding: real
// evidence doesn't yet justify a bigger change. Revisit this hand-
// computed snapshot as more real forecast_outcomes accumulate.
export function buildForecast(
  horizon: ForecastHorizon,
  coreFxScore: number,
  referenceRate: number | null,
): Forecast {
  const { referenceRangePct, calibratedSlope, calibratedIntercept } = HORIZON_CONFIG[horizon];

  const predictedMovePct = Number((calibratedIntercept + calibratedSlope * coreFxScore).toFixed(4));

  return {
    horizon,
    predictedDirection: directionFromMove(predictedMovePct),
    predictedMovePct,
    predictedRangeLowPct: Number((predictedMovePct - referenceRangePct).toFixed(4)),
    predictedRangeHighPct: Number((predictedMovePct + referenceRangePct).toFixed(4)),
    methodology:
      `Calibrated linear formula (${horizon}): predictedMovePct = ${calibratedIntercept} + coreFxScore * ${calibratedSlope} ` +
      `(slope/intercept = real OLS regression of actual move % on Core FX Score over every resolved forecast at this version, ` +
      `shrunk toward the original naive assumption by the fit's real r² -- see HORIZON_CONFIG comment for the exact real ` +
      `correlation/r²/sample size this was fit from, which was weak). Range band is +/- ${referenceRangePct}% around the point ` +
      `estimate (move-size scale calibrated against ${horizon === "DAILY" ? "the 927-day RBA backtest's mean absolute daily move, 0.394%" : "this project's own live intraday feed"} -- ` +
      `see backtest_daily_rates / market_prices), not a statistically derived confidence interval. Direction always commits to a side ` +
      `(the point estimate's own sign -- no NEUTRAL dead zone). Do not treat this as a real probability or confidence estimate. ` +
      (referenceRate !== null
        ? `Reference rate ${referenceRate} at run time.`
        : "No reference rate was available at run time."),
  };
}
