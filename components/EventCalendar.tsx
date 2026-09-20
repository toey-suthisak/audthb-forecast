import type { CalendarEvent } from "@/lib/event-calendar-data";
import type { ConsensusEvent } from "@/lib/economic-consensus-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import InfoTip from "@/components/InfoTip";

function importanceColor(importance: string) {
  if (importance === "HIGH") return "text-red-700 dark:text-red-400";
  if (importance === "MEDIUM") return "text-amber-700 dark:text-amber-400";
  return "text-stone-600 dark:text-stone-400";
}

function importanceTone(importance: string): BadgeTone {
  if (importance === "HIGH") return "red";
  if (importance === "MEDIUM") return "amber";
  return "slate";
}

function formatEventTime(eventTime: string) {
  return new Date(eventTime).toLocaleString("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventDate(eventDate: string) {
  return new Date(eventDate).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function ConsensusRow({ event }: { event: ConsensusEvent }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <div>
        <p className="text-sm">
          <span className={`font-semibold ${importanceColor(event.impact)}`}>{event.currency}</span>{" "}
          {event.eventName}
        </p>

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
          {event.actualValue !== null ? (
            <>
              Actual <span className="text-stone-700 dark:text-stone-300">{event.actualValue}</span>
              {event.forecastValue !== null && <> (forecast {event.forecastValue})</>}
              {event.previousValue !== null && <>, previous {event.previousValue}</>}
            </>
          ) : (
            <>
              {event.forecastValue !== null ? (
                <>
                  Forecast <span className="text-stone-700 dark:text-stone-300">{event.forecastValue}</span>
                  {event.previousValue !== null && <>, previous {event.previousValue}</>}
                </>
              ) : (
                <>Previous {event.previousValue}</>
              )}
            </>
          )}
        </p>
      </div>

      <p className="text-xs text-stone-600 dark:text-stone-400 shrink-0">{formatEventDate(event.eventDate)}</p>
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <div>
        <p className="text-sm">
          <span className={`font-semibold ${importanceColor(event.importance)}`}>
            {event.currency}
          </span>{" "}
          {event.eventName}
          {event.referencePeriod ? (
            <span className="text-stone-600 dark:text-stone-400"> ({event.referencePeriod})</span>
          ) : null}
        </p>

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">{formatEventTime(event.eventTime)} (Bangkok)</p>
      </div>

      <div className="shrink-0">
        <StatusBadge label={event.importance} tone={importanceTone(event.importance)} />
      </div>
    </div>
  );
}

export default function EventCalendar({
  today,
  thisWeek,
  coverageNote,
  consensus,
}: {
  today: CalendarEvent[];
  thisWeek: CalendarEvent[];
  coverageNote: string;
  consensus: ConsensusEvent[];
}) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-amber-500 dark:text-amber-400" />
        Event Calendar
      </h2>

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{coverageNote}</p>

      <div className="mt-4">
        <p className="text-sm text-stone-600 dark:text-stone-400 mb-1">Today</p>

        {today.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">No scheduled events today.</p>
        ) : (
          <div>
            {today.map((event) => (
              <EventRow key={`${event.eventTime}-${event.eventName}`} event={event} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
        <p className="text-sm text-stone-600 dark:text-stone-400 mb-1">This Week</p>

        {thisWeek.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">No events scheduled this week.</p>
        ) : (
          <div>
            {thisWeek.map((event) => (
              <EventRow key={`${event.eventTime}-${event.eventName}-week`} event={event} />
            ))}
          </div>
        )}
      </div>

      {consensus.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-1 inline-flex items-center">
            Market Consensus
            <InfoTip text="Forecast/previous values for this week's AUD/USD releases, from ForexFactory's public calendar. Shown as-is, not scored -- an indicator's 'surprise' direction (higher-is-bullish vs higher-is-bearish) varies by type, so read direction yourself rather than treating this as a signal." />
          </p>

          <div>
            {consensus.map((event) => (
              <ConsensusRow key={`${event.eventDate}-${event.currency}-${event.eventName}`} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
