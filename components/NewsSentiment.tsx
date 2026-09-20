import type { NewsSentimentSignal, NewsDirection } from "@/lib/news-sentiment-data";
import { getApiUsageToday } from "@/lib/api-usage-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import InfoTip from "@/components/InfoTip";
import StatusLight from "@/components/StatusLight";
import { type Locale } from "@/lib/i18n";

function directionLabel(direction: NewsDirection, locale: Locale) {
  if (direction === "AUD_UP") return "AUD ↑";
  if (direction === "AUD_DOWN") return "AUD ↓";
  return locale === "th" ? "เป็นกลาง" : "NEUTRAL";
}

function directionTone(direction: NewsDirection): BadgeTone {
  if (direction === "AUD_UP") return "emerald";
  if (direction === "AUD_DOWN") return "red";
  return "slate";
}

function formatPublished(publishedAt: string, locale: Locale) {
  return new Date(publishedAt).toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STR = {
  en: {
    title: "News Signals",
    titleTooltip:
      "News that could move AUD/THB, read and scored automatically twice a day (09:00 and 18:00 Bangkok) across AUD/USD/THB coverage. Context only -- not part of the Core FX Score. Experimental -- verify before acting.",
    monitorOnly: "Monitor Only",
    highImpact: "HIGH IMPACT",
    noNews: "No relevant news yet today.",
    bangkok: "(Bangkok)",
    confidence: "Confidence",
    apiUsage: (used: number, limit: number) =>
      `Alpha Vantage: ${used}/${limit} requests used today -- if this hits the limit, News Signals skips updates until it resets.`,
  },
  th: {
    title: "สัญญาณข่าว",
    titleTooltip:
      "ข่าวที่อาจส่งผลต่อ AUD/THB อ่านและให้คะแนนอัตโนมัติวันละ 2 ครั้ง (09:00 และ 18:00 เวลาไทย) ครอบคลุม AUD/USD/THB เป็นบริบทประกอบเท่านั้น -- ไม่ได้อยู่ใน Core FX Score ยังอยู่ในขั้นทดลอง ควรตรวจสอบก่อนนำไปใช้",
    monitorOnly: "ติดตามเท่านั้น",
    highImpact: "ผลกระทบสูง",
    noNews: "ยังไม่มีข่าวที่เกี่ยวข้องวันนี้",
    bangkok: "(เวลาไทย)",
    confidence: "ความมั่นใจ",
    apiUsage: (used: number, limit: number) =>
      `Alpha Vantage: ใช้ไป ${used}/${limit} คำขอวันนี้ -- ถ้าถึงขีดจำกัด สัญญาณข่าวจะหยุดอัปเดตจนกว่าจะรีเซ็ต`,
  },
} as const;

function SignalRow({ signal, locale }: { signal: NewsSentimentSignal; locale: Locale }) {
  const t = STR[locale];
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
          {signal.aiMagnitude === "HIGH" && <StatusBadge label={t.highImpact} tone="amber" />}
          <StatusBadge label={directionLabel(signal.aiDirection, locale)} tone={directionTone(signal.aiDirection)} />
        </div>
      </div>

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{signal.aiRationale}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-stone-600 dark:text-stone-400">
        <span>{signal.source}</span>
        <span>{formatPublished(signal.publishedAt, locale)} {t.bangkok}</span>
        <span>{t.confidence} {Math.round(signal.aiConfidence * 100)}%</span>
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
  locale,
}: {
  signals: NewsSentimentSignal[];
  error: string | null;
  locale: Locale;
}) {
  const apiUsage = await getApiUsageToday("alpha_vantage");
  const t = STR[locale];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight flex items-center">
          <StatusLight colorClassName="text-amber-500 dark:text-amber-400" />
          {t.title}
          <InfoTip text={t.titleTooltip} />
        </h2>

        <StatusBadge label={t.monitorOnly} tone="slate" />
      </div>

      <div className="mt-3">
        {error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        ) : signals.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.noNews}</p>
        ) : (
          signals.map((signal) => <SignalRow key={signal.articleUrl} signal={signal} locale={locale} />)
        )}
      </div>

      {apiUsage.limit > 0 && (
        <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
          {t.apiUsage(apiUsage.used, apiUsage.limit)}
        </p>
      )}
    </div>
  );
}
