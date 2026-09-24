"use client";

import { useState } from "react";
import BadgeChip from "@/components/v2/BadgeChip";
import { tLabel } from "@/lib/i18n";
import type { ChipTone } from "@/components/v2/BadgeChip";
import type { FfCalendarEvent } from "@/lib/ff-weekly-calendar-data";
import type { Locale } from "@/lib/i18n";

function impactTone(impact: string): ChipTone {
  if (impact === "High") return "red";
  if (impact === "Medium") return "amber";
  if (impact === "Holiday") return "slate";
  return "slate";
}

function pillLabel(dateIso: string, locale: Locale): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(d);
}

function fullLabel(dateIso: string, locale: Locale): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function EventDayBar({
  days,
  locale,
  todayIso,
  t,
}: {
  days: { date: string; events: FfCalendarEvent[] }[];
  locale: Locale;
  todayIso: string;
  t: {
    colTime: string;
    colCurrency: string;
    colEvent: string;
    colImpact: string;
    colForecast: string;
    colPrevious: string;
    colActual: string;
    allDay: string;
    noTime: string;
    today: string;
    noEventsThisDay: string;
  };
}) {
  const defaultDate = days.find((d) => d.date === todayIso)?.date ?? days[0]?.date ?? null;
  const [selected, setSelected] = useState<string | null>(defaultDate);

  const activeDay = days.find((d) => d.date === selected) ?? null;

  return (
    <div>
      <div className="flex items-center gap-1.5 overflow-x-auto px-5 pt-4 pb-3 -mx-0">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelected(d.date)}
            className={`relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selected === d.date ? "bg-blue-600 text-white shadow-sm" : "text-v2-muted hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {pillLabel(d.date, locale)}
            {d.date === todayIso && (
              <span
                className={`absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full ${selected === d.date ? "bg-white" : "bg-blue-600"}`}
                title={t.today}
              />
            )}
          </button>
        ))}
      </div>

      {activeDay && (
        <div className="px-5 pb-2">
          <p className="text-xs font-semibold text-v2-muted">
            {fullLabel(activeDay.date, locale)}
            {activeDay.date === todayIso && <span className="ml-2 text-blue-600 dark:text-blue-400">({t.today})</span>}
          </p>
        </div>
      )}

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
            {activeDay && activeDay.events.length > 0 ? (
              activeDay.events.map((event, i) => (
                <tr key={i} className="border-b border-v2-border last:border-b-0">
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
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-sm text-v2-muted">
                  {t.noEventsThisDay}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
