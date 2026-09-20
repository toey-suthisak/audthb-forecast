import Link from "next/link";
import { getBacktestSummary } from "@/lib/backtest-data";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";

function accuracyLabel(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function accuracyColor(beatsCoinFlip: boolean) {
  return beatsCoinFlip ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
}

// A short, honest preview of the /backtest page -- a different question
// from Track Record above (which grades the live model's own forecasts):
// does simple price-only momentum or mean-reversion have historical edge
// on daily AUD/THB at all? Full methodology, caveats, and the coin-flip
// vs no-change-baseline distinction live on the dedicated page; this
// card exists so the headline numbers don't require a click to see.
export default async function BacktestPreview() {
  const summary = await getBacktestSummary();

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        Backtest
      </h2>
      <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
        A separate question from Track Record above: tested on {summary.sampleSize} trading days of{" "}
        {summary.dataSource}&apos;s daily closes ({summary.dataFrom} to {summary.dataTo}) -- not a replay of the live
        Core FX Score, which needs intraday data no free historical source publishes.
      </p>

      {summary.error ? (
        <p className="text-sm text-red-700 dark:text-red-400 mt-3">{summary.error}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-xs text-stone-600 dark:text-stone-400">No-Change Baseline</p>
            <Figure value={accuracyLabel(summary.baseline.directionalAccuracy)} className="block text-lg font-semibold" />
          </div>

          {summary.strategies.map((s) => (
            <div key={s.name}>
              <p className="text-xs text-stone-600 dark:text-stone-400">{s.name}</p>
              <Figure value={accuracyLabel(s.directionalAccuracy)} className={`block text-lg font-semibold ${accuracyColor(s.beatsCoinFlip)}`} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-3">
        Direction accuracy shown in red is below a 50% coin flip -- beating the no-change baseline above is a low
        bar on its own. See the full breakdown, both benchmarks, and caveats on the backtest page.
      </p>

      <Link
        href="/backtest"
        className="inline-block text-xs font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2 mt-3"
      >
        Full methodology &amp; results &rarr;
      </Link>
    </div>
  );
}
