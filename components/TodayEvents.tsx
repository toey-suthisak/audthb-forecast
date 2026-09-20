import type { CalendarEvent } from "@/lib/event-calendar-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import InfoTip from "@/components/InfoTip";
import { tLabel, type Locale } from "@/lib/i18n";

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

function formatEventTime(eventTime: string, locale: Locale) {
  return new Date(eventTime).toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STR = {
  en: { title: "Today", noEvents: "No scheduled events today.", bangkok: "(Bangkok)" },
  th: { title: "วันนี้", noEvents: "ไม่มีข่าวตามกำหนดการวันนี้", bangkok: "(เวลาไทย)" },
} as const;

function EventRow({ event, locale }: { event: CalendarEvent; locale: Locale }) {
  const t = STR[locale];
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

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">{formatEventTime(event.eventTime, locale)} {t.bangkok}</p>
      </div>

      <div className="shrink-0">
        <StatusBadge label={tLabel(event.importance, locale)} tone={importanceTone(event.importance)} />
      </div>
    </div>
  );
}

// The hand-curated calendar's own view of today only -- the full week is
// covered separately (and more completely, every currency) by
// MarketConsensus and /economic-calendar now, so this row's job is just
// "what's on today," not a duplicate week-ahead list.
export default function TodayEvents({
  today,
  coverageNote,
  locale,
}: {
  today: CalendarEvent[];
  coverageNote: string;
  locale: Locale;
}) {
  const t = STR[locale];
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-amber-500 dark:text-amber-400" />
        {t.title}
        <InfoTip text={coverageNote} />
      </h2>

      <div className="mt-3">
        {today.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.noEvents}</p>
        ) : (
          <div>
            {today.map((event) => (
              <EventRow key={`${event.eventTime}-${event.eventName}`} event={event} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
