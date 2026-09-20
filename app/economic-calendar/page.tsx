import Link from "next/link";
import { getFfWeeklyCalendar, type FfCalendarEvent } from "@/lib/ff-weekly-calendar-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function impactTone(impact: string): BadgeTone {
  if (impact === "High") return "red";
  if (impact === "Medium") return "amber";
  return "slate"; // Low | Holiday
}

function formatHeadingDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTabLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  });
}

// Same Bangkok-anchored "today" used elsewhere in the app (e.g.
// getEventCalendar) -- event_date itself has no timezone (it's a plain
// date parsed from FF's own calendar), so "today" is just whatever day
// it is for this app's audience.
function bangkokToday(): string {
  const bangkokOffset = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + bangkokOffset).toISOString().slice(0, 10);
}

function EventRow({ event }: { event: FfCalendarEvent }) {
  const hasNumbers = event.forecastValue !== null || event.previousValue !== null || event.actualValue !== null;

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="text-xs text-stone-500 dark:text-stone-500 font-mono">
            {event.eventTime ?? "--"}
          </span>{" "}
          <span className="font-semibold">{event.currency}</span> {event.eventName}
        </p>

        {hasNumbers && (
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            {event.actualValue !== null && (
              <>
                Actual <span className="text-stone-700 dark:text-stone-300">{event.actualValue}</span>
                {(event.forecastValue !== null || event.previousValue !== null) && <>{" -- "}</>}
              </>
            )}
            {event.forecastValue !== null && <>Forecast {event.forecastValue}</>}
            {event.forecastValue !== null && event.previousValue !== null && <>, </>}
            {event.previousValue !== null && <>Previous {event.previousValue}</>}
          </p>
        )}
      </div>

      <StatusBadge label={event.impact} tone={impactTone(event.impact)} />
    </div>
  );
}

export default async function EconomicCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const calendar = await getFfWeeklyCalendar();

  const availableDates = calendar.byDate.map((d) => d.date);
  const today = bangkokToday();
  const selectedDate =
    params.date && availableDates.includes(params.date)
      ? params.date
      : availableDates.includes(today)
        ? today
        : (availableDates[0] ?? today);

  const selectedDay = calendar.byDate.find((d) => d.date === selectedDate) ?? null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
            &larr; AUD/THB Forecast Dashboard
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1.5 text-white">Economic Calendar</h1>
          <p className="text-stone-400 mt-1 text-xs sm:text-sm">
            Every currency and impact level for this week -- not just AUD/USD.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {calendar.error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{calendar.error}</p>
        ) : availableDates.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            No calendar data yet -- the daily cron hasn&apos;t populated this week&apos;s events.
          </p>
        ) : (
          <>
            {/* DAY TABS -- plain links with a query param, not client-side
            state: keeps this page a server component and each day
            shareable/bookmarkable by its own URL. */}
            <div className="flex flex-wrap gap-1.5">
              {availableDates.map((date) => {
                const active = date === selectedDate;
                return (
                  <Link
                    key={date}
                    href={`/economic-calendar?date=${date}`}
                    className={`rounded-sm border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-brass-600 bg-brass-600 text-white dark:border-brass-400 dark:bg-brass-400 dark:text-stone-900"
                        : "border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-brass-500 hover:text-brass-700 dark:hover:text-brass-400"
                    }`}
                  >
                    {formatTabLabel(date)}
                    {date === today && <span className="ml-1 opacity-70">&bull;</span>}
                  </Link>
                );
              })}
            </div>

            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-4 sm:p-6 mt-4">
              <h2 className="text-sm font-semibold tracking-tight">
                {selectedDay ? formatHeadingDate(selectedDay.date) : formatHeadingDate(selectedDate)}
              </h2>
              <div className="mt-2">
                {selectedDay && selectedDay.events.length > 0 ? (
                  selectedDay.events.map((event, i) => (
                    <EventRow key={`${event.currency}-${event.eventName}-${event.eventTime}-${i}`} event={event} />
                  ))
                ) : (
                  <p className="text-sm text-stone-600 dark:text-stone-400 py-2">No events scheduled this day.</p>
                )}
              </div>
            </div>
          </>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          Source: ForexFactory&apos;s public weekly calendar export, fetched once daily (their own page asks not to be
          fetched more than once an hour). Times are shown exactly as published -- this feed&apos;s timezone
          convention isn&apos;t verifiable from the feed itself, so treat exact hours as approximate and confirm
          against an official source before acting on them.
        </p>
      </div>
    </main>
  );
}
