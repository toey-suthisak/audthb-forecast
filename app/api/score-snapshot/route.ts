import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDashboardData, MODEL_VERSION } from "@/lib/dashboard-data";
import { buildForecast, FORECAST_HORIZONS, FORECAST_VERSION, HORIZON_CONFIG } from "@/lib/forecast-data";

// =========================================================
// RUN SLOT
//
// Idempotency key floors wall-clock time to the top of the
// hour this job is scheduled at. Retrying within the same
// hour must land on the same slot, not create a new row.
// =========================================================

function currentRunSlot(): string {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0
    )
  ).toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =========================================================
// SAVE (INSERT-ONLY -- NEVER OVERWRITE A PAST SNAPSHOT)
// =========================================================

async function upsertImmutable(
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
) {
  const delays = [0, 500, 1500];
  let lastError: string | null = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);

    try {
      const { error } = await supabaseAdmin
        .from(table)
        .upsert(row, { onConflict, ignoreDuplicates: true });

      if (!error) return { success: true, attempts: attempt + 1, error: null };
      lastError = error.message;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown database error";
    }
  }

  return { success: false, attempts: delays.length, error: lastError };
}

// =========================================================
// MAIN
// =========================================================

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dashboard = await getDashboardData();
    const runSlot = currentRunSlot();

    const components = {
      macro: {
        score: dashboard.macroScore,
        weight: dashboard.macroEffectiveFxWeight,
        maxWeight: 10,
        coverage: dashboard.macroCoverage,
      },
      priceMomentum: {
        score: dashboard.priceMomentumScore,
        weight: dashboard.priceMomentumScore !== null ? 35 : 0,
        maxWeight: 35,
        score1H: dashboard.priceScore1H,
        score4H: dashboard.priceScore4H,
        change1H: dashboard.change1H,
        change4H: dashboard.change4H,
        freshness: dashboard.latestPriceFreshness.status,
      },
      crossCurrency: {
        score: dashboard.crossCurrencyScore,
        weight: dashboard.crossCurrencyScore !== null ? 20 : 0,
        maxWeight: 20,
        change1H: dashboard.crossCurrencyChange1H,
        status: dashboard.crossStatus,
      },
      relativeMarket: {
        score: dashboard.relativeMarketScore,
        weight: dashboard.relativeMarketEffectiveWeight,
        maxWeight: 15,
        coverage: dashboard.relativeMarketCoverage,
        yieldScore: dashboard.yieldScore,
        usdCnhScore: dashboard.usdCnhScore,
        usdSgdScore: dashboard.usdSgdScore,
      },
      commodity: {
        score: dashboard.commodityScore,
        weight: dashboard.commodityEffectiveFxWeight,
        maxWeight: 10,
        coverage: dashboard.commodityCoverage,
        ironOreScore: dashboard.ironOreScore,
        brentLiveScore: dashboard.brentLiveScore,
      },
      risk: {
        score: dashboard.riskScore,
        weight: dashboard.riskEffectiveWeight,
        maxWeight: 5,
        freshness: dashboard.riskFreshness,
        sessionOpen: dashboard.riskSessionOpen,
      },
      meanReversion: {
        score: dashboard.meanReversionScore,
        weight: dashboard.meanReversionScore !== null ? 5 : 0,
        maxWeight: 5,
        rangePosition: dashboard.rangePosition,
      },
    };

    const row = {
      run_slot: runSlot,
      model_version: MODEL_VERSION,

      symbol: "AUD/THB",
      market_timestamp: dashboard.latestPrice?.market_timestamp ?? null,
      rate: dashboard.latestPrice ? Number(dashboard.latestPrice.rate) : null,
      source: dashboard.latestPrice?.source ?? null,

      core_fx_score: dashboard.coreFxScore,
      core_bias: dashboard.coreBias,
      available_core_weight: dashboard.availableCoreWeight,

      components,
    };

    const database = await upsertImmutable(
      "fx_score_snapshots",
      row,
      "run_slot,model_version",
    );

    // Forecast is derived from this same run -- same run_slot, same
    // reference rate and score. No score means nothing to forecast.
    // One forecast_runs row is issued per horizon (1H, 4H, DAILY) each
    // time this cron fires, so short horizons accumulate a resolvable
    // Track Record sample much faster than DAILY ever could: a 1H
    // forecast resolves within the hour, so ~20 resolved samples (the
    // Evaluation minimum) land in under a day instead of DAILY's ~20.
    type ForecastEntry = {
      horizon: string;
      forecast: ReturnType<typeof buildForecast> | null;
      database: { status: string; attempts: number; error: string | null };
    };

    let forecastResults: ForecastEntry[] = FORECAST_HORIZONS.map((horizon) => ({
      horizon,
      forecast: null,
      database: { status: "SKIPPED", attempts: 0, error: null },
    }));

    if (dashboard.coreFxScore !== null) {
      const referenceRate = dashboard.latestPrice
        ? Number(dashboard.latestPrice.rate)
        : null;

      forecastResults = [];

      for (const horizon of FORECAST_HORIZONS) {
        const { hours } = HORIZON_CONFIG[horizon];
        const forecast = buildForecast(horizon, dashboard.coreFxScore, referenceRate);

        const targetTime = new Date(
          new Date(runSlot).getTime() + hours * 60 * 60 * 1000,
        ).toISOString();

        const forecastRow = {
          run_slot: runSlot,
          model_version: MODEL_VERSION,
          forecast_version: FORECAST_VERSION,

          horizon,
          horizon_hours: hours,
          target_time: targetTime,

          reference_rate: referenceRate,
          core_fx_score: dashboard.coreFxScore,

          predicted_direction: forecast.predictedDirection,
          predicted_move_pct: forecast.predictedMovePct,
          predicted_range_low_pct: forecast.predictedRangeLowPct,
          predicted_range_high_pct: forecast.predictedRangeHighPct,

          status: "UNCALIBRATED",
          methodology: forecast.methodology,
        };

        const forecastDatabase = await upsertImmutable(
          "forecast_runs",
          forecastRow,
          "run_slot,model_version,forecast_version,horizon",
        );

        forecastResults.push({
          horizon,
          forecast,
          database: {
            status: forecastDatabase.success ? "OK" : "FAILED",
            attempts: forecastDatabase.attempts,
            error: forecastDatabase.error,
          },
        });
      }
    }

    return NextResponse.json({
      updated: database.success,
      runSlot,
      modelVersion: MODEL_VERSION,
      coreFxScore: dashboard.coreFxScore,
      coreBias: dashboard.coreBias,
      database: {
        status: database.success ? "OK" : "FAILED",
        attempts: database.attempts,
        error: database.error,
      },
      forecasts: forecastResults,
    });
  } catch (error) {
    console.error("Score snapshot error:", error);
    return NextResponse.json(
      {
        updated: false,
        error: "Score snapshot failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
