import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// =========================================================
// CONFIG
// =========================================================

const RELATIVE_SYMBOLS = [
  "USD/CNH",
  "USD/SGD",
  // Added 2026-09-21 for a future USD Driver Chain view -- stored in
  // market_prices like the pair above, but not yet read by any scoring
  // or UI code (dashboard-data.ts's relativeMarketScore still only
  // queries USD/CNH/USD/SGD by name, so this addition is inert until a
  // reader is built). GBP/USD is a real Twelve Data FX pair, confirmed
  // live before adding.
  "GBP/USD",
] as const;

type RelativeSymbol =
  (typeof RELATIVE_SYMBOLS)[number];

// =========================================================
// TYPES
// =========================================================

type TwelveDataResponse = {
  status?: string;
  code?: number;
  message?: string;

  values?: Array<{
    datetime?: string;
    close?: string;
  }>;
};

type MarketObservation = {
  symbol: string;
  rate: number;
  marketTimestamp: string;
};

type SaveResult = {
  success: boolean;
  attempts: number;
  error: string | null;
};

// =========================================================
// SLEEP
// =========================================================

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

// =========================================================
// FRESHNESS
//
// Relative market cron = every 30 min
//
// <= 40 min  FRESH
// <= 70 min  DELAYED
// > 70 min   STALE
// =========================================================

function getFreshness(
  marketTimestamp: string
) {
  const marketTime =
    new Date(
      marketTimestamp
    ).getTime();

  const ageMinutes =
    Math.max(
      0,
      (Date.now() -
        marketTime) /
        (60 * 1000)
    );

  let freshness:
    | "FRESH"
    | "DELAYED"
    | "STALE";

  if (ageMinutes <= 40) {
    freshness = "FRESH";
  } else if (
    ageMinutes <= 70
  ) {
    freshness = "DELAYED";
  } else {
    freshness = "STALE";
  }

  return {
    ageMinutes:
      Number(
        ageMinutes.toFixed(1)
      ),

    freshness,
  };
}

// =========================================================
// TWELVE DATA
// =========================================================

async function fetchRate(
  symbol: RelativeSymbol,
  apiKey: string
): Promise<MarketObservation> {
  const params =
    new URLSearchParams({
      symbol,
      interval: "1min",
      outputsize: "1",
      timezone: "UTC",
      apikey: apiKey,
    });

  const url =
    `https://api.twelvedata.com/time_series?${params.toString()}`;

  const response =
    await fetch(url, {
      cache: "no-store",
    });

  if (!response.ok) {
    throw new Error(
      `Twelve Data HTTP ${response.status} for ${symbol}`
    );
  }

  const data =
    (await response.json()) as TwelveDataResponse;

  if (
    data.status === "error"
  ) {
    throw new Error(
      `Twelve Data ${symbol}: ${
        data.message ??
        "Unknown provider error"
      }`
    );
  }

  const latest =
    data.values?.[0];

  if (
    !latest?.datetime ||
    !latest?.close
  ) {
    throw new Error(
      `No market data returned for ${symbol}`
    );
  }

  const rate =
    Number(
      latest.close
    );

  if (
    !Number.isFinite(rate)
  ) {
    throw new Error(
      `Invalid rate for ${symbol}`
    );
  }

  const normalizedDatetime =
    latest.datetime.replace(
      " ",
      "T"
    );

  const timestamp =
    new Date(
      normalizedDatetime.endsWith(
        "Z"
      )
        ? normalizedDatetime
        : `${normalizedDatetime}Z`
    );

  if (
    Number.isNaN(
      timestamp.getTime()
    )
  ) {
    throw new Error(
      `Invalid timestamp for ${symbol}`
    );
  }

  return {
    symbol,
    rate,
    marketTimestamp:
      timestamp.toISOString(),
  };
}

// =========================================================
// SUPABASE RETRY
// =========================================================

async function saveWithRetry(
  rows: Array<{
    symbol: string;
    rate: number;
    market_timestamp: string;
    source: string;
  }>
): Promise<SaveResult> {
  const delays = [
    0,
    500,
    1500,
  ];

  let lastError:
    string | null = null;

  for (
    let attempt = 0;
    attempt <
    delays.length;
    attempt++
  ) {
    if (
      delays[attempt] >
      0
    ) {
      await sleep(
        delays[attempt]
      );
    }

    try {
      const { error } =
        await supabaseAdmin
          .from(
            "market_prices"
          )
          .upsert(
            rows,
            {
              onConflict:
                "symbol,market_timestamp",
            }
          );

      if (!error) {
        return {
          success: true,
          attempts:
            attempt + 1,
          error: null,
        };
      }

      lastError =
        error.message;

      console.warn(
        `relative market upsert attempt ${
          attempt + 1
        } failed:`,
        error.message
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Unknown database error";

      console.warn(
        `relative market upsert attempt ${
          attempt + 1
        } threw:`,
        lastError
      );
    }
  }

  return {
    success: false,
    attempts:
      delays.length,
    error:
      lastError ??
      "Database write failed",
  };
}

// =========================================================
// MAIN
// =========================================================

export async function GET(
  request: Request
) {
  // -------------------------------------------------------
  // AUTH
  // -------------------------------------------------------

  const authHeader =
    request.headers.get(
      "authorization"
    );

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (
    authHeader !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  // -------------------------------------------------------
  // ENV
  // -------------------------------------------------------

  const apiKey =
    process.env
      .TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing TWELVE_DATA_API_KEY",
      },
      {
        status: 500,
      }
    );
  }

  try {
    // =====================================================
    // FETCH PROVIDER
    // =====================================================

    const observations:
      MarketObservation[] =
      [];

    for (
      const symbol of
      RELATIVE_SYMBOLS
    ) {
      const observation =
        await fetchRate(
          symbol,
          apiKey
        );

      observations.push(
        observation
      );
    }

    // =====================================================
    // BUILD ROWS
    // =====================================================

    const rows =
      observations.map(
        (observation) => ({
          symbol:
            observation.symbol,

          rate:
            observation.rate,

          market_timestamp:
            observation.marketTimestamp,

          source:
            "twelvedata",
        })
      );

    // =====================================================
    // ONE DATABASE WRITE
    // + RETRY
    // =====================================================

    const saveResult =
      await saveWithRetry(
        rows
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    const results =
      rows.map((row) => {
        const freshness =
          getFreshness(
            row.market_timestamp
          );

        return {
          symbol:
            row.symbol,

          rate:
            row.rate,

          marketTimestamp:
            row.market_timestamp,

          ageMinutes:
            freshness.ageMinutes,

          freshness:
            freshness.freshness,

          saved:
            saveResult.success,

          error:
            saveResult.success
              ? null
              : saveResult.error,
        };
      });

    const allFresh =
      results.every(
        (item) =>
          item.freshness ===
          "FRESH"
      );

    return NextResponse.json({
      group:
        "relative-market",

      updated:
        saveResult.success,

      allFresh,

      expectedSymbols: [
        "USD/CNH",
        "USD/SGD",
        "GBP/USD",
      ],

      savedCount:
        saveResult.success
          ? rows.length
          : 0,

      failedCount:
        saveResult.success
          ? 0
          : rows.length,

      database: {
        attempts:
          saveResult.attempts,

        status:
          saveResult.success
            ? "OK"
            : "FAILED",

        error:
          saveResult.error,
      },

      results,
    });
  } catch (error) {
    console.error(
      "Relative market route error:",
      error
    );

    return NextResponse.json(
      {
        group:
          "relative-market",

        updated: false,

        allFresh: false,

        error:
          "Relative market update failed",

        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}