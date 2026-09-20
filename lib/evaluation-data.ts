import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Workflow E (see AUDTHB-project-status.md): compare the Forecast engine
// against baselines once forecast_outcomes has resolved rows. Written
// ahead of having real data -- with zero or few outcomes this returns
// insufficientData: true rather than a misleading stat, and starts
// producing real numbers automatically as the outcome-matching cron
// (workflow D) fills the table in.
//
// direction_correct and within_range are computed HERE, not read from
// forecast_outcomes -- the outcome job (see forecast-outcome route)
// deliberately leaves those two columns null, since the dead-zone
// policy they need belongs to this Evaluation phase. An earlier version
// of this file assumed the columns were already populated and read them
// directly, which meant every row silently evaluated as "incorrect"
// (null is falsy) -- direction accuracy would report 0% forever
// regardless of how good the model actually is. Fixed by deriving both
// from actual_move_pct / predicted_direction / predicted_range_*_pct,
// which this query already has (or now fetches) from forecast_runs.

// Below this sample size, any accuracy/MAE number is dominated by noise
// -- match the project's own rule (AUDTHB-project-status.md workflow F):
// show only that evaluation isn't ready yet, not a real percentage.
const MIN_SAMPLE_SIZE = 20;

// A move smaller than this is treated as "no real move" when deriving
// the baseline's own direction call from actual_move_pct -- the
// baseline has no score-based NEUTRAL threshold like the model does,
// so this stands in for one. Per-horizon because 1H/4H moves are much
// smaller than DAILY moves -- a single band would make short horizons
// call almost everything "no real move" (baseline artificially strong)
// or the opposite, depending which horizon it was actually sized for.
//
// DAILY: 0.10%, matching lib/backtest-data.ts's NEUTRAL_BAND_PCT, both
// derived from the real distribution of |daily move| across the
// 927-day RBA backtest (mean 0.394%, median 0.301%, p10 0.047%, p20
// 0.123%). 1H / 4H added 2026-09-20 against this project's own live
// AUD/THB feed (market_prices, 2026-09-11..20, ~9 days at 10-min
// resolution): mean |1H move| 0.042% (p10 0.004%, p20 0.009%), mean
// |4H move| 0.071% (p10 0.008%, p20 0.018%) -- bands set near each
// horizon's own p20, same logic as DAILY's, on much thinner evidence.
const BASELINE_NEUTRAL_BAND_PCT_BY_HORIZON: Record<string, number> = {
  "1H": 0.01,
  "4H": 0.02,
  DAILY: 0.1,
};
const DEFAULT_BASELINE_NEUTRAL_BAND_PCT = 0.1;

function neutralBandFor(horizon: string): number {
  return BASELINE_NEUTRAL_BAND_PCT_BY_HORIZON[horizon] ?? DEFAULT_BASELINE_NEUTRAL_BAND_PCT;
}

type MatchedOutcomeRow = {
  horizon: string;
  horizon_hours: number;
  forecast_version: string;
  predicted_direction: string;
  predicted_range_low_pct: number | string;
  predicted_range_high_pct: number | string;
  actual_move_pct: number | string;
  absolute_error_pct: number | string;
};

export type HorizonEvaluation = {
  horizon: string;
  horizonHours: number;
  forecastVersion: string;
  sampleSize: number;
  insufficientData: boolean;
  minSampleSize: number;

  model: {
    directionalAccuracy: number | null;
    mae: number | null;
    intervalCoverage: number | null;
  };

  baselineNoChange: {
    // "Always predict no move" -- correct only when the actual move
    // fell inside the neutral band; MAE of always guessing zero.
    directionalAccuracy: number | null;
    mae: number | null;
  };

  beatsBaseline: {
    directionally: boolean | null;
    onMae: boolean | null;
  };
};

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Same dead-zone the baseline uses to call its own "no real move" --
// a real move must clear this band before it counts as a direction,
// otherwise noise-sized moves would flip direction_correct at random.
function actualDirection(actualMovePct: number, neutralBandPct: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (actualMovePct > neutralBandPct) return "BULLISH";
  if (actualMovePct < -neutralBandPct) return "BEARISH";
  return "NEUTRAL";
}

function evaluateGroup(rows: MatchedOutcomeRow[]): HorizonEvaluation {
  const first = rows[0];
  const neutralBand = neutralBandFor(first.horizon);
  const sampleSize = rows.length;
  const insufficientData = sampleSize < MIN_SAMPLE_SIZE;

  const directionCorrectFlags = rows.map((r) =>
    actualDirection(toNumber(r.actual_move_pct), neutralBand) === r.predicted_direction ? 1 : 0,
  );
  const absErrors = rows.map((r) => toNumber(r.absolute_error_pct));
  const withinRangeFlags = rows.map((r) => {
    const actualMove = toNumber(r.actual_move_pct);
    const low = toNumber(r.predicted_range_low_pct);
    const high = toNumber(r.predicted_range_high_pct);
    return actualMove >= low && actualMove <= high ? 1 : 0;
  });

  const baselineCorrectFlags = rows.map((r) => {
    const actualMove = toNumber(r.actual_move_pct);
    return Math.abs(actualMove) <= neutralBand ? 1 : 0;
  });
  const baselineAbsErrors = rows.map((r) => Math.abs(toNumber(r.actual_move_pct)));

  const modelDirectionalAccuracy = insufficientData ? null : average(directionCorrectFlags);
  const modelMae = insufficientData ? null : average(absErrors);
  const baselineDirectionalAccuracy = insufficientData ? null : average(baselineCorrectFlags);
  const baselineMae = insufficientData ? null : average(baselineAbsErrors);

  return {
    horizon: first.horizon,
    horizonHours: first.horizon_hours,
    forecastVersion: first.forecast_version,
    sampleSize,
    insufficientData,
    minSampleSize: MIN_SAMPLE_SIZE,

    model: {
      directionalAccuracy: modelDirectionalAccuracy,
      mae: modelMae,
      intervalCoverage: insufficientData ? null : average(withinRangeFlags),
    },

    baselineNoChange: {
      directionalAccuracy: baselineDirectionalAccuracy,
      mae: baselineMae,
    },

    beatsBaseline: {
      directionally:
        modelDirectionalAccuracy !== null && baselineDirectionalAccuracy !== null
          ? modelDirectionalAccuracy > baselineDirectionalAccuracy
          : null,
      onMae:
        modelMae !== null && baselineMae !== null
          ? modelMae < baselineMae
          : null,
    },
  };
}

export async function getEvaluationSummary(): Promise<{
  groups: HorizonEvaluation[];
  totalMatchedOutcomes: number;
  methodology: string;
  error: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("forecast_outcomes")
    .select(
      "status, actual_move_pct, absolute_error_pct, " +
        "forecast_runs!inner(horizon, horizon_hours, forecast_version, predicted_direction, " +
        "predicted_range_low_pct, predicted_range_high_pct)",
    )
    .eq("status", "MATCHED");

  if (error) {
    return {
      groups: [],
      totalMatchedOutcomes: 0,
      methodology:
        "Compares the Forecast engine against a naive no-change baseline once forecast_outcomes " +
        "has resolved rows (workflow E). Needs at least " + MIN_SAMPLE_SIZE + " matched outcomes per " +
        "horizon/forecast_version group before reporting a real number.",
      error: `Evaluation query failed: ${error.message}`,
    };
  }

  type JoinedRow = {
    status: string;
    actual_move_pct: number | string;
    absolute_error_pct: number | string;
    forecast_runs: {
      horizon: string;
      horizon_hours: number;
      forecast_version: string;
      predicted_direction: string;
      predicted_range_low_pct: number | string;
      predicted_range_high_pct: number | string;
    };
  };

  const rows = ((data ?? []) as unknown as JoinedRow[]).map((row) => ({
    horizon: row.forecast_runs.horizon,
    horizon_hours: row.forecast_runs.horizon_hours,
    forecast_version: row.forecast_runs.forecast_version,
    predicted_direction: row.forecast_runs.predicted_direction,
    predicted_range_low_pct: row.forecast_runs.predicted_range_low_pct,
    predicted_range_high_pct: row.forecast_runs.predicted_range_high_pct,
    actual_move_pct: row.actual_move_pct,
    absolute_error_pct: row.absolute_error_pct,
  }));

  const groupKey = (r: MatchedOutcomeRow) => `${r.horizon}::${r.forecast_version}`;
  const groupedMap = new Map<string, MatchedOutcomeRow[]>();

  for (const row of rows) {
    const key = groupKey(row);
    const bucket = groupedMap.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      groupedMap.set(key, [row]);
    }
  }

  const groups = Array.from(groupedMap.values())
    .map(evaluateGroup)
    .sort((a, b) => a.horizon.localeCompare(b.horizon));

  return {
    groups,
    totalMatchedOutcomes: rows.length,
    methodology:
      `Baseline is "always predict no move": correct when |actual move| is within that horizon's neutral band ` +
      `(1H 0.01%, 4H 0.02%, DAILY 0.10%), MAE = average(|actual move|). Model stats come straight from forecast_outcomes ` +
      `(direction_correct / absolute_error_pct / within_range), computed by the outcome-matching job. ` +
      `Momentum baseline not implemented yet -- needs a price-history join this table doesn't have. ` +
      `Groups below ${MIN_SAMPLE_SIZE} matched outcomes report insufficientData instead of a number.`,
    error: null,
  };
}
