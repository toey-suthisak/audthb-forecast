import type { DashboardData } from "@/lib/dashboard-data";
import { getActionSummary } from "@/lib/action-data";
import type { Locale } from "@/lib/i18n";

// Workflow H, kept deliberately quiet -- a single sentence under Hero,
// not its own competing card, since it's a restatement of signals shown
// in full detail elsewhere (Core FX Score, Confidence, Event Risk), not
// new information.
export default async function ActionSummary({ data, locale }: { data: DashboardData; locale: Locale }) {
  const summary = await getActionSummary(data, locale);

  return (
    <div className="mt-4 rounded-md bg-brass-50/60 dark:bg-brass-950/20 border border-brass-200/70 dark:border-brass-900/40 px-4 py-3">
      <p className="text-sm font-semibold text-brass-900 dark:text-brass-200">{summary.headline}</p>
      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{summary.detail}</p>
    </div>
  );
}
