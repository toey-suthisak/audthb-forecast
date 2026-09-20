import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Forward-looking market consensus (forecast vs previous, backfilled with
// actual once released) for this week's AUD/USD HIGH-impact events, plus
// a directional lean derived from a hand-curated polarity map (see
// POLARITY_RULES below). Events with no forecast/previous (e.g. a
// speech) still show -- they're still worth knowing about -- just
// without a lean, since there's nothing to compare.
//
// ForexFactory's own site shows a "Usual Effect" note per event (e.g.
// "higher than expected is good for the currency") -- that would be the
// real polarity source, but it only lives on each event's individual
// detail page, not the weekly XML export this project already uses.
// Scraping ~10 individual event pages a day is a materially different
// (and riskier) pattern than fetching one weekly export file once a day,
// and is exactly the "ToS/reliability risk" event_calendar's own
// migration already flagged. Encoding the well-known textbook polarity
// for a handful of common indicator types ourselves gets the same
// practical result without it -- these are standard macro relationships
// (higher employment growth is bullish, higher unemployment is bearish),
// not ForexFactory's own proprietary text, so said so honestly in the UI.

export type ConsensusLean = "BULLISH" | "BEARISH" | "NEUTRAL";
export type ConsensusLeanBasis = "actual_vs_forecast" | "forecast_vs_previous";

export type ConsensusEvent = {
  eventDate: string;
  currency: string;
  eventName: string;
  impact: "HIGH" | "MEDIUM";
  forecastValue: string | null;
  previousValue: string | null;
  actualValue: string | null;
  sourceUrl: string | null;
  lean: ConsensusLean | null;
  leanBasis: ConsensusLeanBasis | null;
};

type Polarity = "HIGHER_IS_BULLISH" | "HIGHER_IS_BEARISH";

// Deliberately narrow -- an indicator name that doesn't match one of
// these gets no lean at all (shown as raw numbers only) rather than a
// guessed one. CPI/inflation is the one genuinely debatable entry here
// (hotter inflation can also read as a cost-of-living negative); kept
// as the conventional "higher = more hawkish = bullish" reading used by
// most retail FX explainers, same simplification ForexFactory's own
// "Usual Effect" text uses for it.
const POLARITY_RULES: { pattern: RegExp; polarity: Polarity }[] = [
  { pattern: /unemployment rate|jobless claims|unemployment claims/i, polarity: "HIGHER_IS_BEARISH" },
  { pattern: /employment change|payrolls|nonfarm/i, polarity: "HIGHER_IS_BULLISH" },
  { pattern: /retail sales|\bgdp\b|\bpmi\b|consumer sentiment|business confidence|consumer confidence|industrial production/i, polarity: "HIGHER_IS_BULLISH" },
  { pattern: /\bcpi\b|inflation/i, polarity: "HIGHER_IS_BULLISH" },
];

function classifyPolarity(eventName: string): Polarity | null {
  for (const rule of POLARITY_RULES) {
    if (rule.pattern.test(eventName)) return rule.polarity;
  }
  return null;
}

// "20.9K" / "-15.8K" / "4.5%" / "47.5" -> a comparable number. Returns
// null on anything that doesn't parse cleanly rather than guessing.
function parseIndicatorValue(raw: string): number | null {
  const match = raw.trim().match(/^(-?[\d,.]+)\s*([KMB%]?)$/i);
  if (!match) return null;

  const num = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;

  const suffix = match[2].toUpperCase();
  if (suffix === "K") return num * 1e3;
  if (suffix === "M") return num * 1e6;
  if (suffix === "B") return num * 1e9;
  return num;
}

function computeLean(
  eventName: string,
  forecastValue: string | null,
  previousValue: string | null,
  actualValue: string | null,
): { lean: ConsensusLean; leanBasis: ConsensusLeanBasis } | null {
  const polarity = classifyPolarity(eventName);
  if (!polarity) return null;

  // Prefer the real surprise (actual vs forecast) once released;
  // otherwise fall back to the expected direction of change
  // (forecast vs previous) as a forward-looking read.
  const basis: ConsensusLeanBasis | null =
    actualValue !== null && forecastValue !== null
      ? "actual_vs_forecast"
      : forecastValue !== null && previousValue !== null
        ? "forecast_vs_previous"
        : null;
  if (!basis) return null;

  const [newer, older] = basis === "actual_vs_forecast" ? [actualValue!, forecastValue!] : [forecastValue!, previousValue!];
  const newerValue = parseIndicatorValue(newer);
  const olderValue = parseIndicatorValue(older);
  if (newerValue === null || olderValue === null) return null;

  if (newerValue === olderValue) return { lean: "NEUTRAL", leanBasis: basis };

  const isHigher = newerValue > olderValue;
  const isBullish = polarity === "HIGHER_IS_BULLISH" ? isHigher : !isHigher;
  return { lean: isBullish ? "BULLISH" : "BEARISH", leanBasis: basis };
}

type DbRow = {
  event_date: string;
  currency: string;
  event_name: string;
  impact: string;
  forecast_value: string | null;
  previous_value: string | null;
  actual_value: string | null;
  source_url: string | null;
};

function toConsensusEvent(row: DbRow): ConsensusEvent {
  const derived = computeLean(row.event_name, row.forecast_value, row.previous_value, row.actual_value);

  return {
    eventDate: row.event_date,
    currency: row.currency,
    eventName: row.event_name,
    impact: row.impact === "HIGH" ? "HIGH" : "MEDIUM",
    forecastValue: row.forecast_value,
    previousValue: row.previous_value,
    actualValue: row.actual_value,
    sourceUrl: row.source_url,
    lean: derived?.lean ?? null,
    leanBasis: derived?.leanBasis ?? null,
  };
}

export async function getEconomicConsensus(): Promise<{
  events: ConsensusEvent[];
  error: string | null;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("economic_consensus")
    .select("event_date,currency,event_name,impact,forecast_value,previous_value,actual_value,source_url")
    .gte("event_date", today)
    .lte("event_date", weekAhead)
    // HIGH only -- MEDIUM rows may still linger from before this filter
    // was narrowed; this excludes them defensively rather than relying
    // on the ingest route alone to have already dropped them.
    .eq("impact", "HIGH")
    .order("event_date", { ascending: true });

  if (error) {
    return { events: [], error: `Economic consensus DB error: ${error.message}` };
  }

  return { events: ((data ?? []) as DbRow[]).map(toConsensusEvent), error: null };
}
