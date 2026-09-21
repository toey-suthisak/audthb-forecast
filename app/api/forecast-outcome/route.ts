import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// =========================================================
// SETTINGS
//
// A forecast's target_time passing does not mean an outcome
// exists yet -- absence of a forecast_outcomes row IS the
// pending state (see migration comment). We only insert once
// we have a final answer: MATCHED (found a price close enough
// to target_time) or MISSING (gave up after the grace period).
// =========================================================

const MATCH_TOLERANCE_MINUTES = 30;
const WIDE_SEARCH_TOLERANCE_MINUTES = 240;
const GRACE_PERIOD_HOURS = 3;
const BATCH_LIMIT = 100;

type PendingForecast = {
  id: number;
  target_time: string;
  reference_rate: number | string | null;
  predicted_move_pct: number | string | null;
};

type PricePoint = {
  rate: number | string;
  market_timestamp: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findClosestPrice(
  targetTime: number,
  toleranceMinutes: number,
): Promise<PricePoint | null> {
  const tolerance = toleranceMinutes * 60 * 1000;

  const { data } = await supabaseAdmin
    .from("market_prices")
    .select("rate, market_timestamp")
    .eq("symbol", "AUD/THB")
    .gte("market_timestamp", new Date(targetTime - tolerance).toISOString())
    .lte("market_timestamp", new Date(targetTime + tolerance).toISOString());

  if (!data || data.length === 0) return null;

  return data.reduce((closest: PricePoint | null, item) => {
    const itemDiff = Math.abs(new Date(item.market_timestamp).getTime() - targetTime);
    if (!closest) return item;
    const closestDiff = Math.abs(new Date(closest.market_timestamp).getTime() - targetTime);
    return itemDiff < closestDiff ? item : closest;
  }, null);
}

async function insertOutcome(row: Record<string, unknown>) {
  const delays = [0, 500, 1500];
  let lastError: string | null = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);

    try {
      // No onConflict handling here on purpose: forecast_outcomes has a
      // unique constraint on forecast_run_id and this job never revisits
      // a forecast it already wrote an outcome for (filtered out below),
      // so a genuine conflict here would mean a bug, not a normal retry.
      const { error } = await supabaseAdmin.from("forecast_outcomes").insert(row);
      if (!error) return { success: true, attempts: attempt + 1, error: null };
      lastError = error.message;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown database error";
    }
  }

  return { success: false, attempts: delays.length, error: lastError };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();

    // Excludes already-matched forecast_runs *inside the SQL query*
    // (see get_pending_forecast_outcomes migration, 2026-09-21) --
    // the previous version fetched the oldest BATCH_LIMIT due rows
    // first and filtered out already-matched ones after, so once the
    // backlog of due forecast_runs exceeded BATCH_LIMIT and the oldest
    // page was fully matched, every run kept re-fetching that same
    // exhausted page and silently did nothing, never reaching newer
    // unmatched forecasts.
    const { data: pendingForecasts, error: dueError } = await supabaseAdmin.rpc(
      "get_pending_forecast_outcomes",
      { p_before: new Date(now).toISOString(), p_limit: BATCH_LIMIT },
    );

    if (dueError) throw new Error(`get_pending_forecast_outcomes error: ${dueError.message}`);

    const pending = (pendingForecasts ?? []) as PendingForecast[];
    if (pending.length === 0) {
      return NextResponse.json({ checked: 0, matched: 0, missing: 0, skipped: 0 });
    }

    let matched = 0;
    let missing = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const forecast of pending) {
      const targetTime = new Date(forecast.target_time).getTime();
      const referenceRate =
        forecast.reference_rate !== null ? Number(forecast.reference_rate) : null;
      const predictedMovePct =
        forecast.predicted_move_pct !== null ? Number(forecast.predicted_move_pct) : null;

      const closePrice = await findClosestPrice(targetTime, MATCH_TOLERANCE_MINUTES);

      let matchedPrice = closePrice;
      let withinGracePeriod = now < targetTime + GRACE_PERIOD_HOURS * 60 * 60 * 1000;

      if (!matchedPrice && !withinGracePeriod) {
        // One last, wider attempt before conclusively giving up.
        matchedPrice = await findClosestPrice(targetTime, WIDE_SEARCH_TOLERANCE_MINUTES);
      }

      if (matchedPrice) {
        const actualRate = Number(matchedPrice.rate);
        const actualTimestamp = matchedPrice.market_timestamp;
        const timeGapMinutes =
          Math.abs(new Date(actualTimestamp).getTime() - targetTime) / 60000;

        const actualMovePct =
          referenceRate !== null && referenceRate !== 0
            ? Number((((actualRate - referenceRate) / referenceRate) * 100).toFixed(4))
            : null;

        const absoluteErrorPct =
          actualMovePct !== null && predictedMovePct !== null
            ? Number(Math.abs(predictedMovePct - actualMovePct).toFixed(4))
            : null;

        const result = await insertOutcome({
          forecast_run_id: forecast.id,
          target_time: forecast.target_time,
          status: "MATCHED",
          actual_rate: actualRate,
          actual_timestamp: actualTimestamp,
          time_gap_minutes: Number(timeGapMinutes.toFixed(2)),
          actual_move_pct: actualMovePct,
          absolute_error_pct: absoluteErrorPct,
          // direction_correct / within_range are intentionally left null
          // here -- they need a dead-zone/inclusion policy that belongs
          // to the Evaluation phase (step E), not to this outcome job.
        });

        if (result.success) matched++;
        else errors.push(`forecast_run_id ${forecast.id}: ${result.error}`);
      } else if (!withinGracePeriod) {
        const result = await insertOutcome({
          forecast_run_id: forecast.id,
          target_time: forecast.target_time,
          status: "MISSING",
        });

        if (result.success) missing++;
        else errors.push(`forecast_run_id ${forecast.id}: ${result.error}`);
      } else {
        // Still within the grace period -- leave pending, try again next run.
        skipped++;
      }
    }

    return NextResponse.json({
      checked: pending.length,
      matched,
      missing,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Forecast outcome error:", error);
    return NextResponse.json(
      {
        error: "Forecast outcome matching failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
