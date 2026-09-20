import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import { getEventRisk } from "@/lib/event-calendar-data";
import { getConfidence, type ConfidenceLevel } from "@/lib/confidence-data";
import { buildForecast, FORECAST_HORIZONS, FORECAST_VERSION, type ForecastDirection } from "@/lib/forecast-data";
import { getEvaluationSummary } from "@/lib/evaluation-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import ScoreGauge from "@/components/ScoreGauge";
import InfoTip from "@/components/InfoTip";
import Figure from "@/components/Figure";

function confidenceTone(level: ConfidenceLevel): BadgeTone {
  if (level === "HIGH") return "emerald";
  if (level === "MEDIUM") return "amber";
  return "red";
}

function formatHoursUntil(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)}h`;
}

function freshnessTone(status: string): BadgeTone {
  if (status === "FRESH") return "emerald";
  if (status === "DELAYED") return "amber";
  if (status === "MARKET_CLOSED") return "slate";
  return "red";
}

function changeColor(value: number | null) {
  if (value === null) return "text-stone-600 dark:text-stone-400";
  if (value > 0) return "text-emerald-700 dark:text-emerald-400";
  if (value < 0) return "text-red-700 dark:text-red-400";
  return "text-stone-600 dark:text-stone-400";
}

function scoreTextColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score >= 15) return "text-emerald-700 dark:text-emerald-400";
  if (score <= -15) return "text-red-700 dark:text-red-400";
  return "text-amber-700 dark:text-amber-400";
}

function formatFactorScore(score: number | null) {
  if (score === null) return null;
  return `${score > 0 ? "+" : ""}${score}`;
}

// Matches ScoreBreakdown's own per-factor coloring (sign-based) --
// distinct from scoreTextColor above, which bands the aggregate score
// against the -15/+15 bias thresholds instead.
function factorScoreColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score > 0) return "text-emerald-700 dark:text-emerald-400";
  if (score < 0) return "text-red-700 dark:text-red-400";
  return "text-stone-600 dark:text-stone-300";
}

function forecastDirectionColor(direction: ForecastDirection) {
  if (direction === "BULLISH") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "BEARISH") return "text-red-700 dark:text-red-400";
  return "text-stone-700 dark:text-stone-300";
}

function coreFeeds(data: DashboardData) {
  return [
    { label: "Direct", status: data.directFreshness.status },
    { label: "AUD/USD", status: data.audUsdFreshness.status },
    { label: "USD/THB", status: data.usdThbFreshness.status },
  ];
}

function feedDotColor(status: string) {
  if (status === "FRESH") return "text-emerald-500 dark:text-emerald-400";
  if (status === "DELAYED") return "text-amber-500 dark:text-amber-400";
  if (status === "MARKET_CLOSED") return "text-stone-400 dark:text-stone-600";
  return "text-red-500 dark:text-red-400";
}

export default async function Hero({ data }: { data: DashboardData }) {
  const eventRisk = await getEventRisk();
  const confidence = await getConfidence(data);

  const referenceRate = data.latestPrice ? Number(data.latestPrice.rate) : null;

  // Top-level score per factor only -- the full breakdown (sub-factors,
  // formulas, coverage detail) lives on /score-breakdown now; this is
  // just enough to scan at a glance next to the aggregate score.
  const scoreFactors: { name: string; score: number | null }[] = [
    { name: "Price / Momentum", score: data.priceMomentumScore },
    { name: "Cross Currency", score: data.crossCurrencyScore },
    { name: "Relative Market", score: data.relativeMarketScore },
    { name: "Commodity", score: data.commodityScore },
    { name: "Mean Reversion", score: data.meanReversionScore },
    { name: "Macro / Policy", score: data.macroScore },
    { name: "Risk / VIXY", score: data.riskScore },
  ];

  // Track Record's own numbers for each horizon/version, reused here so
  // the line under each prediction states the model's actual measured
  // performance instead of a static "not tested yet" -- the same
  // honesty rule the backtest page follows for its badges.
  const evaluation = await getEvaluationSummary();

  const forecasts =
    data.coreFxScore !== null
      ? FORECAST_HORIZONS.map((horizon) => {
          const forecast = buildForecast(horizon, data.coreFxScore!, referenceRate);
          return {
            horizon,
            forecast,
            trackRecord: evaluation.groups.find(
              (g) => g.horizon === horizon && g.forecastVersion === FORECAST_VERSION,
            ),
            priceRange:
              referenceRate !== null
                ? {
                    low: referenceRate * (1 + forecast.predictedRangeLowPct / 100),
                    high: referenceRate * (1 + forecast.predictedRangeHighPct / 100),
                  }
                : null,
          };
        })
      : [];

  // Every horizon's direction comes from the same Core FX Score threshold
  // (>=15 BULLISH, <=-15 BEARISH) -- only the move-size scale differs by
  // horizon, not the directional call itself. Spelled out here so a score
  // sitting inside that band (as most quiet days do) doesn't read as a
  // bug when all three show NEUTRAL together.
  const allNeutral =
    forecasts.length > 0 && forecasts.every((f) => f.forecast.predictedDirection === "NEUTRAL");

  // Reasons to treat any of the above with extra care -- pulled from
  // signals already computed elsewhere on this page (Confidence, Event
  // Risk, Model Coverage, market hours), never invented for this panel.
  const cautionNotes: string[] = [];
  if (eventRisk.level !== "NONE" && eventRisk.event && eventRisk.hoursUntil !== null) {
    cautionNotes.push(
      `${eventRisk.event.eventName} (${eventRisk.event.currency}) in ${formatHoursUntil(eventRisk.hoursUntil)} -- expect volatility around that time.`,
    );
  }
  if (confidence.level !== "HIGH") {
    cautionNotes.push(`Confidence is currently ${confidence.level} -- see reasons above.`);
  }
  if (data.availableCoreWeight < 100) {
    cautionNotes.push(
      `Model coverage is only ${data.availableCoreWeight.toFixed(1)}/100 right now -- some signals are missing or delayed.`,
    );
  }
  if (data.latestPriceFreshness.status === "MARKET_CLOSED") {
    cautionNotes.push("AUD/THB market is currently closed -- these ranges assume normal trading conditions.");
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* RATE */}
        <div className="md:border-r border-stone-200 dark:border-stone-800 md:pr-8">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest">
              AUD/THB Spot
            </p>

            {data.latestPrice && (
              <StatusBadge
                label={data.latestPriceFreshness.status}
                tone={freshnessTone(data.latestPriceFreshness.status)}
              />
            )}
          </div>

          <Figure
            value={data.latestPrice ? Number(data.latestPrice.rate).toFixed(4) : null}
            className="block mt-2 text-4xl sm:text-5xl font-semibold tracking-tight"
          />

          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-4 text-sm">
            <span className="inline-flex items-baseline gap-1">
              1H
              <Figure
                value={data.change1H !== null ? `${data.change1H >= 0 ? "+" : ""}${data.change1H.toFixed(2)}%` : null}
                className={changeColor(data.change1H)}
              />
            </span>

            <span className="inline-flex items-baseline gap-1">
              4H
              <Figure
                value={data.change4H !== null ? `${data.change4H >= 0 ? "+" : ""}${data.change4H.toFixed(2)}%` : null}
                className={changeColor(data.change4H)}
              />
            </span>

            <span className="inline-flex items-baseline gap-1 text-stone-600 dark:text-stone-400">
              Range
              <Figure
                value={
                  data.intradayLow !== null && data.intradayHigh !== null
                    ? `${data.intradayLow.toFixed(4)} - ${data.intradayHigh.toFixed(4)}`
                    : null
                }
              />
            </span>
          </div>

          {data.latestPrice && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-3">
              Updated{" "}
              {new Date(data.latestPrice.market_timestamp).toLocaleString("en-GB", {
                timeZone: "Asia/Bangkok",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}{" "}
              (Bangkok) via {data.latestPrice.source}
            </p>
          )}

          {/* DATA HEALTH -- three small dots, one per core feed, instead of
              a narrated "X/3 fresh" sentence. */}
          <div
            className="flex items-center gap-1.5 mt-1.5"
            aria-label={`Core feed status: ${coreFeeds(data)
              .map((f) => `${f.label} ${f.status.toLowerCase().replace("_", " ")}`)
              .join(", ")}`}
          >
            {coreFeeds(data).map((f) => (
              <span
                key={f.label}
                title={`${f.label}: ${f.status}`}
                className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${feedDotColor(f.status)}`}
              />
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest inline-flex items-center">
              Forecast
              <InfoTip text="Derived from today's Core FX Score using a fixed, uncalibrated formula per horizon -- it is not a statistically fitted prediction. Track Record below is the only honest measure of how well each one actually performs." />
            </p>

            {forecasts.length > 0 ? (
              <>
                {allNeutral && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                    All three read NEUTRAL because Core FX Score ({data.coreFxScore}) is inside the -15 to +15
                    neutral band -- every horizon uses the same directional call, only the predicted move size
                    differs.
                  </p>
                )}

                <div className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
                  {forecasts.map(({ horizon, forecast, trackRecord, priceRange }) => (
                    <div key={horizon} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold text-stone-500 dark:text-stone-500 shrink-0">
                          {horizon}
                        </span>
                        <p className={`text-lg font-semibold ${forecastDirectionColor(forecast.predictedDirection)}`}>
                          {forecast.predictedDirection}
                        </p>
                        <StatusBadge label="Uncalibrated" tone="amber" />
                        <span className="text-xs text-stone-600 dark:text-stone-400 ml-auto">
                          {forecast.predictedMovePct >= 0 ? "+" : ""}
                          {forecast.predictedMovePct.toFixed(2)}% ({forecast.predictedRangeLowPct.toFixed(2)}% to{" "}
                          {forecast.predictedRangeHighPct.toFixed(2)}%)
                        </span>
                      </div>

                      {priceRange && (
                        <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5">
                          Price range: {priceRange.low.toFixed(4)} to {priceRange.high.toFixed(4)}
                        </p>
                      )}

                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                        {trackRecord && !trackRecord.insufficientData ? (
                          <>
                            Direction correct {(trackRecord.model.directionalAccuracy! * 100).toFixed(1)}% of last{" "}
                            {trackRecord.sampleSize} (baseline{" "}
                            {(trackRecord.baselineNoChange.directionalAccuracy! * 100).toFixed(1)}%)
                          </>
                        ) : (
                          `Not enough resolved forecasts yet to show accuracy${
                            trackRecord ? ` (${trackRecord.sampleSize}/${trackRecord.minSampleSize})` : ""
                          }.`
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {cautionNotes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                      Caution
                    </p>
                    <ul className="mt-1 space-y-1">
                      {cautionNotes.map((note, i) => (
                        <li key={i} className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                Core FX Score is not available right now -- unable to calculate a forecast.
              </p>
            )}
          </div>
        </div>

        {/* CORE FX SCORE */}
        <div>
          <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest inline-flex items-center">
            Core FX Score
            <InfoTip text="One score combining 7 market and economic signals: -100 (bearish AUD) to +100 (bullish AUD). Not a price prediction." />
          </p>

          <div className="flex flex-wrap items-baseline gap-3 mt-2">
            <Figure
              value={data.coreFxScore !== null ? String(data.coreFxScore) : null}
              className={`text-4xl sm:text-5xl font-semibold tracking-tight ${scoreTextColor(data.coreFxScore)}`}
            />

            <p className="text-lg font-semibold text-stone-700 dark:text-stone-300">{data.coreBias}</p>
          </div>

          <div className="mt-2 inline-flex items-center">
            <StatusBadge label={`Confidence: ${confidence.level}`} tone={confidenceTone(confidence.level)} />
            <InfoTip text={confidence.reasons.join(". ") + "."} />
          </div>

          <ScoreGauge score={data.coreFxScore} />

          {eventRisk.level !== "NONE" && eventRisk.event && eventRisk.hoursUntil !== null && (
            <div
              className={`mt-4 rounded-md px-3 py-2 text-xs leading-relaxed ${
                eventRisk.level === "HIGH"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              Event Risk ({eventRisk.level}): {eventRisk.event.eventName} ({eventRisk.event.currency}) in{" "}
              {formatHoursUntil(eventRisk.hoursUntil)} -- expect volatility, treat this score with extra caution.
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-600 dark:text-stone-400 inline-flex items-center">
                Model Coverage
                <InfoTip text="How much of the model actually had data this run. Lower means fewer signals than usual." />
              </p>
              <p className="text-lg font-semibold font-mono tabular-nums">
                {data.availableCoreWeight.toFixed(1)}/100
              </p>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              Coverage is the share of data actually available right now, not the accuracy of the score.
            </p>

            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              Gold isn't included in the score yet, but coverage can still reach 100/100 when all other data is
              complete, and drops when data is missing or the market is closed.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-400">Factors behind this score</p>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {scoreFactors.map((f) => (
                <div key={f.name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-600 dark:text-stone-400 truncate">{f.name}</span>
                  <Figure value={formatFactorScore(f.score)} className={`text-xs font-semibold shrink-0 ${factorScoreColor(f.score)}`} />
                </div>
              ))}
            </div>

            <Link
              href="/score-breakdown"
              className="mt-3 inline-block text-xs font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2"
            >
              View full Score Breakdown &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
