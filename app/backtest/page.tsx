import Link from "next/link";
import { getBacktestSummary, NEUTRAL_BAND_PCT, type BacktestYearResult } from "@/lib/backtest-data";
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

// Collapsible per-year rows for one strategy, same disclosure pattern as
// the main dashboard's Score Breakdown factors -- an aggregate accuracy
// number can hide a strategy that only worked in one unusual year.
function YearBreakdown({ years }: { years: BacktestYearResult[] }) {
  return (
    <details className="group mt-3">
      <summary className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-400 cursor-pointer list-none marker:content-none">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
        >
          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Year-by-year breakdown
      </summary>

      <div className="mt-2 pl-5 divide-y divide-stone-200 dark:divide-stone-800">
        {years.map((y) => (
          <div key={y.year} className="flex items-center justify-between gap-3 py-1.5">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {y.year} <span className="text-stone-500">({y.sampleSize}d)</span>
            </p>
            <div className="flex items-center gap-4">
              <Figure
                value={accuracyLabel(y.directionalAccuracy)}
                className={`text-xs font-semibold ${
                  y.beatsCoinFlip ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}
              />
              <Figure value={maeLabel(y.mae)} className="text-xs text-stone-600 dark:text-stone-400" />
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default async function BacktestPage() {
  const summary = await getBacktestSummary();
  const neutralLabel = `${NEUTRAL_BAND_PCT}%`;
  const anyBeatsCoinFlip = summary.strategies.some((s) => s.beatsCoinFlip);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
            &larr; AUD/THB Forecast Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">Backtest</h1>
          <p className="text-stone-400 mt-1 text-sm sm:text-base">
            Does simple momentum or mean-reversion have historical edge on daily AUD/THB at all?
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-md bg-brass-50/60 dark:bg-brass-950/20 border border-brass-200/70 dark:border-brass-900/40 px-4 py-3 mb-8">
          <p className="text-sm font-semibold text-brass-900 dark:text-brass-200">
            This is a different question from Track Record, and it is not a replay of the live Core FX Score.
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
            Track Record (on the main dashboard) grades the live model&apos;s actual forecasts as they resolve, so it
            only ever has a few weeks of history. The live model&apos;s heaviest factor, Price/Momentum, is built from
            1H/4H intraday change -- and no free historical source publishes that granularity going back years. This
            page instead asks a narrower, answerable question on {summary.sampleSize} trading days of official daily
            closes: if you did nothing but watch the trailing 5 days and bet on the direction continuing (momentum) or
            reversing (mean reversion), would you have called tomorrow correctly more often than chance, or than just
            assuming nothing changes?
          </p>
        </div>

        {summary.error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{summary.error}</p>
        ) : (
          <>
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
                  Always predicts tomorrow is flat. Correct only when the actual move was under {neutralLabel} --
                  which is rare, so this baseline is a low bar on purpose: it exists to catch a strategy that is
                  actually worse than doing nothing, not to represent a realistic alternative.
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
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge
                          label={s.beatsBaselineDirectionally ? "Beats No-Change" : "Below No-Change"}
                          tone={s.beatsBaselineDirectionally ? "emerald" : "slate"}
                        />
                        <StatusBadge
                          label={s.beatsCoinFlip ? "Beats Coin Flip" : "Below Coin Flip"}
                          tone={s.beatsCoinFlip ? "emerald" : "red"}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">Direction Accuracy</p>
                        <Figure
                          value={accuracyLabel(s.directionalAccuracy)}
                          className={`block text-lg font-semibold ${
                            s.beatsCoinFlip
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-700 dark:text-red-400"
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

                    <YearBreakdown years={s.byYear} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-6 mt-6">
              <h2 className="text-sm font-semibold tracking-tight text-stone-600 dark:text-stone-400 uppercase tracking-widest">
                What this actually means
              </h2>
              <p className="text-sm mt-3 leading-relaxed">
                Two benchmarks are shown for direction accuracy because they answer different questions, and reading
                only one can be misleading:
              </p>
              <ul className="text-sm mt-2 space-y-2 list-disc pl-5 leading-relaxed">
                <li>
                  <span className="font-semibold">vs the no-change baseline</span> -- AUD/THB is almost never
                  perfectly flat day to day, so this baseline&apos;s own accuracy is usually only a few percent.
                  Beating it is a very low bar and does not by itself mean a strategy works.
                </li>
                <li>
                  <span className="font-semibold">vs a coin flip (50%)</span> -- the honest bar. A strategy that
                  calls direction right less than half the time is worse than guessing, even if it comfortably beats
                  the no-change baseline above.
                </li>
              </ul>
              <p className="text-sm mt-3 leading-relaxed">
                {anyBeatsCoinFlip
                  ? "At least one strategy above clears both bars over this window -- still not proof of a tradeable edge (see caveats below), but worth watching alongside Track Record."
                  : "Neither strategy above clears the coin-flip bar over this window: both called direction right less than half the time, despite comfortably beating the no-change baseline. This is a common, well-documented result in daily FX data -- short-horizon moves are close to a random walk, so a purely price-based signal on 5 days of history alone often has no real edge. Take the green \"Beats No-Change\" badges as a floor, not a verdict."}
              </p>
              <h3 className="text-sm font-semibold mt-4">Caveats</h3>
              <ul className="text-sm mt-2 space-y-1.5 list-disc pl-5 leading-relaxed text-stone-600 dark:text-stone-400">
                <li>Trading costs, spreads, and slippage are not modelled -- these numbers are gross, not net of any cost to actually act on a signal.</li>
                <li>One data source, one currency pair, one window. A different window or a different momentum length (not just 5 days) could read differently.</li>
                <li>This tests only the price series. It cannot test the live model&apos;s macro, commodity, or risk factors, which have no comparable free daily history.</li>
                <li>Past daily behavior is not a guarantee of future daily behavior.</li>
              </ul>
            </div>
          </>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          Methodology: same statistical definitions as the live Track Record (Evaluation) -- a move under{" "}
          {neutralLabel} counts as &quot;no real move,&quot; the no-change baseline always predicts no move, and MAE
          is the average absolute error against the actual next-day move. Momentum bets tomorrow continues the
          trailing 5-day direction; Mean Reversion bets it reverses. Data is {summary.dataSource}&apos;s official
          daily fixing, seeded by a one-time historical backfill and topped up daily by a cron job that fetches the
          same published series (see{" "}
          <code className="text-[11px]">supabase/migrations/20260920_create_backtest_daily_rates.sql</code>).
        </p>

        <p className="text-center text-xs text-stone-600 dark:text-stone-400 mt-6 mb-6">
          AUD/THB Forecast Dashboard -- for research and monitoring purposes only, not financial advice.
        </p>
      </div>
    </main>
  );
}
