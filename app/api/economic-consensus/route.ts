import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// =========================================================
// SOURCE
//
// ForexFactory's public weekly calendar export. No API key, no
// official API -- their own page asks not to fetch more than once an
// hour ("can result in being blocked"). This cron runs once a day
// (see supabase/migrations for the schedule), comfortably under that.
// =========================================================

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
const RELEVANT_CURRENCIES = new Set(["AUD", "USD"]);
const RELEVANT_IMPACTS = new Set(["High", "Medium"]);

type ParsedEvent = {
  eventDate: string; // YYYY-MM-DD
  currency: string;
  eventName: string;
  impact: "HIGH" | "MEDIUM";
  forecastValue: string | null;
  previousValue: string | null;
  actualValue: string | null;
  sourceUrl: string | null;
};

// FF mixes plain-text tags (title, country) with CDATA-wrapped ones
// (date, impact, forecast, ...) in the same feed -- match either shape,
// falling back to whichever group actually captured something.
function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`));
  if (!match) return null;
  const value = match[1] ?? match[2];
  return value && value.trim() !== "" ? value.trim() : null;
}

// FF's own date format is "MM-DD-YYYY" -- converted to ISO for storage,
// but the time-of-day is deliberately never parsed or shown: this feed's
// documented timezone convention (US Eastern) isn't verifiable from the
// feed itself, and showing a wrong hour on a live financial dashboard is
// worse than not showing one at all. Date only.
function parseFfDate(raw: string): string | null {
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

export function parseFfCalendar(xml: string): ParsedEvent[] {
  const blocks = xml.match(/<event>[\s\S]*?<\/event>/g) ?? [];
  const events: ParsedEvent[] = [];

  for (const block of blocks) {
    const currency = extractTag(block, "country");
    if (!currency || !RELEVANT_CURRENCIES.has(currency)) continue;

    const impactRaw = extractTag(block, "impact");
    if (!impactRaw || !RELEVANT_IMPACTS.has(impactRaw)) continue;

    const title = extractTag(block, "title");
    const dateRaw = extractTag(block, "date");
    if (!title || !dateRaw) continue;

    const eventDate = parseFfDate(dateRaw);
    if (!eventDate) continue;

    events.push({
      eventDate,
      currency,
      eventName: title,
      impact: impactRaw === "High" ? "HIGH" : "MEDIUM",
      forecastValue: extractTag(block, "forecast"),
      previousValue: extractTag(block, "previous"),
      actualValue: extractTag(block, "actual"),
      sourceUrl: extractTag(block, "url"),
    });
  }

  return events;
}

type FullCalendarEvent = {
  eventDate: string;
  eventTime: string | null;
  currency: string;
  eventName: string;
  impact: string; // FF's own casing: High | Medium | Low | Holiday
  forecastValue: string | null;
  previousValue: string | null;
  actualValue: string | null;
  sourceUrl: string | null;
};

// Every currency, every impact level -- for the standalone "this week's
// economic calendar" page, not the AUD/THB-scoped consensus feature
// above. Same feed, same fetch, just unfiltered.
export function parseFfCalendarFull(xml: string): FullCalendarEvent[] {
  const blocks = xml.match(/<event>[\s\S]*?<\/event>/g) ?? [];
  const events: FullCalendarEvent[] = [];

  for (const block of blocks) {
    const currency = extractTag(block, "country");
    const title = extractTag(block, "title");
    const dateRaw = extractTag(block, "date");
    const impact = extractTag(block, "impact");
    if (!currency || !title || !dateRaw || !impact) continue;

    const eventDate = parseFfDate(dateRaw);
    if (!eventDate) continue;

    events.push({
      eventDate,
      eventTime: extractTag(block, "time"),
      currency,
      eventName: title,
      impact,
      forecastValue: extractTag(block, "forecast"),
      previousValue: extractTag(block, "previous"),
      actualValue: extractTag(block, "actual"),
      sourceUrl: extractTag(block, "url"),
    });
  }

  return events;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; audthb-forecast/1.0)" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Feed fetch failed: HTTP ${response.status}` },
        { status: 502 },
      );
    }

    const xml = await response.text();
    const fetchedAt = new Date().toISOString();

    const events = parseFfCalendar(xml);
    let consensusUpdated = 0;

    if (events.length > 0) {
      const rows = events.map((e) => ({
        event_date: e.eventDate,
        currency: e.currency,
        event_name: e.eventName,
        impact: e.impact,
        forecast_value: e.forecastValue,
        previous_value: e.previousValue,
        actual_value: e.actualValue,
        source_url: e.sourceUrl,
        fetched_at: fetchedAt,
      }));

      const { error } = await supabaseAdmin
        .from("economic_consensus")
        .upsert(rows, { onConflict: "event_date,currency,event_name" });

      if (error) throw new Error(`economic_consensus upsert error: ${error.message}`);
      consensusUpdated = rows.length;
    }

    const fullEvents = parseFfCalendarFull(xml);
    let fullCalendarUpdated = 0;

    if (fullEvents.length > 0) {
      const fullRows = fullEvents.map((e) => ({
        event_date: e.eventDate,
        event_time: e.eventTime,
        currency: e.currency,
        event_name: e.eventName,
        impact: e.impact,
        forecast_value: e.forecastValue,
        previous_value: e.previousValue,
        actual_value: e.actualValue,
        source_url: e.sourceUrl,
        fetched_at: fetchedAt,
      }));

      const { error: fullError } = await supabaseAdmin
        .from("ff_weekly_calendar")
        .upsert(fullRows, { onConflict: "event_date,currency,event_name,event_time" });

      if (fullError) throw new Error(`ff_weekly_calendar upsert error: ${fullError.message}`);
      fullCalendarUpdated = fullRows.length;
    }

    return NextResponse.json({ consensusUpdated, fullCalendarUpdated });
  } catch (error) {
    console.error("Economic consensus error:", error);
    return NextResponse.json(
      {
        error: "Economic consensus update failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
