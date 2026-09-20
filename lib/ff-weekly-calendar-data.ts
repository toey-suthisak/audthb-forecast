import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Full, unfiltered copy of ForexFactory's weekly calendar -- every
// currency and impact level. See supabase migration
// 20260920_create_ff_weekly_calendar.sql for why this is a separate
// table from economic_consensus (which is AUD/USD/THB-scoped and
// drives the homepage's directional-lean feature).
//
// FF's own weekly export is documented (by the community tools that
// parse it -- FF itself doesn't state this in the feed) to use US
// Eastern wall-clock time. Converted here to a real UTC instant via
// Intl (so it's correct across the EDT/EST boundary with no manual DST
// table), then re-bucketed into Asia/Bangkok calendar days -- this
// project's own timezone -- for both the day tabs and each event's
// displayed time. An event with no time at all (a handful of
// day-long/no-specific-time entries) can't be converted -- it keeps
// its original FF date and no displayed time, rather than guessing a
// clock time that isn't there.

const SOURCE_TIME_ZONE = "America/New_York";
const DISPLAY_TIME_ZONE = "Asia/Bangkok";

export type FfCalendarEvent = {
  eventDate: string; // Asia/Bangkok calendar date, YYYY-MM-DD (or FF's own date if time-of-day is unknown)
  eventTime: string | null; // Asia/Bangkok wall-clock time (or FF's raw string if unconverted)
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

// Standard Intl-based zoned-wall-clock -> UTC conversion: guess UTC from
// the wall-clock numbers, find what that guess reads as in the source
// zone, and correct by the difference. No DST table needed -- the
// browser/Node ICU data already knows America/New_York's rules.
function getZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

function zonedWallClockToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}

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
  const clock = row.event_time ? parseFfClockTime(row.event_time) : null;

  let eventDate = row.event_date;
  let eventTime = row.event_time;
  let sortKey = Date.UTC(year, month - 1, day);

  if (clock) {
    const utc = zonedWallClockToUtc(year, month, day, clock.hour, clock.minute, SOURCE_TIME_ZONE);
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
