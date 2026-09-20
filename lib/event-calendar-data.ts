import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Locale } from "@/lib/i18n";

const STR = {
  en: {
    dbError: (msg: string) => `Event calendar DB error: ${msg}`,
    errorNote: "Hand-maintained calendar, not a live feed -- see supabase/migrations for sources.",
    coverageNote:
      "Hand-updated, not a live feed -- covers RBA/Fed/BOT/BOE/BOJ meetings plus AU/US data releases. " +
      "A quiet week just means nothing's been added yet, not that nothing's scheduled.",
  },
  th: {
    dbError: (msg: string) => `ปฏิทินข่าวเชื่อมต่อฐานข้อมูลผิดพลาด: ${msg}`,
    errorNote: "ปฏิทินอัปเดตด้วยมือ ไม่ใช่ฟีดสด -- ดูแหล่งข้อมูลใน supabase/migrations",
    coverageNote:
      "อัปเดตด้วยมือ ไม่ใช่ฟีดสด -- ครอบคลุมการประชุม RBA/Fed/BOT/BOE/BOJ และการรายงานข้อมูล AU/US " +
      "สัปดาห์ที่ดูเงียบแค่หมายความว่ายังไม่ได้เพิ่มข้อมูล ไม่ใช่ว่าไม่มีอะไรตามกำหนดการ",
  },
} as const;

export type CalendarEvent = {
  eventTime: string;
  country: string;
  currency: string;
  eventName: string;
  category: string;
  importance: string;
  referencePeriod: string | null;
  source: string;
  sourceUrl: string | null;
};

type DbEventRow = {
  event_time: string;
  country: string;
  currency: string;
  event_name: string;
  category: string;
  importance: string;
  reference_period: string | null;
  source: string;
  source_url: string | null;
};

function toCalendarEvent(row: DbEventRow): CalendarEvent {
  return {
    eventTime: row.event_time,
    country: row.country,
    currency: row.currency,
    eventName: row.event_name,
    category: row.category,
    importance: row.importance,
    referencePeriod: row.reference_period,
    source: row.source,
    sourceUrl: row.source_url,
  };
}

// Hand-maintained calendar (see supabase/migrations -- no live provider
// gives this away for free). A gap in coverage means "not seeded yet",
// not "nothing happening" -- surfaced via coverageNote below.
export async function getEventCalendar(locale: Locale = "th") {
  const t = STR[locale];
  const now = new Date();

  const bangkokOffset = 7 * 60 * 60 * 1000;
  const bangkokNow = new Date(now.getTime() + bangkokOffset);
  const startOfTodayBangkok = Date.UTC(
    bangkokNow.getUTCFullYear(),
    bangkokNow.getUTCMonth(),
    bangkokNow.getUTCDate(),
    0, 0, 0,
  ) - bangkokOffset;
  const startOfTomorrowBangkok = startOfTodayBangkok + 24 * 60 * 60 * 1000;
  // "This week" = today plus the next 7 full days (day 0..day 7 inclusive),
  // so an event exactly 7 days out (e.g. today Thu -> next Thu) still shows.
  const startOfNextWeekBangkok = startOfTodayBangkok + 8 * 24 * 60 * 60 * 1000;

  const { data, error } = await supabaseAdmin
    .from("event_calendar")
    .select("event_time,country,currency,event_name,category,importance,reference_period,source,source_url")
    .gte("event_time", new Date(startOfTodayBangkok).toISOString())
    .lt("event_time", new Date(startOfNextWeekBangkok).toISOString())
    .order("event_time", { ascending: true });

  if (error) {
    return {
      today: [] as CalendarEvent[],
      thisWeek: [] as CalendarEvent[],
      error: t.dbError(error.message),
      coverageNote: t.errorNote,
    };
  }

  const rows = ((data ?? []) as DbEventRow[]).map(toCalendarEvent);

  const today = rows.filter((row) => {
    const t = new Date(row.eventTime).getTime();
    return t >= startOfTodayBangkok && t < startOfTomorrowBangkok;
  });

  return {
    today,
    thisWeek: rows,
    error: null,
    coverageNote: t.coverageNote,
  };
}

// =========================================================
// EVENT RISK
//
// Workflow G (see AUDTHB-project-status.md): a HIGH-importance event
// close by should flag that the current score is more likely to move
// sharply, before the Forecast/Confidence layer (workflow F) exists to
// do this itself. "HIGH" = a HIGH-importance event inside the next 24h;
// "WATCH" = one inside the next 72h. Silence means nothing in the
// hand-curated calendar's covered window is that close -- not a
// guarantee nothing is scheduled (same caveat as getEventCalendar).
// =========================================================

export type EventRiskLevel = "HIGH" | "WATCH" | "NONE";

export type EventRisk = {
  level: EventRiskLevel;
  event: CalendarEvent | null;
  hoursUntil: number | null;
};

const EVENT_RISK_HIGH_WINDOW_HOURS = 24;
const EVENT_RISK_WATCH_WINDOW_HOURS = 72;

export async function getEventRisk(): Promise<EventRisk> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EVENT_RISK_WATCH_WINDOW_HOURS * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("event_calendar")
    .select("event_time,country,currency,event_name,category,importance,reference_period,source,source_url")
    .eq("importance", "HIGH")
    .gte("event_time", now.toISOString())
    .lt("event_time", windowEnd.toISOString())
    .order("event_time", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) {
    return { level: "NONE", event: null, hoursUntil: null };
  }

  const nextEvent = toCalendarEvent(data[0] as DbEventRow);
  const hoursUntil = (new Date(nextEvent.eventTime).getTime() - now.getTime()) / (60 * 60 * 1000);

  return {
    level: hoursUntil <= EVENT_RISK_HIGH_WINDOW_HOURS ? "HIGH" : "WATCH",
    event: nextEvent,
    hoursUntil: Math.round(hoursUntil * 10) / 10,
  };
}
