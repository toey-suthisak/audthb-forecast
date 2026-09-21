import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import { FORECAST_VERSION, type ForecastHorizon } from "@/lib/forecast-data";

// =========================================================
// Performance tab's "Forecast vs Actual" chart + "Recent Forecast
// History" table -- both were already real rows in forecast_runs /
// forecast_outcomes (workflow C/D), just never rendered as a chart or
// table before. direction_correct/within_range are deliberately left
// null by the outcome job (see lib/evaluation-data.ts's own comment on
// why) -- within_range is derived here the same way, directly from
// actual_move_pct vs the stored predicted range.
// =========================================================

export type ForecastHistoryRow = {
  targetTime: string;
  horizon: ForecastHorizon;
  predictedDirection: string;
  referenceRate: number;
  predictedRate: number;
  rangeLowRate: number;
  rangeHighRate: number;
  actualRate: number;
  inRange: boolean;
};

type JoinedRow = {
  actual_rate: number | string;
  forecast_runs: {
    target_time: string;
    horizon: string;
    predicted_direction: string;
    predicted_move_pct: number | string;
    predicted_range_low_pct: number | string;
    predicted_range_high_pct: number | string;
    reference_rate: number | string | null;
  } | null;
};

export async function getForecastHistory(
  horizon: ForecastHorizon,
  limit = 12,
): Promise<{ rows: ForecastHistoryRow[]; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("forecast_outcomes")
    .select(
      "actual_rate, forecast_runs!inner(target_time, horizon, predicted_direction, predicted_move_pct, " +
        "predicted_range_low_pct, predicted_range_high_pct, reference_rate, forecast_version)",
    )
    .eq("status", "MATCHED")
    .eq("forecast_runs.horizon", horizon)
    .eq("forecast_runs.forecast_version", FORECAST_VERSION)
    .order("target_time", { ascending: false, referencedTable: "forecast_runs" })
    .limit(limit);

  if (error) {
    return { rows: [], error: `Forecast history query failed: ${error.message}` };
  }

  const rows: ForecastHistoryRow[] = ((data ?? []) as unknown as JoinedRow[])
    .filter((row): row is JoinedRow & { forecast_runs: NonNullable<JoinedRow["forecast_runs"]> } => row.forecast_runs !== null && row.forecast_runs.reference_rate !== null)
    .map((row) => {
      const fr = row.forecast_runs;
      const referenceRate = Number(fr.reference_rate);
      const actualRate = Number(row.actual_rate);
      const predictedMovePct = Number(fr.predicted_move_pct);
      const rangeLowPct = Number(fr.predicted_range_low_pct);
      const rangeHighPct = Number(fr.predicted_range_high_pct);

      const predictedRate = referenceRate * (1 + predictedMovePct / 100);
      const rangeLowRate = referenceRate * (1 + rangeLowPct / 100);
      const rangeHighRate = referenceRate * (1 + rangeHighPct / 100);

      return {
        targetTime: fr.target_time,
        horizon: fr.horizon as ForecastHorizon,
        predictedDirection: fr.predicted_direction,
        referenceRate,
        predictedRate,
        rangeLowRate: Math.min(rangeLowRate, rangeHighRate),
        rangeHighRate: Math.max(rangeLowRate, rangeHighRate),
        actualRate,
        inRange: actualRate >= Math.min(rangeLowRate, rangeHighRate) && actualRate <= Math.max(rangeLowRate, rangeHighRate),
      };
    })
    .sort((a, b) => new Date(b.targetTime).getTime() - new Date(a.targetTime).getTime());

  return { rows, error: null };
}
