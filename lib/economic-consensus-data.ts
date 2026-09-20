import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Forward-looking market consensus (forecast vs previous, backfilled with
// actual once released) for this week's AUD/USD high/medium-impact
// events. Deliberately shows the raw numbers, not a derived direction --
// see supabase migration 20260920_create_economic_consensus.sql for why.

export type ConsensusEvent = {
  eventDate: string;
  currency: string;
  eventName: string;
  impact: "HIGH" | "MEDIUM";
  forecastValue: string | null;
  previousValue: string | null;
  actualValue: string | null;
  sourceUrl: string | null;
};

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
  return {
    eventDate: row.event_date,
    currency: row.currency,
    eventName: row.event_name,
    impact: row.impact === "HIGH" ? "HIGH" : "MEDIUM",
    forecastValue: row.forecast_value,
    previousValue: row.previous_value,
    actualValue: row.actual_value,
    sourceUrl: row.source_url,
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
    // Only rows that actually have a forecast or previous value to show --
    // an event with neither (e.g. a speech) has nothing for a reader to
    // judge direction from.
    .or("forecast_value.not.is.null,previous_value.not.is.null")
    .order("event_date", { ascending: true });

  if (error) {
    return { events: [], error: `Economic consensus DB error: ${error.message}` };
  }

  return { events: ((data ?? []) as DbRow[]).map(toConsensusEvent), error: null };
}
