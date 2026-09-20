"use client";

import {
  useEffect,
  useState,
} from "react";
import type { Locale } from "@/lib/i18n";

function getTime(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

const STR = {
  en: { bangkok: "Bangkok", sydney: "Sydney" },
  th: { bangkok: "กรุงเทพฯ", sydney: "ซิดนีย์" },
} as const;

// Two secondary reference clocks -- useful context, not the headline of
// the page, so this stays a single quiet line rather than the pair of
// large bordered cards it used to be (those competed visually with the
// Hero's own big rate number for the same "biggest thing on screen"
// attention).
export default function MarketClock({
  variant = "default",
  locale,
}: {
  variant?: "default" | "inverted";
  locale: Locale;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const t = STR[locale];

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const base = variant === "inverted" ? "text-stone-300" : "text-stone-600 dark:text-stone-400";
  const label = variant === "inverted" ? "text-white" : "text-stone-600 dark:text-stone-300";
  const divider = variant === "inverted" ? "text-white/30" : "text-stone-300 dark:text-stone-700";

  return (
    <div className={`flex items-center gap-3 sm:gap-4 text-xs sm:text-sm tabular-nums ${base}`}>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-medium ${label}`}>{t.bangkok}</span>
        <span className="font-mono">{now ? getTime(now, "Asia/Bangkok") : "--:--:--"}</span>
      </span>

      <span className={divider}>|</span>

      <span className="flex items-baseline gap-1.5">
        <span className={`font-medium ${label}`}>{t.sydney}</span>
        <span className="font-mono">{now ? getTime(now, "Australia/Sydney") : "--:--:--"}</span>
      </span>
    </div>
  );
}
