"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/alerts-data";
import StatusLight from "@/components/StatusLight";

const DISMISSED_KEY = "dismissedAlertsKey";

// Identifies "this exact set of alerts", not just "any alert" -- so
// dismissing today's BOJ event-risk alert doesn't also silently swallow
// tomorrow's unrelated stale-feed alert; the popup reappears whenever the
// underlying alert set actually changes.
function alertsKey(alerts: Alert[]): string {
  return alerts.map((a) => `${a.severity}:${a.label}`).sort().join("|");
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Shown as a dismissible popup rather than a permanent banner -- when
// there's nothing to alert on, nothing renders at all (the page already
// conveys health via feed-freshness dots and the Confidence badge), and
// when there is, the user can close it without it coming back for the
// exact same alerts on the next page load.
export default function Alerts({ alerts }: { alerts: Alert[] }) {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  // What's actually on screen, captured at the moment it's shown --
  // decoupled from the live `alerts` prop so a background refresh
  // (RefreshControls polls every 60s) resolving the underlying condition
  // can't yank an unacknowledged popup away out from under the user. Only
  // the close button, or a genuinely new/different alert set once the
  // prior one is dismissed, changes what's shown.
  const [shown, setShown] = useState<{ key: string; alerts: Alert[] } | null>(null);
  const key = alertsKey(alerts);

  useEffect(() => {
    if (shown || alerts.length === 0) return;

    let dismissedKey: string | null = null;
    try {
      dismissedKey = localStorage.getItem(DISMISSED_KEY);
    } catch {}

    if (dismissedKey !== key) {
      setShown({ key, alerts });
      setVisible(true);
    }
  }, [key, alerts, shown]);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  if (!visible || !shown) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, shown.key);
    } catch {}
    setShown(null);
  };

  const criticalCount = shown.alerts.filter((a) => a.severity === "critical").length;
  const warningCount = shown.alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="fixed inset-x-4 top-4 z-40 sm:left-1/2 sm:inset-x-auto sm:w-full sm:max-w-2xl sm:-translate-x-1/2">
      <div
        className={`relative rounded-md border border-red-300 dark:border-red-900/50 bg-red-50/95 dark:bg-surface/95 backdrop-blur p-4 shadow-xl transition-all duration-200 ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss alerts"
          className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-stone-700 dark:hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
        >
          <CloseIcon />
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
          <p className="font-semibold">Alerts</p>

          <div className="flex gap-4 text-sm">
            {criticalCount > 0 && (
              <span className="text-red-700 dark:text-red-400">{criticalCount} Critical</span>
            )}
            {warningCount > 0 && (
              <span className="text-amber-700 dark:text-amber-400">{warningCount} Warning</span>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto">
          {shown.alerts.map((alert) => (
            <div
              key={alert.label}
              className="rounded-md border border-stone-200 dark:border-stone-800 bg-inset p-3"
            >
              <p
                className={`text-sm font-semibold inline-flex items-center ${
                  alert.severity === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                }`}
              >
                <StatusLight colorClassName={alert.severity === "critical" ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"} />
                {alert.label}
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{alert.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
