import Link from "next/link";
import type { ConsensusEvent, ConsensusLean } from "@/lib/economic-consensus-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import InfoTip from "@/components/InfoTip";

function importanceColor(impact: string) {
  if (impact === "HIGH") return "text-red-700 dark:text-red-400";
  if (impact === "MEDIUM") return "text-amber-700 dark:text-amber-400";
  return "text-stone-600 dark:text-stone-400";
}

function formatEventDate(eventDate: string) {
  return new Date(eventDate).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function leanLabel(currency: string, lean: ConsensusLean) {
  if (lean === "BULLISH") return `${currency} ↑`;
  if (lean === "BEARISH") return `${currency} ↓`;
  return "NEUTRAL";
}

function leanTone(lean: ConsensusLean): BadgeTone {
  if (lean === "BULLISH") return "emerald";
  if (lean === "BEARISH") return "red";
  return "slate";
}

function leanTooltip(event: ConsensusEvent) {
  const basis =
    event.leanBasis === "actual_vs_forecast"
      ? "actual vs. forecast (the real surprise)"
      : "forecast vs. previous (the expected direction of change)";

  const pairNote =
    event.currency === "AUD"
      ? ""
      : ` This is ${event.currency}'s own direction, not a translated AUD/THB call -- a stronger ${event.currency} ` +
        "doesn't necessarily mean a weaker AUD/THB (e.g. a stronger USD tends to pressure both AUD and THB together, " +
        "so that pair's net effect is muted, not simply 'AUD down'). Judge relevance to AUD/THB yourself.";

  return (
    `Derived from ${basis} using a hand-coded textbook polarity for this indicator type (e.g. higher employment is ` +
    `bullish, higher unemployment is bearish) -- our own convention, not ForexFactory's own guidance.${pairNote}`
  );
}

function ConsensusRow({ event }: { event: ConsensusEvent }) {
  const hasNumbers = event.forecastValue !== null || event.previousValue !== null || event.actualValue !== null;

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm">
          <span className={`font-semibold ${importanceColor(event.impact)}`}>{event.currency}</span>{" "}
          {event.eventName}
        </p>

        {hasNumbers ? (
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            {event.actualValue !== null ? (
              <>
                Actual <span className="text-stone-700 dark:text-stone-300">{event.actualValue}</span>
                {event.forecastValue !== null && <> (forecast {event.forecastValue})</>}
                {event.previousValue !== null && <>, previous {event.previousValue}</>}
              </>
            ) : event.forecastValue !== null ? (
              <>
                Forecast <span className="text-stone-700 dark:text-stone-300">{event.forecastValue}</span>
                {event.previousValue !== null && <>, previous {event.previousValue}</>}
              </>
            ) : (
              <>Previous {event.previousValue}</>
            )}
          </p>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5 italic">No forecast/previous published</p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {event.lean && (
          <div className="inline-flex items-center">
            <StatusBadge label={leanLabel(event.currency, event.lean)} tone={leanTone(event.lean)} />
            <InfoTip text={leanTooltip(event)} />
          </div>
        )}
        <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{formatEventDate(event.eventDate)}</p>
      </div>
    </div>
  );
}

export default function MarketConsensus({ consensus }: { consensus: ConsensusEvent[] }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-amber-500 dark:text-amber-400" />
        Market Consensus
        <InfoTip text="Forecast/previous/actual values for this week's High/Medium-impact releases across every currency, from ForexFactory's public calendar. The up/down badge (where shown) is our own hand-coded textbook polarity for a handful of common indicator types, not ForexFactory's own guidance -- a reading aid, not a tested signal. No badge means the indicator type isn't in that list; read the raw numbers yourself. For a non-AUD/USD currency, this is that currency's own direction, not a translated AUD/THB call." />
      </h2>

      <div className="mt-3">
        {consensus.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            No High/Medium-impact events with consensus data this week.
          </p>
        ) : (
          <div>
            {consensus.map((event) => (
              <ConsensusRow key={`${event.eventDate}-${event.currency}-${event.eventName}`} event={event} />
            ))}
          </div>
        )}
      </div>

      <Link
        href="/economic-calendar"
        className="mt-4 inline-block text-xs font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2"
      >
        View full economic calendar (all currencies) &rarr;
      </Link>
    </div>
  );
}
