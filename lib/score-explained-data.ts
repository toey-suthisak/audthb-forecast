import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import { MODEL_VERSION, type DashboardData } from "@/lib/dashboard-data";
import {
  computeContributions,
  rawFactorsFromDashboard,
  rawFactorsFromSnapshot,
  type FactorKey,
} from "@/lib/score-factors";

// =========================================================
// Two related questions an analyst asks about today's Core FX Score,
// both answered from the exact same per-factor contribution math
// (lib/score-factors.ts), not two separate guesses:
//
//   "What changed since yesterday?" -- attribution: today's factor
//   contributions vs. the closest snapshot from ~24h ago (same
//   model_version, so a recalibration never reads as a market move).
//
//   "What's driving today?" -- regime: whichever factor's contribution
//   has the largest magnitude right now. If no factor clearly leads
//   (<35% of the total |contribution|), it's reported as MIXED rather
//   than forcing a single label on a genuinely balanced day.
// =========================================================

export type FactorAttribution = {
  key: FactorKey;
  currentScore: number | null;
  previousScore: number | null;
  currentContribution: number | null;
  previousContribution: number | null;
  delta: number | null;
};

export type RegimeKey = FactorKey | "MIXED";

export type ScoreExplained = {
  available: boolean;
  currentScore: number | null;
  attribution: {
    available: boolean;
    previousScore: number | null;
    scoreDelta: number | null;
    comparedToIssuedAt: string | null;
    hoursAgo: number | null;
    factors: FactorAttribution[];
  };
  regime: {
    key: RegimeKey;
    dominantSharePct: number | null;
  } | null;
  error: string | null;
};

const COMPARISON_LOOKBACK_HOURS = 24;
const REGIME_DOMINANCE_THRESHOLD_PCT = 35;

function round(value: number, decimals = 1): number {
  return Number(value.toFixed(decimals));
}

export async function getScoreExplained(dashboard: DashboardData): Promise<ScoreExplained> {
  const current = computeContributions(rawFactorsFromDashboard(dashboard));

  // Regime: the factor with the largest |contribution| today, unless no
  // factor clearly leads.
  let regime: ScoreExplained["regime"] = null;
  const withContribution = current.factors.filter((f) => f.contribution !== null);
  if (withContribution.length > 0) {
    const totalAbs = withContribution.reduce((sum, f) => sum + Math.abs(f.contribution as number), 0);
    if (totalAbs > 0) {
      const top = withContribution.reduce((a, b) =>
        Math.abs(a.contribution as number) >= Math.abs(b.contribution as number) ? a : b,
      );
      const sharePct = round((Math.abs(top.contribution as number) / totalAbs) * 100);
      regime = {
        key: sharePct >= REGIME_DOMINANCE_THRESHOLD_PCT ? top.key : "MIXED",
        dominantSharePct: sharePct,
      };
    }
  }

  const emptyAttribution: ScoreExplained["attribution"] = {
    available: false,
    previousScore: null,
    scoreDelta: null,
    comparedToIssuedAt: null,
    hoursAgo: null,
    factors: [],
  };

  const lookbackCutoff = new Date(Date.now() - COMPARISON_LOOKBACK_HOURS * 60 * 60 * 1000);

  // Closest snapshot to ~24h ago, same model version -- comparing across
  // a model_version change would mix different weight schemes and read
  // as a real market move when it's actually a recalibration.
  const { data, error } = await supabaseAdmin
    .from("fx_score_snapshots")
    .select("issued_at, core_fx_score, components")
    .eq("model_version", MODEL_VERSION)
    .lte("issued_at", lookbackCutoff.toISOString())
    .order("issued_at", { ascending: false })
    .limit(1);

  if (error) {
    return {
      available: true,
      currentScore: dashboard.coreFxScore,
      attribution: emptyAttribution,
      regime,
      error: `Score attribution query failed: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    // Not an error -- this model version just hasn't accumulated 24h of
    // history yet. Honest "not yet", same pattern as Track Record's
    // insufficientData.
    return { available: true, currentScore: dashboard.coreFxScore, attribution: emptyAttribution, regime, error: null };
  }

  type SnapshotRow = {
    issued_at: string;
    core_fx_score: number | null;
    components: Record<string, { score: number | null; weight: number }>;
  };
  const previous = data[0] as SnapshotRow;
  const prev = computeContributions(rawFactorsFromSnapshot(previous.components));

  const factors: FactorAttribution[] = current.factors.map((cf) => {
    const pf = prev.factors.find((f) => f.key === cf.key) ?? null;
    return {
      key: cf.key,
      currentScore: cf.score,
      previousScore: pf?.score ?? null,
      currentContribution: cf.contribution,
      previousContribution: pf?.contribution ?? null,
      delta:
        cf.contribution !== null && pf?.contribution !== null && pf?.contribution !== undefined
          ? round(cf.contribution - pf.contribution)
          : null,
    };
  });

  factors.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

  const hoursAgo = round((Date.now() - new Date(previous.issued_at).getTime()) / (60 * 60 * 1000));

  return {
    available: true,
    currentScore: dashboard.coreFxScore,
    attribution: {
      available: true,
      previousScore: previous.core_fx_score,
      scoreDelta:
        dashboard.coreFxScore !== null && previous.core_fx_score !== null
          ? dashboard.coreFxScore - previous.core_fx_score
          : null,
      comparedToIssuedAt: previous.issued_at,
      hoursAgo,
      factors,
    },
    regime,
    error: null,
  };
}
