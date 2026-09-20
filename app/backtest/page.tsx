import Link from "next/link";
import { getBacktestSummary, NEUTRAL_BAND_PCT } from "@/lib/backtest-data";
import Figure from "@/components/Figure";
import StatusBadge from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function accuracyLabel(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function maeLabel(value: number) {
  return `${value.toFixed(3)}%`;
}

export default async function BacktestPage() {
  const summary = await getBacktestSummary();
  const neutralLabel = `${NEUTRAL_BAND_PCT}%`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
            &larr; AUD/THB Forecast Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">Backtest</h1>
          <p className="text-stone-400 mt-1 text-sm sm:text-base">
            Historical daily AUD/THB, tested against two simple strategies -- separate from the live Track Record.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-md bg-brass-50/60 dark:bg-brass-950/20 border border-brass-200/70 dark:border-brass-900/40 px-4 py-3 mb-8">
          <p className="text-sm font-semibold text-brass-900 dark:text-brass-200">
            This is not a replay of the live Core FX Score.
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
            The live model&apos;s heaviest factor (Price/Momentum) is built from 1H/4H intraday change, and no free
            historical source publishes that. This page instead tests two simple next-day strategies against{" "}
            {summary.dataSource}&apos;s official daily fixing -- a genuinely different, longer-history question:
            &quot;does momentum or mean-reversion have historical edge on daily AUD/THB at all?&quot;
          </p>
        </div>

        {summary.error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{summary.error}</p>
        ) : (
          <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface divide-y divide-stone-200 dark:divide-stone-800">
            <div className="p-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
                <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
                Daily Direction Backtest
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {summary.dataFrom} -- {summary.dataTo} ({summary.sampleSize} trading days) -- {summary.dataSource}
              </p>
            </div>

            <div className="p-6">
              <p className="text-sm font-semibold">No-Change Baseline</p>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Always predicts tomorrow is flat. Correct only when the actual move was under {neutralLabel}.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-3 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">Direction Accuracy</p>
                  <Figure value={accuracyLabel(summary.baseline.directionalAccuracy)} className="block text-lg font-semibold" />
                </div>
                <div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">Avg Error (MAE)</p>
                  <Figure value={maeLabel(summary.baseline.mae)} className="block text-lg font-semibold" />
                </div>
              </div>

              {summary.strategies.map((s) => (
                <div key={s.name} className="pt-4 pb-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-stone-600 dark:text-stone-400">{s.description}</p>
                    </div>
                    <StatusBadge
                      label={s.beatsBaselineDirectionally ? "Beats Baseline" : "No Edge"}
                      tone={s.beatsBaselineDirectionally ? "emerald" : "slate"}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-stone-600 dark:text-stone-400">Direction Accuracy</p>
                      <Figure
                        value={accuracyLabel(s.directionalAccuracy)}
                        className={`block text-lg font-semibold ${
                          s.beatsBaselineDirectionally
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-stone-700 dark:text-stone-300"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-stone-600 dark:text-stone-400">Avg Error (MAE)</p>
                      <Figure
                        value={maeLabel(s.mae)}
                        className={`block text-lg font-semibold ${
                          s.beatsBaselineOnMae
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-stone-700 dark:text-stone-300"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          Methodology: same statistical definitions as the live Track Record (Evaluation) -- a move under{" "}
          {neutralLabel} counts as &quot;no real move,&quot; the baseline always predicts no move, and MAE is the
          average absolute error against the actual next-day move. Data is a manual periodic refresh from RBA&apos;s
          free published CSV, not a live cron -- see supabase/migrations for how it was loaded.
        </p>

        <p className="text-center text-xs text-stone-600 dark:text-stone-400 mt-6 mb-6">
          AUD/THB Forecast Dashboard -- for research and monitoring purposes only, not financial advice.
        </p>
      </div>
    </main>
  );
}
