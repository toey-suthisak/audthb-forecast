"use client";

import { useState } from "react";
import type { Alert } from "@/lib/alerts-data";
import type { Locale } from "@/lib/i18n";

const STR = {
  en: { caution: "Caution", close: "Dismiss" },
  th: { caution: "ข้อควรระวัง", close: "ปิด" },
} as const;

// Dismissible floating toast (per user request: the caution banner
// should be a closable popup, not a fixed part of the page flow).
// Session-only -- resets on reload, no persistence, since these alerts
// are live/real-time and a stale dismissal from an hour ago shouldn't
// hide a NEW alert that happens to share this render.
export default function CautionToast({ alerts, locale }: { alerts: Alert[]; locale: Locale }) {
  const t = STR[locale];
  const [dismissed, setDismissed] = useState(false);

  if (alerts.length === 0 || dismissed) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-[min(90vw,380px)] rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 shadow-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide">{t.caution}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.close}
          className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 leading-none text-lg"
        >
          &times;
        </button>
      </div>
      <ul className="space-y-1 mt-1.5">
        {alerts.map((a, i) => (
          <li key={i} className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-medium">{a.label}:</span> {a.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
