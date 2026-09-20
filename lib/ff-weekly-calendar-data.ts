import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Full, unfiltered copy of ForexFactory's weekly calendar -- every
// currency and impact level. See supabase migration
// 20260920_create_ff_weekly_calendar.sql for why this is a separate
// table from economic_consensus (which is AUD/USD/THB-scoped and
// drives the homepage's directional-lean feature).
//
// FF's weekly export's raw date/time is plain UTC -- NOT US Eastern as
// widely assumed (including by an earlier version of this file, which
// treated it as America/New_York and was consistently 4 hours late
// against forexfactory.com's own displayed times, confirmed by direct
// comparison on 2026-09-20: e.g. "RBA Gov Bullock Speaks" reads 10:10am
// on FF's site vs the wrongly-converted 2:10pm here). Converted directly
// to Asia/Bangkok (+7h, no DST either side) for both the day tabs and
// each event's displayed time.
//
// Holiday-impact entries carry a dummy time in the feed (FF's own site
// shows them as "All Day", not that time) -- kept under their own raw
// UTC date with no displayed time, rather than day-shifting on a
// meaningless clock value.
//
// An event with no time at all can't be bucketed by time either -- it
// keeps its original UTC date and no displayed time.

const DISPLAY_TIME_ZONE = "Asia/Bangkok";

export type FfCalendarEvent = {
  eventDate: string; // Asia/Bangkok calendar date, YYYY-MM-DD (or the feed's own UTC date for Holiday/no-time entries)
  eventTime: string | null; // Asia/Bangkok wall-clock time, or null for Holiday/no-time entries
  currency: string;
  eventName: string;
  impact: string;
  forecastValue: string | null;
  previousValue: string | null;
  actualValue: string | null;
  sourceUrl: string | null;
  sortKey: number; // real UTC instant when known, for correct ordering within a Bangkok day
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

function parseFfClockTime(raw: string): { hour: number; minute: number } | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function bangkokDateKey(utc: Date): string {
  // en-CA formats as YYYY-MM-DD directly.
  return new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(utc);
}

function bangkokTimeLabel(utc: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(utc)
    .replace(" ", "")
    .toLowerCase();
}

function toFfCalendarEvent(row: DbRow): FfCalendarEvent {
  const [year, month, day] = row.event_date.split("-").map(Number);
  const isAllDay = row.impact === "Holiday";
  const clock = !isAllDay && row.event_time ? parseFfClockTime(row.event_time) : null;

  let eventDate = row.event_date;
  let eventTime: string | null = isAllDay ? null : row.event_time;
  let sortKey = Date.UTC(year, month - 1, day);

  if (clock) {
    const utc = new Date(Date.UTC(year, month - 1, day, clock.hour, clock.minute));
    eventDate = bangkokDateKey(utc);
    eventTime = bangkokTimeLabel(utc);
    sortKey = utc.getTime();
  }

  return {
    eventDate,
    eventTime,
    currency: row.currency,
    eventName: row.event_name,
    impact: row.impact,
    forecastValue: row.forecast_value,
    previousValue: row.previous_value,
    actualValue: row.actual_value,
    sourceUrl: row.source_url,
    sortKey,
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
    .map(([date, events]) => ({ date, events: events.sort((a, b) => a.sortKey - b.sortKey) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { byDate, fetchedAt, error: null };
}
