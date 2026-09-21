import { Fragment } from "react";
import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import { getLocale } from "@/lib/i18n-server";
import { getFfWeeklyCalendar } from "@/lib/ff-weekly-calendar-data";
import { getRecentEconomicOutcomes } from "@/lib/economic-consensus-data";
import { tLabel } from "@/lib/i18n";
import type { ChipTone } from "@/components/v2/BadgeChip";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "Economic Calendar & Event Impact",
    subtitle: "This week's real ForexFactory calendar, plus what happened after HIGH-impact events already released.",
    calendar: "This Week",
    colTime: "Time",
    colCurrency: "Currency",
    colEvent: "Event",
    colImpact: "Impact",
    colForecast: "Forecast",
    colPrevious: "Previous",
    colActual: "Actual",
    allDay: "All day",
    noTime: "--",
    reaction: "Event Reaction (Released This Week)",
    reactionNote: "Actual vs. forecast (surprise) and actual vs. previous (trend) for HIGH-impact AUD/USD/THB events already released -- both shown since they can disagree.",
    noReleases: "No HIGH-impact AUD/USD/THB events have released yet since this project started tracking (2026-09-20) -- this fills in automatically once real releases happen.",
    vsForecast: "vs. forecast",
    vsPrevious: "vs. previous",
  },
  th: {
    title: "ปฏิทินเศรษฐกิจ & ผลกระทบข่าว",
    subtitle: "ปฏิทิน ForexFactory จริงของสัปดาห์นี้ พร้อมสิ่งที่เกิดขึ้นจริงหลังข่าวผลกระทบสูงที่ประกาศไปแล้ว",
    calendar: "สัปดาห์นี้",
    colTime: "เวลา",
    colCurrency: "สกุลเงิน",
    colEvent: "ข่าว",
    colImpact: "ผลกระทบ",
    colForecast: "คาดการณ์",
    colPrevious: "ครั้งก่อน",
    colActual: "จริง",
    allDay: "ทั้งวัน",
    noTime: "--",
    reaction: "ผลกระทบข่าว (ที่ประกาศแล้วสัปดาห์นี้)",
    reactionNote: "เทียบตัวเลขจริงกับคาดการณ์ (เซอร์ไพรส์หรือไม่) และเทียบตัวเลขจริงกับครั้งก่อน (แนวโน้ม) สำหรับข่าวผลกระทบสูงของ AUD/USD/THB ที่ประกาศไปแล้ว -- โชว์ทั้งคู่เพราะอาจขัดกันได้",
    noReleases: "ยังไม่มีข่าวผลกระทบสูงของ AUD/USD/THB ประกาศจริงเลยตั้งแต่เริ่มเก็บข้อมูล (2026-09-20) -- จะขึ้นอัตโนมัติเมื่อมีข่าวประกาศจริง",
    vsForecast: "เทียบคาดการณ์",
    vsPrevious: "เทียบครั้งก่อน",
  },
} as const;

function impactTone(impact: string): ChipTone {
  if (impact === "High") return "red";
  if (impact === "Medium") return "amber";
  if (impact === "Holiday") return "slate";
  return "slate";
}

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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-v2-muted border-b border-v2-border">
                  <th className="px-5 py-2.5 font-medium">{t.colTime}</th>
                  <th className="px-5 py-2.5 font-medium">{t.colCurrency}</th>
                  <th className="px-5 py-2.5 font-medium">{t.colEvent}</th>
                  <th className="px-5 py-2.5 font-medium">{t.colImpact}</th>
                  <th className="px-5 py-2.5 font-medium hidden sm:table-cell">{t.colForecast}</th>
                  <th className="px-5 py-2.5 font-medium hidden sm:table-cell">{t.colPrevious}</th>
                  <th className="px-5 py-2.5 font-medium hidden md:table-cell">{t.colActual}</th>
                </tr>
              </thead>
              <tbody>
                {calendar.byDate.map((day) => (
                  <Fragment key={day.date}>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td colSpan={7} className="px-5 py-1.5 text-xs font-semibold text-v2-muted">
                        {day.date}
                      </td>
                    </tr>
                    {day.events.map((event, i) => (
                      <tr key={`${day.date}-${i}`} className="border-b border-v2-border last:border-b-0">
                        <td className="px-5 py-2 text-v2-muted whitespace-nowrap">{event.eventTime ?? t.allDay}</td>
                        <td className="px-5 py-2 text-v2-foreground font-medium">{event.currency}</td>
                        <td className="px-5 py-2 text-v2-foreground">{event.eventName}</td>
                        <td className="px-5 py-2">
                          <BadgeChip label={tLabel(event.impact.toUpperCase(), locale)} tone={impactTone(event.impact)} />
                        </td>
                        <td className="px-5 py-2 font-mono text-v2-muted hidden sm:table-cell">{event.forecastValue ?? t.noTime}</td>
                        <td className="px-5 py-2 font-mono text-v2-muted hidden sm:table-cell">{event.previousValue ?? t.noTime}</td>
                        <td className="px-5 py-2 font-mono text-v2-foreground hidden md:table-cell">{event.actualValue ?? t.noTime}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
