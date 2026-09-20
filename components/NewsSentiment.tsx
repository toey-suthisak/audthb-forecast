import type { NewsSentimentSignal, NewsDirection } from "@/lib/news-sentiment-data";
import { getApiUsageToday } from "@/lib/api-usage-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import InfoTip from "@/components/InfoTip";
import StatusLight from "@/components/StatusLight";

function directionLabel(direction: NewsDirection) {
  if (direction === "AUD_UP") return "AUD ↑";
  if (direction === "AUD_DOWN") return "AUD ↓";
  return "NEUTRAL";
}

function directionTone(direction: NewsDirection): BadgeTone {
  if (direction === "AUD_UP") return "emerald";
  if (direction === "AUD_DOWN") return "red";
  return "slate";
}

function formatPublished(publishedAt: string) {
  return new Date(publishedAt).toLocaleString("en-US", {
    timeZone: "Asia/Bangkok",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SignalRow({ signal }: { signal: NewsSentimentSignal }) {
  return (
    <div className="py-3 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <a
          href={signal.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2"
        >
          {signal.title}
        </a>

        <div className="shrink-0 flex items-center gap-1.5">
          {signal.aiMagnitude === "HIGH" && <StatusBadge label="HIGH IMPACT" tone="amber" />}
          <StatusBadge label={directionLabel(signal.aiDirection)} tone={directionTone(signal.aiDirection)} />
        </div>
      </div>

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{signal.aiRationale}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-stone-600 dark:text-stone-400">
        <span>{signal.source}</span>
        <span>{formatPublished(signal.publishedAt)} (Bangkok)</span>
        <span>Confidence {Math.round(signal.aiConfidence * 100)}%</span>
        {signal.aiTags.length > 0 && (
          <span className="text-stone-400 dark:text-stone-600">{signal.aiTags.join(" · ")}</span>
        )}
      </div>
    </div>
  );
}

export default async function NewsSentiment({
  signals,
  error,
}: {
  signals: NewsSentimentSignal[];
  error: string | null;
}) {
  const apiUsage = await getApiUsageToday("alpha_vantage");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight flex items-center">
          <StatusLight colorClassName="text-amber-500 dark:text-amber-400" />
          News Signals
          <InfoTip text="News that could move AUD/THB, read and scored automatically twice a day (09:00 and 18:00 Bangkok) across AUD/USD/THB coverage. Context only -- not part of the Core FX Score. Experimental -- verify before acting." />
        </h2>

        <StatusBadge label="Monitor Only" tone="slate" />
      </div>

      <div className="mt-3">
        {error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        ) : signals.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">No relevant news yet today.</p>
        ) : (
          signals.map((signal) => <SignalRow key={signal.articleUrl} signal={signal} />)
        )}
      </div>

      {apiUsage.limit > 0 && (
        <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
          Alpha Vantage: {apiUsage.used}/{apiUsage.limit} requests used today -- if this hits the limit, News Signals
          skips updates until it resets.
        </p>
      )}
    </div>
  );
}
