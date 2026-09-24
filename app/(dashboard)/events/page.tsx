import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import EventDayBar from "@/components/v2/EventDayBar";
import { getLocale } from "@/lib/i18n-server";
import { getFfWeeklyCalendar } from "@/lib/ff-weekly-calendar-data";
import { getRecentEconomicOutcomes } from "@/lib/economic-consensus-data";
import type { ChipTone } from "@/components/v2/BadgeChip";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "Economic Calendar & Event Impact",
    subtitle: "Real ForexFactory calendar, day by day, plus what happened after HIGH-impact events already released.",
    calendar: "Calendar",
    coverage: (from: string, to: string, fetched: string) => `Real coverage: ${from} to ${to} -- refreshed daily by cron, last updated ${fetched} (Bangkok). Pick a day below.`,
    colTime: "Time",
    colCurrency: "Currency",
    colEvent: "Event",
    colImpact: "Impact",
    colForecast: "Forecast",
    colPrevious: "Previous",
    colActual: "Actual",
    allDay: "All day",
    noTime: "--",
    today: "Today",
    noEventsThisDay: "No AUD/USD/THB-relevant events on this day.",
    reaction: "Event Reaction (Released This Week)",
    reactionNote: "Actual vs. forecast (surprise) and actual vs. previous (trend) for HIGH-impact AUD/USD/THB events already released -- both shown since they can disagree.",
    noReleases: "No HIGH-impact AUD/USD/THB events have released yet since this project started tracking (2026-09-20) -- this fills in automatically once real releases happen.",
    vsForecast: "vs. forecast",
    vsPrevious: "vs. previous",
  },
  th: {
    title: "ปฏิทินเศรษฐกิจ & ผลกระทบข่าว",
    subtitle: "ปฏิทิน ForexFactory จริง แยกเลือกดูเป็นรายวัน พร้อมสิ่งที่เกิดขึ้นจริงหลังข่าวผลกระทบสูงที่ประกาศไปแล้ว",
    calendar: "ปฏิทิน",
    coverage: (from: string, to: string, fetched: string) => `ช่วงข้อมูลจริงที่มี: ${from} ถึง ${to} -- อัปเดตอัตโนมัติทุกวันผ่าน cron ล่าสุดเมื่อ ${fetched} (เวลากรุงเทพฯ) เลือกวันที่ด้านล่างได้เลย`,
    colTime: "เวลา",
    colCurrency: "สกุลเงิน",
    colEvent: "ข่าว",
    colImpact: "ผลกระทบ",
    colForecast: "คาดการณ์",
    colPrevious: "ครั้งก่อน",
    colActual: "จริง",
    allDay: "ทั้งวัน",
    noTime: "--",
    today: "วันนี้",
    noEventsThisDay: "ไม่มีข่าวที่เกี่ยวกับ AUD/USD/THB ในวันนี้",
    reaction: "ผลกระทบข่าว (ที่ประกาศแล้วสัปดาห์นี้)",
    reactionNote: "เทียบตัวเลขจริงกับคาดการณ์ (เซอร์ไพรส์หรือไม่) และเทียบตัวเลขจริงกับครั้งก่อน (แนวโน้ม) สำหรับข่าวผลกระทบสูงของ AUD/USD/THB ที่ประกาศไปแล้ว -- โชว์ทั้งคู่เพราะอาจขัดกันได้",
    noReleases: "ยังไม่มีข่าวผลกระทบสูงของ AUD/USD/THB ประกาศจริงเลยตั้งแต่เริ่มเก็บข้อมูล (2026-09-20) -- จะขึ้นอัตโนมัติเมื่อมีข่าวประกาศจริง",
    vsForecast: "เทียบคาดการณ์",
    vsPrevious: "เทียบครั้งก่อน",
  },
} as const;

function leanTone(lean: string | null): ChipTone {
  if (lean === "BULLISH") return "emerald";
  if (lean === "BEARISH") return "red";
  return "slate";
}

export default async function EventsPage() {
  const locale = await getLocale();
  const t = STR[locale];

  const [calendar, outcomes] = await Promise.all([
    getFfWeeklyCalendar(locale),
    getRecentEconomicOutcomes(),
  ]);

  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const lastFetchedLabel = calendar.fetchedAt
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(calendar.fetchedAt))
    : "--";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-v2-foreground">{t.title}</h1>
        <p className="text-sm text-v2-muted mt-1">{t.subtitle}</p>
      </div>

      <Card title={t.reaction}>
        <p className="text-xs text-v2-muted mb-4">{t.reactionNote}</p>
        {outcomes.events.length === 0 ? (
          <p className="text-sm text-v2-muted">{t.noReleases}</p>
        ) : (
          <div className="space-y-3">
            {outcomes.events.map((e, i) => (
              <div key={i} className="rounded-lg border border-v2-border p-3">
                <p className="text-sm font-medium text-v2-foreground">
                  {e.currency} {e.eventName} <span className="font-mono text-v2-muted">-- {e.actualValue}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {e.leanVsForecast && (
                    <BadgeChip label={`${t.vsForecast}: ${e.forecastValue ?? "--"}`} tone={leanTone(e.leanVsForecast)} />
                  )}
                  {e.leanVsPrevious && (
                    <BadgeChip label={`${t.vsPrevious}: ${e.previousValue ?? "--"}`} tone={leanTone(e.leanVsPrevious)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t.calendar} padded={false}>
        {calendar.error ? (
          <p className="text-sm text-red-600 dark:text-red-400 p-5">{calendar.error}</p>
        ) : calendar.byDate.length === 0 ? (
          <p className="text-sm text-v2-muted p-5">{t.noEventsThisDay}</p>
        ) : (
          <>
            <p className="text-xs text-v2-muted px-5 pt-4">
              {t.coverage(calendar.byDate[0].date, calendar.byDate[calendar.byDate.length - 1].date, lastFetchedLabel)}
            </p>
            <EventDayBar
              days={calendar.byDate}
              locale={locale}
              todayIso={todayIso}
              t={{
                colTime: t.colTime,
                colCurrency: t.colCurrency,
                colEvent: t.colEvent,
                colImpact: t.colImpact,
                colForecast: t.colForecast,
                colPrevious: t.colPrevious,
                colActual: t.colActual,
                allDay: t.allDay,
                noTime: t.noTime,
                today: t.today,
                noEventsThisDay: t.noEventsThisDay,
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
