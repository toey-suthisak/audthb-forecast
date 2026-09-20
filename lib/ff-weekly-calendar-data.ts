import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Full, unfiltered copy of ForexFactory's weekly calendar -- every
// currency and impact level. See supabase migration
// 20260920_create_ff_weekly_calendar.sql for why this is a separate
// table from economic_consensus (which is AUD/USD-scoped and drives the
// homepage's directional-lean feature).

export type FfCalendarEvent = {
  eventDate: string;
  eventTime: string | null;
  currency: string;
  eventName: string;
  impact: string;
  forecastValue: string | null;
  previousValue: string | null;
  actualValue: string | null;
  sourceUrl: string | null;
};

type DbRow = {
  event_date: string;
  event_time: string | null;
  currency: string;
  event_name: string;
  impact: string;
  forecast_value: string | null;
  previous_value: string | null;
  actual_value: string | null;
  source_url: string | null;
};

function toFfCalendarEvent(row: DbRow): FfCalendarEvent {
  return {
    eventDate: row.event_date,
    eventTime: row.event_time,
    currency: row.currency,
    eventName: row.event_name,
    impact: row.impact,
    forecastValue: row.forecast_value,
    previousValue: row.previous_value,
    actualValue: row.actual_value,
    sourceUrl: row.source_url,
  };
}

export async function getFfWeeklyCalendar(): Promise<{
  byDate: { date: string; events: FfCalendarEvent[] }[];
  fetchedAt: string | null;
  error: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("ff_weekly_calendar")
    .select("event_date,event_time,currency,event_name,impact,forecast_value,previous_value,actual_value,source_url,fetched_at")
    .order("event_date", { ascending: true });

  if (error) {
    return { byDate: [], fetchedAt: null, error: `Weekly calendar DB error: ${error.message}` };
  }

  const rows = (data ?? []) as (DbRow & { fetched_at: string })[];
  const fetchedAt = rows.length > 0 ? rows[0].fetched_at : null;

  const grouped = new Map<string, FfCalendarEvent[]>();
  for (const row of rows) {
    const event = toFfCalendarEvent(row);
    const bucket = grouped.get(event.eventDate);
    if (bucket) bucket.push(event);
    else grouped.set(event.eventDate, [event]);
  }

  const byDate = Array.from(grouped.entries())
    .map(([date, events]) => ({ date, events }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { byDate, fetchedAt, error: null };
}
