import "server-only";
import type { DashboardData } from "@/lib/dashboard-data";

// The same 7 factors and weights lib/dashboard-data.ts sums into
// coreFxScore (see its own "CORE FX SCORE" comment: Price 35, Cross 20,
// Relative Market 15, Commodity 10, Risk 5, Mean Reversion 5, Macro 10).
// Read here from DashboardData's already-computed fields, never
// re-derived independently -- so a "contribution" below can never drift
// from the real weighted-average formula it decomposes.
export type FactorKey =
  | "priceMomentum"
  | "crossCurrency"
  | "relativeMarket"
  | "commodity"
  | "meanReversion"
  | "macro"
  | "risk";

export const FACTOR_KEYS: FactorKey[] = [
  "priceMomentum",
  "crossCurrency",
  "relativeMarket",
  "commodity",
  "meanReversion",
  "macro",
  "risk",
];

export type RawFactor = { key: FactorKey; score: number | null; weight: number };

export type FactorContribution = RawFactor & {
  // score * weight / availableWeight -- same unit as coreFxScore, and
  // sum(contribution) across all factors equals coreFxScore exactly
  // (modulo rounding), since that's literally how coreFxScore is built.
  contribution: number | null;
};

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

export function computeContributions(raw: RawFactor[]): {
  factors: FactorContribution[];
  availableWeight: number;
} {
  const availableWeight = raw.reduce((sum, f) => sum + (f.score !== null ? f.weight : 0), 0);

  const factors: FactorContribution[] = raw.map((f) => ({
    ...f,
    contribution:
      f.score !== null && availableWeight > 0 ? round((f.score * f.weight) / availableWeight) : null,
  }));

  return { factors, availableWeight };
}

export function rawFactorsFromDashboard(dashboard: DashboardData): RawFactor[] {
  return [
    { key: "priceMomentum", score: dashboard.priceMomentumScore, weight: dashboard.priceMomentumScore !== null ? 35 : 0 },
    { key: "crossCurrency", score: dashboard.crossCurrencyScore, weight: dashboard.crossCurrencyScore !== null ? 20 : 0 },
    { key: "relativeMarket", score: dashboard.relativeMarketScore, weight: dashboard.relativeMarketEffectiveWeight },
    { key: "commodity", score: dashboard.commodityScore, weight: dashboard.commodityEffectiveFxWeight },
    { key: "meanReversion", score: dashboard.meanReversionScore, weight: dashboard.meanReversionScore !== null ? 5 : 0 },
    { key: "macro", score: dashboard.macroScore, weight: dashboard.macroEffectiveFxWeight },
    { key: "risk", score: dashboard.riskScore, weight: dashboard.riskEffectiveWeight },
  ];
}

type SnapshotComponents = Record<string, { score: number | null; weight: number } | undefined>;

export function rawFactorsFromSnapshot(components: SnapshotComponents): RawFactor[] {
  return FACTOR_KEYS.map((key) => ({
    key,
    score: components[key]?.score ?? null,
    weight: components[key]?.weight ?? 0,
  }));
}
