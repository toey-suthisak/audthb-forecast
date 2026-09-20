import Link from "next/link";
import { getFfWeeklyCalendar, type FfCalendarEvent } from "@/lib/ff-weekly-calendar-data";
import MarketClock from "@/components/MarketClock";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { getLocale } from "@/lib/i18n-server";
import { tLabel, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function impactDotColor(impact: string) {
  if (impact === "High") return "bg-red-500";
  if (impact === "Medium") return "bg-amber-500";
  if (impact === "Low") return "bg-yellow-400";
  return "bg-stone-400 dark:bg-stone-600"; // Holiday
}

function ImpactDot({ impact, locale }: { impact: string; locale: Locale }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-sm ${impactDotColor(impact)}`} title={tLabel(impact.toUpperCase(), locale)} />;
}

function formatHeadingDate(dateStr: string, locale: Locale) {
  return new Date(dateStr).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTabLabel(dateStr: string, locale: Locale) {
  return new Date(dateStr).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  });
}

// Same Asia/Bangkok "today" the calendar itself is now bucketed by (see
// lib/ff-weekly-calendar-data.ts).
function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const STR = {
  en: {
    title: "Economic Calendar",
    subtitle: "Every currency and impact level for this week -- not just AUD/USD. Times shown in Bangkok time.",
    noData: "No calendar data yet -- the daily cron hasn't populated this week's events.",
    noEvents: "No events scheduled this day.",
    allDay: "All Day",
    time: "Time",
    cur: "Cur",
    impact: "Impact",
    event: "Event",
    actual: "Actual",
    forecast: "Forecast",
    previous: "Previous",
    footer:
      "Source: ForexFactory's public weekly calendar export, fetched once daily (their own page asks not to be fetched more than once an hour). FF's export gives times in UTC, converted here to Bangkok time, so a late-UTC-evening event may show under the next Bangkok calendar day. Holiday entries show as all-day (the feed carries a placeholder time for them, same as forexfactory.com's own site); a few other entries have no specific time at all and keep the feed's own date.",
  },
  th: {
    title: "ปฏิทินเศรษฐกิจ",
    subtitle: "ทุกสกุลเงินและทุกระดับผลกระทบของสัปดาห์นี้ -- ไม่ใช่แค่ AUD/USD เวลาที่แสดงเป็นเวลาไทย",
    noData: "ยังไม่มีข้อมูลปฏิทิน -- cron รายวันยังไม่ได้เพิ่มข่าวของสัปดาห์นี้",
    noEvents: "ไม่มีข่าวตามกำหนดการวันนี้",
    allDay: "ทั้งวัน",
    time: "เวลา",
    cur: "สกุลเงิน",
    impact: "ผลกระทบ",
    event: "ข่าว",
    actual: "จริง",
    forecast: "คาดการณ์",
    previous: "ครั้งก่อน",
    footer:
      "แหล่งข้อมูล: ปฏิทินรายสัปดาห์สาธารณะของ ForexFactory ดึงข้อมูลวันละครั้ง (หน้าของเขาเองขอไม่ให้ดึงเกินชั่วโมงละครั้ง) ข้อมูลจาก FF ให้เวลาเป็น UTC แปลงเป็นเวลาไทยที่นี่ ดังนั้นข่าวที่อยู่ช่วงดึกของ UTC อาจไปแสดงในวันถัดไปตามปฏิทินไทย รายการวันหยุดจะแสดงเป็น \"ทั้งวัน\" (ฟีดมีเวลา placeholder ไว้ให้ เหมือนกับที่เว็บ forexfactory.com เองแสดง) ส่วนบางรายการไม่มีเวลาระบุเลยและจะใช้วันที่ตามฟีดเดิม",
  },
} as const;

// FF-style dense table: Time / Cur / Impact / Event / Actual / Forecast /
// Previous in fixed columns, not the card-per-event layout used
// elsewhere in this app -- this page is deliberately the "look at the
// whole week's raw calendar" reference view.
function CalendarTable({ events, locale }: { events: FfCalendarEvent[]; locale: Locale }) {
  const t = STR[locale];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800">
            <th className="py-2 pr-3 font-medium">{t.time}</th>
            <th className="py-2 pr-3 font-medium">{t.cur}</th>
            <th className="py-2 pr-3 font-medium">{t.impact}</th>
            <th className="py-2 pr-3 font-medium">{t.event}</th>
            <th className="py-2 pr-3 font-medium text-right">{t.actual}</th>
            <th className="py-2 pr-3 font-medium text-right">{t.forecast}</th>
            <th className="py-2 font-medium text-right">{t.previous}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr
              key={`${event.currency}-${event.eventName}-${event.eventTime}-${i}`}
              className="border-b border-stone-200 dark:border-stone-800 last:border-b-0"
            >
              <td className="py-2 pr-3 text-xs text-stone-500 dark:text-stone-500 font-mono whitespace-nowrap">
                {event.impact === "Holiday" ? t.allDay : (event.eventTime ?? "--")}
              </td>
              <td className="py-2 pr-3 text-xs font-semibold whitespace-nowrap">{event.currency}</td>
              <td className="py-2 pr-3">
                <ImpactDot impact={event.impact} locale={locale} />
              </td>
              <td className="py-2 pr-3 text-sm">{event.eventName}</td>
              <td className="py-2 pr-3 text-xs text-right text-stone-700 dark:text-stone-300 whitespace-nowrap">
                {event.actualValue ?? "—"}
              </td>
              <td className="py-2 pr-3 text-xs text-right text-stone-600 dark:text-stone-400 whitespace-nowrap">
                {event.forecastValue ?? "—"}
              </td>
              <td className="py-2 text-xs text-right text-stone-600 dark:text-stone-400 whitespace-nowrap">
                {event.previousValue ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EconomicCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const calendar = await getFfWeeklyCalendar(locale);
  const t = STR[locale];

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
              &larr; AUD/THB Forecast Dashboard
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1.5 text-white">{t.title}</h1>
            <p className="text-stone-400 mt-1 text-xs sm:text-sm">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <MarketClock variant="inverted" locale={locale} />
            <div className="flex items-center gap-2">
              <LanguageToggle locale={locale} variant="inverted" />
              <ThemeToggle variant="inverted" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {calendar.error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{calendar.error}</p>
        ) : availableDates.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.noData}
          </p>
        ) : (
          <>
            {/* DAY TABS -- one grid column per day, so the 7 tabs together
            span exactly the same width as the table card below, like
            plain links with a query param rather than client-side state:
            keeps this page a server component and each day
            shareable/bookmarkable by its own URL. */}
            <div className="grid grid-cols-7 gap-1.5">
              {availableDates.map((date) => {
                const active = date === selectedDate;
                return (
                  <Link
                    key={date}
                    href={`/economic-calendar?date=${date}`}
                    className={`rounded-sm border px-1.5 py-1.5 text-center text-xs font-semibold transition-colors ${
                      active
                        ? "border-brass-600 bg-brass-600 text-white dark:border-brass-400 dark:bg-brass-400 dark:text-stone-900"
                        : "border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-brass-500 hover:text-brass-700 dark:hover:text-brass-400"
                    }`}
                  >
                    {formatTabLabel(date, locale)}
                    {date === today && <span className="ml-1 opacity-70">&bull;</span>}
                  </Link>
                );
              })}
            </div>

            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-4 sm:p-6 mt-4">
              <h2 className="text-sm font-semibold tracking-tight">
                {selectedDay ? formatHeadingDate(selectedDay.date, locale) : formatHeadingDate(selectedDate, locale)}
              </h2>
              <div className="mt-2">
                {selectedDay && selectedDay.events.length > 0 ? (
                  <CalendarTable events={selectedDay.events} locale={locale} />
                ) : (
                  <p className="text-sm text-stone-600 dark:text-stone-400 py-2">{t.noEvents}</p>
                )}
              </div>
            </div>
          </>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          {t.footer}
        </p>
      </div>
    </main>
  );
}
