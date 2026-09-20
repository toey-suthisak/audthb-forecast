"use client";

import { useEffect, useState } from "react";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import Figure from "@/components/Figure";
import { freshnessLabel, tLabel, type Locale } from "@/lib/i18n";

function freshnessTone(status: string): BadgeTone {
  if (status === "FRESH") return "emerald";
  if (status === "DELAYED") return "amber";
  if (status === "MARKET_CLOSED") return "slate";
  return "red";
}

function scoreTextColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score >= 15) return "text-emerald-700 dark:text-emerald-400";
  if (score <= -15) return "text-red-700 dark:text-red-400";
  return "text-amber-700 dark:text-amber-400";
}

const STR = {
  en: { audthb: "AUD/THB", score: "Score" },
  th: { audthb: "AUD/THB", score: "คะแนน" },
} as const;

// Shows once the Hero card has scrolled out of view, so the headline
// rate/score are never more than a glance away on a page that's grown
// long enough to need real scrolling (Score Breakdown, Event Calendar,
// Sources). Pure scroll-position toggle -- no IntersectionObserver
// needed for a single fixed threshold.
export default function StickyBar({
  rate,
  score,
  bias,
  freshnessStatus,
  locale,
}: {
  rate: number | null;
  score: number | null;
  bias: string;
  freshnessStatus: string;
  locale: Locale;
}) {
  const [visible, setVisible] = useState(false);
  const t = STR[locale];

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed top-0 inset-x-0 z-20 transition-transform duration-200 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="border-b border-stone-200 dark:border-stone-800 bg-surface/90 backdrop-blur">
        <div className="h-0.5 bg-brass-700 dark:bg-brass-400" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wide hidden sm:inline">
              {t.audthb}
            </span>
            <Figure value={rate !== null ? rate.toFixed(4) : null} className="text-sm font-semibold" />
            <StatusBadge label={freshnessLabel(freshnessStatus, locale)} tone={freshnessTone(freshnessStatus)} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wide hidden sm:inline">
              {t.score}
            </span>
            <Figure
              value={score !== null ? String(score) : null}
              className={`text-sm font-semibold ${scoreTextColor(score)}`}
            />
            <span className="text-xs text-stone-600 dark:text-stone-400 hidden sm:inline">{tLabel(bias, locale)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
