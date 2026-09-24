import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// =========================================================
// TYPES
// =========================================================

export type CommodityRow = {
  price: number | string;
  market_timestamp: string;
  source: string | null;
};

export type CommodityFreshness =
  | "FRESH"
  | "DELAYED"
  | "STALE"
  | "MISSING";

export type CommodityData = {
  gold: {
    latest: CommodityRow | null;
    change1H: number | null;
    freshness: CommodityFreshness;
    ageMinutes: number | null;
  };

  brentLive: {
    latest: CommodityRow | null;
    change1H: number | null;
    freshness: CommodityFreshness;
    ageMinutes: number | null;
    score: number | null;
  };

  ironOre: {
    latest: CommodityRow | null;
    change24H: number | null;
    freshness: CommodityFreshness;
    ageHours: number | null;

    score: number | null;

    maxInternalWeight: number;
    effectiveInternalWeight: number;
  };

  commodityScore: number | null;
  commodityCoverage: number;
  commodityEffectiveFxWeight: number;
};

// =========================================================
// CLOSEST HISTORICAL PRICE
// =========================================================

async function getClosestCommodityPrice(
  symbol: string,
  source: string | null,
  targetTime: number,
  toleranceMinutes: number
): Promise<CommodityRow | null> {
  const tolerance =
    toleranceMinutes *
    60 *
    1000;

  let query =
    supabaseAdmin
      .from("commodity_prices")
      .select(
        "price, market_timestamp, source"
      )
      .eq(
        "symbol",
        symbol
      )
      .gte(
        "market_timestamp",
        new Date(
          targetTime -
            tolerance
        ).toISOString()
      )
      .lte(
        "market_timestamp",
        new Date(
          targetTime +
            tolerance
        ).toISOString()
      );

  if (source) {
    query =
      query.eq(
        "source",
        source
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    console.error(
      `Commodity history error ${symbol}:`,
      error.message
    );

    return null;
  }

  if (
    !data ||
    data.length === 0
  ) {
    return null;
  }

  return data.reduce(
    (closest, row) => {
      const rowDiff =
        Math.abs(
          new Date(
            row.market_timestamp
          ).getTime() -
            targetTime
        );

      const closestDiff =
        Math.abs(
          new Date(
            closest.market_timestamp
          ).getTime() -
            targetTime
        );

      return rowDiff <
        closestDiff
        ? row
        : closest;
    }
  ) as CommodityRow;
}

// =========================================================
// LIVE FRESHNESS
//
// GOLD / BRENT
//
// Cron = every 60 minutes
// =========================================================

function getLiveFreshness(
  row: CommodityRow | null
): {
  status: CommodityFreshness;
  ageMinutes: number | null;
} {
  if (!row) {
    return {
      status: "MISSING",
      ageMinutes: null,
    };
  }

  const ageMinutes =
    Math.max(
      0,
      (
        Date.now() -
        new Date(
          row.market_timestamp
        ).getTime()
      ) /
        (60 * 1000)
    );

  if (ageMinutes <= 90) {
    return {
      status: "FRESH",
      ageMinutes,
    };
  }

  if (ageMinutes <= 180) {
    return {
      status: "DELAYED",
      ageMinutes,
    };
  }

  return {
    status: "STALE",
    ageMinutes,
  };
}

// =========================================================
// IRON ORE FRESHNESS
//
// We poll only twice per day.
//
// Maximum normal gap:
// 17:25 → 08:25 next day ≈ 15 hours
//
// <= 18H = FRESH
// <= 30H = DELAYED
// > 30H  = STALE
//
// This means "fresh enough for daily/regime signal",
// NOT intraday-live freshness.
// =========================================================

function getIronOreFreshness(
  row: CommodityRow | null
): {
  status: CommodityFreshness;
  ageHours: number | null;
  multiplier: number;
} {
  if (!row) {
    return {
      status: "MISSING",
      ageHours: null,
      multiplier: 0,
    };
  }

  const ageHours =
    Math.max(
      0,
      (
        Date.now() -
        new Date(
          row.market_timestamp
        ).getTime()
      ) /
        (
          60 *
          60 *
          1000
        )
    );

  if (ageHours <= 18) {
    return {
      status: "FRESH",
      ageHours,
      multiplier: 1,
    };
  }

  if (ageHours <= 30) {
    return {
      status: "DELAYED",
      ageHours,
      multiplier: 0.75,
    };
  }

  return {
    status: "STALE",
    ageHours,
    multiplier: 0,
  };
}

// =========================================================
// BRENT SCORE V1
//
// Brent ↑
// → Thailand energy import pressure ↑
// → THB pressure
// → AUD/THB positive
// =========================================================

function getBrentScore(
  change1H: number
) {
  if (change1H >= 1.5)
    return 100;

  if (change1H >= 1.0)
    return 75;

  if (change1H >= 0.5)
    return 50;

  if (change1H >= 0.25)
    return 25;

  if (change1H <= -1.5)
    return -100;

  if (change1H <= -1.0)
    return -75;

  if (change1H <= -0.5)
    return -50;

  if (change1H <= -0.25)
    return -25;

  return 0;
}

// =========================================================
// IRON ORE SCORE V1
//
// Iron Ore ↑
// → Australia export outlook/support ↑
// → AUD positive
// → AUD/THB positive
//
// DAILY / 24H SIGNAL
//
// Thresholds are provisional.
// Backtest later.
// =========================================================

function getIronOreScore(
  change24H: number
) {
  if (change24H >= 3)
    return 100;

  if (change24H >= 2)
    return 75;

  if (change24H >= 1)
    return 50;

  if (change24H >= 0.5)
    return 25;

  if (change24H <= -3)
    return -100;

  if (change24H <= -2)
    return -75;

  if (change24H <= -1)
    return -50;

  if (change24H <= -0.5)
    return -25;

  return 0;
}

// =========================================================
// MAIN
// =========================================================

export async function getCommodityData(): Promise<CommodityData> {
  const [
    goldResult,
    brentResult,
    ironOreResult,
  ] =
    await Promise.all([
      // GOLD
      supabaseAdmin
        .from(
          "commodity_prices"
        )
        .select(
          "price, market_timestamp, source"
        )
        .eq(
          "symbol",
          "GOLD_XAUUSD"
        )
        .order(
          "market_timestamp",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle(),

      // BRENT
      supabaseAdmin
        .from(
          "commodity_prices"
        )
        .select(
          "price, market_timestamp, source"
        )
        .eq(
          "symbol",
          "BRENT_LIVE_USD"
        )
        .eq(
          "source",
          "OilPriceAPI latest"
        )
        .order(
          "market_timestamp",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle(),

      // IRON ORE
      supabaseAdmin
        .from(
          "commodity_prices"
        )
        .select(
          "price, market_timestamp, source"
        )
        .eq(
          "symbol",
          "IRON_ORE_USD"
        )
        .eq(
          "source",
          "OilPriceAPI iron-ore"
        )
        .order(
          "market_timestamp",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle(),
    ]);

  // =====================================================
  // ROWS
  // =====================================================

  const goldLatest =
    goldResult.data as
      | CommodityRow
      | null;

  const brentLatest =
    brentResult.data as
      | CommodityRow
      | null;

  const ironOreLatest =
    ironOreResult.data as
      | CommodityRow
      | null;

  // =====================================================
  // FRESHNESS
  // =====================================================

  const goldFreshness =
    getLiveFreshness(
      goldLatest
    );

  const brentFreshness =
    getLiveFreshness(
      brentLatest
    );

  const ironOreFreshness =
    getIronOreFreshness(
      ironOreLatest
    );

  // =====================================================
  // GOLD 1H
  //
  // MONITOR ONLY
  // =====================================================

  let goldChange1H:
    | number
    | null = null;

  if (
    goldLatest &&
    goldFreshness.status ===
      "FRESH"
  ) {
    const latestTime =
      new Date(
        goldLatest.market_timestamp
      ).getTime();

    const past =
      await getClosestCommodityPrice(
        "GOLD_XAUUSD",
        null,
        latestTime -
          60 *
            60 *
            1000,
        45
      );

    if (past) {
      const current =
        Number(
          goldLatest.price
        );

      const previous =
        Number(
          past.price
        );

      if (
        Number.isFinite(
          current
        ) &&
        Number.isFinite(
          previous
        ) &&
        previous !== 0
      ) {
        goldChange1H =
          (
            (
              current -
              previous
            ) /
            previous
          ) *
          100;
      }
    }
  }

  // =====================================================
  // BRENT 1H
  // =====================================================

  let brentChange1H:
    | number
    | null = null;

  let brentScore:
    | number
    | null = null;

  if (
    brentLatest &&
    brentFreshness.status ===
      "FRESH"
  ) {
    const latestTime =
      new Date(
        brentLatest.market_timestamp
      ).getTime();

    const past =
      await getClosestCommodityPrice(
        "BRENT_LIVE_USD",
        "OilPriceAPI latest",
        latestTime -
          60 *
            60 *
            1000,
        20
      );

    if (past) {
      const current =
        Number(
          brentLatest.price
        );

      const previous =
        Number(
          past.price
        );

      if (
        Number.isFinite(
          current
        ) &&
        Number.isFinite(
          previous
        ) &&
        previous !== 0
      ) {
        brentChange1H =
          (
            (
              current -
              previous
            ) /
            previous
          ) *
          100;

        brentScore =
          getBrentScore(
            brentChange1H
          );
      }
    }
  }

  // =====================================================
  // IRON ORE 24H
  // =====================================================

  let ironOreChange24H:
    | number
    | null = null;

  let ironOreScore:
    | number
    | null = null;

  if (
    ironOreLatest &&
    ironOreFreshness.status !==
      "STALE" &&
    ironOreFreshness.status !==
      "MISSING"
  ) {
    const latestTime =
      new Date(
        ironOreLatest.market_timestamp
      ).getTime();

    // We already bootstrap provider's previous 24H price
    // into commodity_prices.
    //
    // Wide tolerance because this is a daily/regime factor.
    const past =
      await getClosestCommodityPrice(
        "IRON_ORE_USD",
        "OilPriceAPI iron-ore",
        latestTime -
          24 *
            60 *
            60 *
            1000,
        360
      );

    if (past) {
      const current =
        Number(
          ironOreLatest.price
        );

      const previous =
        Number(
          past.price
        );

      if (
        Number.isFinite(
          current
        ) &&
        Number.isFinite(
          previous
        ) &&
        previous !== 0
      ) {
        ironOreChange24H =
          (
            (
              current -
              previous
            ) /
            previous
          ) *
          100;

        ironOreScore =
          getIronOreScore(
            ironOreChange24H
          );
      }
    }
  }

  // =====================================================
  // IRON ORE EFFECTIVE INTERNAL WEIGHT
  //
  // Max = 45 (rebalanced from 50 after the Sep 2026 10-year correlation
  // study -- see AUDTHB-historical-analysis-2026-09.md. Iron Ore never
  // cleared statistical significance against AUD/THB at monthly
  // resolution in that study, unlike Brent, so it now carries less
  // internal weight than Brent instead of more.)
  //
  // FRESH    45
  // DELAYED  33.75
  // STALE     0
  // =====================================================

  const ironOreMaxInternalWeight =
    45;

  const ironOreEffectiveInternalWeight =
    ironOreScore !== null
      ? Number(
          (
            ironOreMaxInternalWeight *
            ironOreFreshness.multiplier
          ).toFixed(1)
        )
      : 0;

  // =====================================================
  // COMMODITY SCORE
  //
  // Active structure (rebalanced Sep 2026, MODEL_VERSION 1.1.0):
  //
  // Iron Ore 45
  // Brent    55
  //
  // These two now sum to 100 on their own -- Gold is excluded from the
  // split entirely (not just monitor-only with a reserved slice) since
  // the correlation study found ~zero relationship between Gold and
  // AUD/THB over 15 years. Full Iron Ore + Brent coverage now reaches
  // the full 10/10 top-level Commodity weight instead of capping at
  // 8/10 the way it did while 20 points sat reserved for Gold.
  // =====================================================

  const factors = [
    {
      score:
        ironOreScore,

      weight:
        ironOreEffectiveInternalWeight,
    },

    {
      score:
        brentScore,

      weight:
        brentScore !== null
          ? 55
          : 0,
    },
  ];

  const availableFactors =
    factors.filter(
      (factor) =>
        factor.score !==
          null &&
        factor.weight >
          0
    );

  const commodityCoverage =
    Number(
      availableFactors
        .reduce(
          (
            sum,
            factor
          ) =>
            sum +
            factor.weight,
          0
        )
        .toFixed(1)
    );

  let commodityScore:
    | number
    | null = null;

  if (
    commodityCoverage >
    0
  ) {
    const weightedTotal =
      availableFactors.reduce(
        (
          sum,
          factor
        ) =>
          sum +
          Number(
            factor.score
          ) *
            factor.weight,
        0
      );

    commodityScore =
      Math.round(
        weightedTotal /
          commodityCoverage
      );
  }

  // Commodity = 8% of Full FX Model (reduced from 10 in MODEL_VERSION
  // 1.1.0 -- see AUDTHB-historical-analysis-2026-09.md; the 2 points
  // moved to Risk/VIXY, whose correlation to AUD/THB was the strongest
  // and most stable found besides AUD/USD itself).
  const commodityEffectiveFxWeight =
    commodityScore !== null
      ? Number(
          (
            8 *
            (
              commodityCoverage /
              100
            )
          ).toFixed(2)
        )
      : 0;

  // =====================================================
  // RETURN
  // =====================================================

  return {
    gold: {
      latest:
        goldLatest,

      change1H:
        goldChange1H,

      freshness:
        goldFreshness.status,

      ageMinutes:
        goldFreshness.ageMinutes,
    },

    brentLive: {
      latest:
        brentLatest,

      change1H:
        brentChange1H,

      freshness:
        brentFreshness.status,

      ageMinutes:
        brentFreshness.ageMinutes,

      score:
        brentScore,
    },

    ironOre: {
      latest:
        ironOreLatest,

      change24H:
        ironOreChange24H,

      freshness:
        ironOreFreshness.status,

      ageHours:
        ironOreFreshness.ageHours,

      score:
        ironOreScore,

      maxInternalWeight:
        ironOreMaxInternalWeight,

      effectiveInternalWeight:
        ironOreEffectiveInternalWeight,
    },

    commodityScore,
    commodityCoverage,
    commodityEffectiveFxWeight,
  };
}